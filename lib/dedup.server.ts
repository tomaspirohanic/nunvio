// ============================================
// DUPLICATE LISTINGS (SERVER-ONLY)
// ============================================
// The same flat is often offered by several agencies. Visitors should see it
// once, with every agency that offers it. A background job (maintenance
// cron) compares new / changed listings with similar ones and links
// duplicates to one "main" listing (Property.duplicateOfId):
//
// - Search shows only main listings (duplicateOfId = null).
// - The detail page lists the other offers of the same property.
// - The oldest listing is the main one, so "days on market" stays honest.
//
// Matching is deliberately strict (better to miss a duplicate than to hide
// a different flat): same country, offer, type and city, area within 3 %,
// price within 5 %, same room count, and — when both have GPS — closer than
// 150 m. Listings from the same agency / same private owner never match
// each other (agencies legitimately list similar flats in one building).
// ============================================

import "server-only";
import { Prisma, PropertyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const BATCH = 200;
const AREA_TOLERANCE = 0.03;
const PRICE_TOLERANCE = 0.05;
const MAX_DISTANCE_M = 150;

const listingSelect = {
  id: true,
  agencyId: true,
  ownerId: true,
  countryCode: true,
  offerType: true,
  propertyType: true,
  city: true,
  areaSqm: true,
  price: true,
  currency: true,
  bedrooms: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  duplicateOfId: true,
  dedupCheckedAt: true,
} satisfies Prisma.PropertySelect;

type Listing = Prisma.PropertyGetPayload<{ select: typeof listingSelect }>;

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s*[-–,].*$/, "") // "Praha – Karlín" -> "praha"
    .trim();
}

function distanceMeters(a: Listing, b: Listing): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) {
    return null;
  }
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function sameSeller(a: Listing, b: Listing): boolean {
  if (a.agencyId && b.agencyId) return a.agencyId === b.agencyId;
  return a.ownerId === b.ownerId;
}

/** Pure comparison; exported for tests. */
export function isSameProperty(a: Listing, b: Listing): boolean {
  if (a.id === b.id || sameSeller(a, b)) return false;
  if (a.countryCode !== b.countryCode || a.offerType !== b.offerType) return false;
  if (a.propertyType !== b.propertyType) return false;
  if (fold(a.city) !== fold(b.city)) return false;
  if (a.areaSqm <= 0 || b.areaSqm <= 0) return false;
  if (Math.abs(a.areaSqm - b.areaSqm) > Math.max(1, a.areaSqm * AREA_TOLERANCE)) return false;
  if (a.bedrooms > 0 && b.bedrooms > 0 && a.bedrooms !== b.bedrooms) return false;
  if (a.currency !== b.currency) return false;
  const pa = Number(a.price);
  const pb = Number(b.price);
  if (Math.abs(pa - pb) > Math.max(pa, pb) * PRICE_TOLERANCE) return false;
  const d = distanceMeters(a, b);
  if (d != null && d > MAX_DISTANCE_M) return false;
  // Without GPS on either side, demand a near-exact size match.
  if (d == null && Math.abs(a.areaSqm - b.areaSqm) > 1) return false;
  return true;
}

async function findMatch(l: Listing): Promise<Listing | null> {
  if (!l.countryCode || l.areaSqm <= 0) return null;
  const tol = Math.max(1, Math.ceil(l.areaSqm * AREA_TOLERANCE));
  const candidates = await prisma.property.findMany({
    where: {
      status: PropertyStatus.PUBLISHED,
      countryCode: l.countryCode,
      offerType: l.offerType,
      propertyType: l.propertyType,
      areaSqm: { gte: l.areaSqm - tol, lte: l.areaSqm + tol },
      id: { not: l.id },
    },
    select: listingSelect,
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return candidates.find((c) => isSameProperty(l, c)) ?? null;
}

/** Re-check one listing and link / unlink it. */
async function checkListing(l: Listing): Promise<"linked" | "unique"> {
  const now = new Date();

  // A main listing being re-checked releases its duplicates; they are
  // re-evaluated on their own (and may join this one again).
  await prisma.property.updateMany({
    where: { duplicateOfId: l.id },
    data: { duplicateOfId: null, dedupCheckedAt: null },
  });

  const match = await findMatch(l);
  if (!match) {
    await prisma.property.update({
      where: { id: l.id },
      data: { duplicateOfId: null, dedupCheckedAt: now },
    });
    return "unique";
  }

  const mainId = match.duplicateOfId ?? match.id;
  const main =
    mainId === match.id
      ? match
      : await prisma.property.findUnique({ where: { id: mainId }, select: listingSelect });

  if (main && main.createdAt <= l.createdAt) {
    await prisma.property.update({
      where: { id: l.id },
      data: { duplicateOfId: main.id, dedupCheckedAt: now },
    });
  } else {
    // This listing is older: it becomes the main one for the whole group.
    await prisma.$transaction([
      prisma.property.update({
        where: { id: l.id },
        data: { duplicateOfId: null, dedupCheckedAt: now },
      }),
      prisma.property.updateMany({
        where: {
          OR: [{ id: mainId }, { duplicateOfId: mainId }],
          id: { not: l.id },
        },
        data: { duplicateOfId: l.id, dedupCheckedAt: now },
      }),
    ]);
  }
  return "linked";
}

/**
 * Time-boxed background pass. Returns counts; safe to run repeatedly.
 */
export async function findDuplicateListings(opts: { deadline: number }) {
  let checked = 0;
  let linked = 0;

  // Main listing gone (archived / draft): its duplicates must show again.
  const orphaned = await prisma.property.updateMany({
    where: {
      duplicateOfId: { not: null },
      duplicateOf: { status: { not: PropertyStatus.PUBLISHED } },
    },
    data: { duplicateOfId: null, dedupCheckedAt: null },
  });
  // Non-published listings never stay linked.
  await prisma.property.updateMany({
    where: { status: { not: PropertyStatus.PUBLISHED }, duplicateOfId: { not: null } },
    data: { duplicateOfId: null },
  });

  while (Date.now() < opts.deadline) {
    const batch = await prisma.property.findMany({
      where: { status: PropertyStatus.PUBLISHED, dedupCheckedAt: null },
      select: listingSelect,
      orderBy: { createdAt: "asc" },
      take: BATCH,
    });
    if (batch.length === 0) break;
    for (const l of batch) {
      if (Date.now() >= opts.deadline) break;
      // Re-read: an earlier listing in this batch may have relinked it.
      const fresh = await prisma.property.findUnique({ where: { id: l.id }, select: listingSelect });
      if (!fresh || fresh.dedupCheckedAt) continue;
      if ((await checkListing(fresh)) === "linked") linked++;
      checked++;
    }
  }

  return { checked, linked, released: orphaned.count };
}

/**
 * Other offers of the same property, for the detail page.
 * Works whether `propertyId` is the main listing or one of its duplicates.
 */
export async function getOtherOffers(propertyId: string, duplicateOfId: string | null) {
  const mainId = duplicateOfId ?? propertyId;
  const group = await prisma.property.findMany({
    where: {
      status: PropertyStatus.PUBLISHED,
      OR: [{ id: mainId }, { duplicateOfId: mainId }],
      NOT: { id: propertyId },
    },
    select: {
      id: true,
      price: true,
      currency: true,
      createdAt: true,
      agency: { select: { id: true, name: true, logoUrl: true } },
      owner: { select: { name: true } },
    },
    orderBy: { price: "asc" },
    take: 20,
  });
  return group.map((g) => ({ ...g, price: Number(g.price) }));
}

/** First time this property appeared on Nunvio (oldest listing of its group). */
export async function firstListedAt(propertyId: string, duplicateOfId: string | null, createdAt: Date) {
  const mainId = duplicateOfId ?? propertyId;
  const oldest = await prisma.property.findFirst({
    where: { OR: [{ id: mainId }, { duplicateOfId: mainId }] },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return oldest && oldest.createdAt < createdAt ? oldest.createdAt : createdAt;
}
