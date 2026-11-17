// Database tests for import -> price history -> duplicate finder.
// They need an empty throwaway Postgres; they are skipped unless
// TEST_DATABASE_URL is set, e.g.
//   TEST_DATABASE_URL=postgresql://postgres@localhost:5433/nunvio_test npm test
// (run `DATABASE_URL=$TEST_DATABASE_URL npx prisma db push` once first).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

type Mods = {
  prisma: typeof import("../lib/db").prisma;
  importNormalizedProperties: typeof import("../lib/feed-import.server").importNormalizedProperties;
  findDuplicateListings: typeof import("../lib/dedup.server").findDuplicateListings;
  getOtherOffers: typeof import("../lib/dedup.server").getOtherOffers;
  buildListingWhere: typeof import("../lib/listing-search.server").buildListingWhere;
};
let m: Mods;

const base = {
  description: "Pekný byt",
  currency: "EUR" as const,
  city: "Bratislava",
  country: "Slovakia",
  propertyType: "APARTMENT" as const,
  offerType: "SALE" as const,
  bedrooms: 3,
  bathrooms: 1,
  areaSqm: 75,
  latitude: 48.1486,
  longitude: 17.1077,
  imageUrls: [],
};

async function makeAgency(name: string) {
  const agency = await m.prisma.agency.create({
    data: { name, companyId: `${name}-${Math.random()}`, address: "x", city: "Bratislava", country: "Slovakia" },
  });
  const user = await m.prisma.user.create({
    data: { email: `${name}-${Math.random()}@test.local`, role: "AGENCY_ADMIN", agencyId: agency.id },
  });
  return { agencyId: agency.id, ownerId: user.id };
}

before(async () => {
  if (!url) return;
  m = {
    prisma: (await import("../lib/db")).prisma,
    importNormalizedProperties: (await import("../lib/feed-import.server")).importNormalizedProperties,
    findDuplicateListings: (await import("../lib/dedup.server")).findDuplicateListings,
    getOtherOffers: (await import("../lib/dedup.server")).getOtherOffers,
    buildListingWhere: (await import("../lib/listing-search.server")).buildListingWhere,
  };
  await m.prisma.$executeRawUnsafe(
    'TRUNCATE "Property", "Agency", "User", "SavedSearch" RESTART IDENTITY CASCADE'
  );
});

after(async () => {
  if (url) await m.prisma.$disconnect();
});

test("import records price drops; dedup links the same flat from two agencies", { skip: !url }, async () => {
  const a = await makeAgency("alpha");
  const b = await makeAgency("beta");

  await m.importNormalizedProperties({ ...a, skipImages: true, properties: [{ ...base, externalId: "A1", title: "Byt A", price: 250000 }] });
  // 30 m away, slightly different price and area -> same property
  await m.importNormalizedProperties({ ...b, skipImages: true, properties: [{ ...base, externalId: "B1", title: "Byt B", price: 245000, areaSqm: 76, latitude: 48.1488 }] });
  // Different flat: other size
  await m.importNormalizedProperties({ ...b, skipImages: true, properties: [{ ...base, externalId: "B2", title: "Iný byt", price: 250000, areaSqm: 110 }] });

  // Price drop on A1
  const r = await m.importNormalizedProperties({ ...a, skipImages: true, properties: [{ ...base, externalId: "A1", title: "Byt A", price: 239000 }] });
  assert.equal(r.updated, 1);
  const a1 = await m.prisma.property.findFirstOrThrow({ where: { externalId: "A1" }, include: { priceChanges: true } });
  assert.equal(Number(a1.previousPrice), 250000);
  assert.equal(a1.priceChanges.length, 1);
  assert.equal(Number(a1.priceChanges[0].newPrice), 239000);

  const res = await m.findDuplicateListings({ deadline: Date.now() + 10_000 });
  assert.equal(res.linked, 1);

  const b1 = await m.prisma.property.findFirstOrThrow({ where: { externalId: "B1" } });
  const b2 = await m.prisma.property.findFirstOrThrow({ where: { externalId: "B2" } });
  assert.equal(b1.duplicateOfId, a1.id, "newer listing points at the older one");
  assert.equal(b2.duplicateOfId, null);

  const visible = await m.prisma.property.findMany({ where: m.buildListingWhere({}), select: { externalId: true } });
  assert.deepEqual(visible.map((v) => v.externalId).sort(), ["A1", "B2"]);

  const reduced = await m.prisma.property.findMany({ where: m.buildListingWhere({ reduced: true }), select: { externalId: true } });
  assert.deepEqual(reduced.map((v) => v.externalId), ["A1"]);

  const others = await m.getOtherOffers(a1.id, null);
  assert.equal(others.length, 1);
  assert.equal(others[0].id, b1.id);

  // Main listing archived -> duplicate shows again after the next run
  await m.prisma.property.update({ where: { id: a1.id }, data: { status: "ARCHIVED" } });
  await m.findDuplicateListings({ deadline: Date.now() + 10_000 });
  const b1After = await m.prisma.property.findUniqueOrThrow({ where: { id: b1.id } });
  assert.equal(b1After.duplicateOfId, null);
});

test("same agency never dedups its own listings", { skip: !url }, async () => {
  const c = await makeAgency("gamma");
  await m.importNormalizedProperties({
    ...c,
    skipImages: true,
    properties: [
      { ...base, city: "Košice", externalId: "C1", title: "Byt 1", price: 150000 },
      { ...base, city: "Košice", externalId: "C2", title: "Byt 2", price: 150000 },
    ],
  });
  await m.findDuplicateListings({ deadline: Date.now() + 10_000 });
  const rows = await m.prisma.property.findMany({ where: { agencyId: c.agencyId } });
  assert.ok(rows.every((r) => r.duplicateOfId === null));
});
