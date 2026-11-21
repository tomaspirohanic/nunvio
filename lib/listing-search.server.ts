// ============================================
// PUBLIC LISTING SEARCH (SERVER-ONLY)
// ============================================
// The one place that turns search filters into a database query.
// Today it runs on Postgres. When the catalog outgrows Postgres search
// (see docs/SCALING.md, "Stage 3"), swap the body of `searchListings` for a
// dedicated search engine (Typesense / Meilisearch / OpenSearch) that returns
// listing ids, and keep the same inputs and outputs so pages don't change.
// ============================================

import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma, PropertyType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { countryCodeFor } from "@/lib/country-display";
import { citiesForArea } from "@/lib/places";
import { translationWhereForLocale } from "@/lib/listing-text";
import { LISTINGS_CACHE_TAG } from "@/lib/revalidate-listings";
import type { ListingSearchParams } from "@/lib/listing-search-params";
import { listingSqlWhere } from "@/lib/listing-search-sql.server";

export const SEARCH_PAGE_SIZE = 48;
/**
 * Counting every match is the slowest part of a search on millions of rows,
 * and nobody pages past a few hundred pages. Count at most this many; the UI
 * shows "10 000+" and pagination stops there.
 */
export const MAX_COUNTED_RESULTS = 10_000;

export type { ListingSearchParams } from "@/lib/listing-search-params";

export function buildListingWhere(p: ListingSearchParams): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = { status: "PUBLISHED" };
  const and: Prisma.PropertyWhereInput[] = [];

  if (p.location) {
    // "Slovensko", "Germany", "Nemecko", "DE" -> indexed equality on countryCode.
    // Anything else (city, district, partial text) -> trigram ILIKE on city/country.
    const code = countryCodeFor(p.location);
    const areaCities = code ? null : citiesForArea(p.location);
    if (code) {
      where.countryCode = code;
    } else if (areaCities) {
      // "okres Sobrance", "Košický kraj" -> any of its towns (lib/places)
      and.push({ city: { in: areaCities, mode: "insensitive" } });
    } else {
      and.push({
        OR: [
          { city: { contains: p.location, mode: "insensitive" } },
          { country: { contains: p.location, mode: "insensitive" } },
        ],
      });
    }
  }

  const mapped = new Set<PropertyType>();
  for (const t of p.types ?? []) {
    if (t.startsWith("flat_")) mapped.add(PropertyType.APARTMENT);
    if (t.startsWith("house_")) mapped.add(PropertyType.HOUSE);
    if (t.startsWith("land_")) mapped.add(PropertyType.LAND);
    if (t.startsWith("commercial_")) mapped.add(PropertyType.COMMERCIAL);
  }
  if (mapped.size > 0) {
    where.propertyType = { in: Array.from(mapped) };
  } else if (p.type) {
    const normalized = p.type.toUpperCase();
    if ((Object.values(PropertyType) as string[]).includes(normalized)) {
      where.propertyType = normalized as PropertyType;
    }
  }

  if (p.offer === "buy") where.offerType = "SALE";
  else if (p.offer === "rent") where.offerType = "RENT";

  if (p.minArea !== undefined || p.maxArea !== undefined) {
    where.areaSqm = {
      ...(p.minArea !== undefined ? { gte: Math.floor(p.minArea) } : {}),
      ...(p.maxArea !== undefined ? { lte: Math.floor(p.maxArea) } : {}),
    };
  }

  if (p.isNewBuild) where.isNewBuild = true;
  if (p.reduced) where.previousPrice = { not: null };

  // Drawn map area: Prisma can only express its bounding box. Exact
  // point-in-polygon runs in SQL (searchListings) or in JS (alerts).
  if (p.area) {
    const lats = p.area.map((x) => x[0]);
    const lngs = p.area.map((x) => x[1]);
    and.push({
      latitude: { gte: Math.min(...lats), lte: Math.max(...lats) },
      longitude: { gte: Math.min(...lngs), lte: Math.max(...lngs) },
    });
  }

  // Visible map area ("search as I move the map").
  if (p.bbox) {
    const [w, south, e, n] = p.bbox;
    and.push({ latitude: { gte: south, lte: n }, longitude: { gte: w, lte: e } });
  }

  if (p.keyword) {
    and.push({
      OR: [
        { title: { contains: p.keyword, mode: "insensitive" } },
        { description: { contains: p.keyword, mode: "insensitive" } },
      ],
    });
  }

  // Price is compared in the listing's own currency.
  if (p.minPrice !== undefined || p.maxPrice !== undefined) {
    where.price = {
      ...(p.minPrice !== undefined ? { gte: p.minPrice } : {}),
      ...(p.maxPrice !== undefined ? { lte: p.maxPrice } : {}),
    };
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/**
 * Identical searches (same filters + page + locale) share one cached DB
 * result for 60 s. Any listing change calls revalidateListings(), which drops
 * this cache immediately.
 */
export async function searchListings(params: ListingSearchParams, localeTag: string) {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  if (params.area) {
    // Exact polygon filter: ids come from SQL, the rest is the normal query.
    const sqlWhere = listingSqlWhere(params);
    const [{ n }] = await prisma.$queryRaw<Array<{ n: bigint }>>(
      Prisma.sql`SELECT COUNT(*) AS n FROM (SELECT 1 FROM "Property" WHERE ${sqlWhere} LIMIT ${MAX_COUNTED_RESULTS}) x`
    );
    const counted = Number(n);
    const pageCount = Math.max(1, Math.ceil(counted / SEARCH_PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const ids = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "Property" WHERE ${sqlWhere}
      ORDER BY "promotionLevel" DESC, "createdAt" DESC
      OFFSET ${(safePage - 1) * SEARCH_PAGE_SIZE} LIMIT ${SEARCH_PAGE_SIZE}`);
    const res = await cachedSearch(
      JSON.stringify({ id: { in: ids.map((r) => r.id) } }),
      1,
      localeTag
    );
    return {
      ...res,
      total: counted,
      totalIsCapped: counted >= MAX_COUNTED_RESULTS,
      pageCount,
      safePage,
    };
  }
  const where = buildListingWhere(params);
  return cachedSearch(JSON.stringify(where), page, localeTag);
}

const cachedSearch = unstable_cache(
  async (whereJson: string, page: number, localeTag: string) => {
    const where = JSON.parse(whereJson) as Prisma.PropertyWhereInput;

    const counted = await prisma.property.count({ where, take: MAX_COUNTED_RESULTS });
    const totalIsCapped = counted >= MAX_COUNTED_RESULTS;
    const pageCount = Math.max(1, Math.ceil(counted / SEARCH_PAGE_SIZE));
    const safePage = Math.min(page, pageCount);

    const properties = await prisma.property.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        currency: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        showOnMap: true,
        bedrooms: true,
        bathrooms: true,
        areaSqm: true,
        propertyType: true,
        offerType: true,
        images: true,
        promotionLevel: true,
        featuredUntil: true,
        createdAt: true,
        previousPrice: true,
        priceChangedAt: true,
        translations: {
          where: translationWhereForLocale(localeTag),
          select: {
            title: true,
            description: true,
            translatedTitle: true,
            translatedDescription: true,
          },
          take: 1,
        },
      },
      orderBy: [{ promotionLevel: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * SEARCH_PAGE_SIZE,
      take: SEARCH_PAGE_SIZE,
    });

    // Plain JSON only (Decimal / Date are not cache-serializable as-is).
    const rows = properties.map((p) => ({
      ...p,
      price: Number(p.price),
      previousPrice: p.previousPrice != null ? Number(p.previousPrice) : null,
      priceChangedAt: p.priceChangedAt ? p.priceChangedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      featuredUntil: p.featuredUntil ? p.featuredUntil.toISOString() : null,
    }));

    return { total: counted, totalIsCapped, pageCount, safePage, rows };
  },
  ["public-property-search-v3"],
  { revalidate: 60, tags: [LISTINGS_CACHE_TAG] }
);
