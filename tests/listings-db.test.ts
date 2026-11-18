// Database tests for import -> price history -> search -> alerts.
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
    buildListingWhere: (await import("../lib/listing-search.server")).buildListingWhere,
  };
  await m.prisma.$executeRawUnsafe(
    'TRUNCATE "Property", "Agency", "User", "SavedSearch" RESTART IDENTITY CASCADE'
  );
});

after(async () => {
  if (url) await m.prisma.$disconnect();
});

test("import records price drops; each agency's listing of the same flat stays visible", { skip: !url }, async () => {
  const a = await makeAgency("alpha");
  const b = await makeAgency("beta");

  await m.importNormalizedProperties({ ...a, skipImages: true, properties: [{ ...base, externalId: "A1", title: "Byt A", price: 250000 }] });
  // Same flat offered by another agency: agencies are our customers, both must show.
  await m.importNormalizedProperties({ ...b, skipImages: true, properties: [{ ...base, externalId: "B1", title: "Byt B", price: 245000, areaSqm: 76 }] });

  // Price drop on A1
  const r = await m.importNormalizedProperties({ ...a, skipImages: true, properties: [{ ...base, externalId: "A1", title: "Byt A", price: 239000 }] });
  assert.equal(r.updated, 1);
  const a1 = await m.prisma.property.findFirstOrThrow({ where: { externalId: "A1" }, include: { priceChanges: true } });
  assert.equal(Number(a1.previousPrice), 250000);
  assert.equal(a1.priceChanges.length, 1);
  assert.equal(Number(a1.priceChanges[0].newPrice), 239000);

  // Price raise clears the "reduced" badge but keeps history
  await m.importNormalizedProperties({ ...b, skipImages: true, properties: [{ ...base, externalId: "B1", title: "Byt B", price: 255000, areaSqm: 76 }] });
  const b1 = await m.prisma.property.findFirstOrThrow({ where: { externalId: "B1" }, include: { priceChanges: true } });
  assert.equal(b1.previousPrice, null);
  assert.equal(b1.priceChanges.length, 1);

  const visible = await m.prisma.property.findMany({ where: m.buildListingWhere({ location: "Bratislava" }), select: { externalId: true } });
  assert.deepEqual(visible.map((v) => v.externalId).sort(), ["A1", "B1"]);

  const reduced = await m.prisma.property.findMany({ where: m.buildListingWhere({ reduced: true }), select: { externalId: true } });
  assert.deepEqual(reduced.map((v) => v.externalId), ["A1"]);
});

test("saved search: alerts new listings once, respects filters", { skip: !url }, async () => {
  const { createSavedSearch, sendSearchAlerts, findAlertMatches, confirmSavedSearch, unsubscribeSavedSearch } =
    await import("../lib/saved-search.server");
  const d = await makeAgency("delta");

  const r = await createSavedSearch({
    email: "Buyer@Example.com",
    filters: { location: "Žilina", offer: "buy", maxPrice: 200000, page: 3 },
    locale: "sk",
    frequency: "INSTANT",
  });
  assert.deepEqual(r, { ok: true, needsConfirmation: true });
  const saved = await m.prisma.savedSearch.findFirstOrThrow({ where: { email: "buyer@example.com" } });
  assert.equal(saved.confirmedAt, null);
  assert.deepEqual(saved.filters, { location: "Žilina", offer: "buy", maxPrice: 200000 });
  assert.match(saved.label, /Žilina/);

  // Not confirmed -> no alerts
  assert.equal((await sendSearchAlerts({ deadline: Date.now() + 5000 })).checked, 0);
  await confirmSavedSearch(saved.token);
  await m.prisma.savedSearch.update({ where: { id: saved.id }, data: { lastCheckedAt: new Date(Date.now() - 60_000) } });

  await m.importNormalizedProperties({
    ...d,
    skipImages: true,
    properties: [
      { ...base, city: "Žilina", externalId: "D1", title: "Lacný byt", price: 180000 },
      { ...base, city: "Žilina", externalId: "D2", title: "Drahý byt", price: 320000, areaSqm: 120 },
      { ...base, city: "Martin", externalId: "D3", title: "Iné mesto", price: 150000, areaSqm: 50 },
    ],
  });

  const matches = await findAlertMatches(saved.filters as never, new Date(Date.now() - 60_000));
  assert.deepEqual(matches.listings.map((l) => l.title), ["Lacný byt"]);

  const first = await sendSearchAlerts({ deadline: Date.now() + 5000 });
  assert.equal(first.emailed, 1);
  const second = await sendSearchAlerts({ deadline: Date.now() + 5000 });
  assert.equal(second.emailed, 0, "the same listing is not sent twice");

  await unsubscribeSavedSearch(saved.token);
  assert.equal((await m.prisma.savedSearch.findUniqueOrThrow({ where: { id: saved.id } })).active, false);
});

test("SQL filter builder matches the Prisma one; drawn area filters exactly", { skip: !url }, async () => {
  const { listingSqlWhere } = await import("../lib/listing-search-sql.server");
  const { Prisma } = await import("@prisma/client");
  const e = await makeAgency("epsilon");
  await m.importNormalizedProperties({
    ...e,
    skipImages: true,
    properties: [
      { ...base, city: "Trnava", externalId: "E1", title: "Centrum", price: 200000, latitude: 48.377, longitude: 17.588 },
      { ...base, city: "Trnava", externalId: "E2", title: "Okraj 50%_x", price: 150000, latitude: 48.40, longitude: 17.65, offerType: "RENT" },
      { ...base, city: "Trnava", externalId: "E3", title: "Dom", price: 350000, propertyType: "HOUSE", areaSqm: 140, latitude: 48.36, longitude: 17.56 },
    ],
  });
  const cases = [
    { location: "Trnava" },
    { location: "Trnava", offer: "buy" as const, maxPrice: 300000 },
    { location: "Trnava", types: ["house_villa"] },
    { location: "Slovensko", minArea: 100 },
    { keyword: "50%_" },
  ];
  for (const c of cases) {
    const viaPrisma = (await m.prisma.property.findMany({ where: m.buildListingWhere(c), select: { id: true } })).map((r) => r.id).sort();
    const viaSql = (await m.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM "Property" WHERE ${listingSqlWhere(c)}`)).map((r) => r.id).sort();
    assert.deepEqual(viaSql, viaPrisma, JSON.stringify(c));
  }
  // Triangle around the centre point only
  const area: Array<[number, number]> = [[48.39, 17.57], [48.37, 17.60], [48.365, 17.575]];
  const inArea = await m.prisma.$queryRaw<Array<{ externalId: string }>>(
    Prisma.sql`SELECT "externalId" FROM "Property" WHERE ${listingSqlWhere({ area })}`
  );
  assert.deepEqual(inArea.map((r) => r.externalId), ["E1"]);
  const { pointInArea } = await import("../lib/listing-search-params");
  assert.equal(pointInArea(48.377, 17.588, area), true);
  assert.equal(pointInArea(48.40, 17.65, area), false);
});
