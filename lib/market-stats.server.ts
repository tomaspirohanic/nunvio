// ============================================
// MARKET STATISTICS PER COUNTRY / CITY (SERVER-ONLY)
// ============================================
// Powers the public "property prices in <city>" pages (SEO landing pages):
// average and median price per m², asking-price trend by month, number of
// listings, share of listings with a price drop.
//
// Computed from live listings with SQL aggregates and cached for a day.
// At millions of listings this is still one indexed scan per city per day;
// if it ever gets heavy, move the same queries into a nightly job that fills
// a stats table (the page code does not change).
// ============================================

import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const DAY = 86_400;
/** Ignore obviously broken areas (parking spots typed as flats, typos). */
const MIN_AREA = 15;
/** A city needs this many listings for its own page (thin pages hurt SEO). */
export const MIN_LISTINGS_FOR_CITY_PAGE = 5;

/** Each country's statistics are in its main currency (listings in other currencies are left out). */
export function statsCurrency(countryCode: string): "EUR" | "CZK" {
  return countryCode === "CZ" ? "CZK" : "EUR";
}

export function citySlug(city: string): string {
  return city
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type CitySummary = {
  city: string;
  slug: string;
  listings: number;
  /** Average asking price per m² of flats for sale (null if too few) */
  flatSalePerSqm: number | null;
  /** Every spelling of this city found in listings */
  names: string[];
};

/** All cities of a country with at least MIN_LISTINGS_FOR_CITY_PAGE listings. */
export const getCountryCities = unstable_cache(
  async (countryCode: string): Promise<CitySummary[]> => {
    const currency = statsCurrency(countryCode);
    const rows = await prisma.$queryRaw<
      Array<{ city: string; listings: bigint; flat_sale_per_sqm: number | null; flat_sale_n: bigint }>
    >(Prisma.sql`
      SELECT "city",
             COUNT(*) AS listings,
             AVG(CASE WHEN "offerType" = 'SALE' AND "propertyType" = 'APARTMENT'
                       AND "areaSqm" >= ${MIN_AREA} AND "currency"::text = ${currency}
                      THEN "price" / "areaSqm" END)::float AS flat_sale_per_sqm,
             COUNT(CASE WHEN "offerType" = 'SALE' AND "propertyType" = 'APARTMENT'
                         AND "areaSqm" >= ${MIN_AREA} AND "currency"::text = ${currency}
                        THEN 1 END) AS flat_sale_n
      FROM "Property"
      WHERE "status" = 'PUBLISHED' AND "countryCode" = ${countryCode}
      GROUP BY "city"
      HAVING COUNT(*) >= ${MIN_LISTINGS_FOR_CITY_PAGE}
      ORDER BY COUNT(*) DESC
      LIMIT 2000`);
    // Several spellings of one city ("Košice", "Kosice") share a slug: merge.
    const bySlug = new Map<string, CitySummary & { _n: number; _sum: number }>();
    for (const r of rows) {
      const slug = citySlug(r.city);
      if (!slug) continue;
      const n = Number(r.flat_sale_n);
      const prev = bySlug.get(slug);
      if (prev) {
        prev.listings += Number(r.listings);
        prev.names.push(r.city);
        if (r.flat_sale_per_sqm != null) {
          prev._sum += r.flat_sale_per_sqm * n;
          prev._n += n;
        }
      } else {
        bySlug.set(slug, {
          city: r.city,
          slug,
          listings: Number(r.listings),
          flatSalePerSqm: null,
          names: [r.city],
          _n: r.flat_sale_per_sqm != null ? n : 0,
          _sum: r.flat_sale_per_sqm != null ? r.flat_sale_per_sqm * n : 0,
        });
      }
    }
    return Array.from(bySlug.values()).map(({ _n, _sum, ...c }) => ({
      ...c,
      flatSalePerSqm: _n >= 3 ? Math.round(_sum / _n) : null,
    }));
  },
  ["market-country-cities-v1"],
  { revalidate: DAY }
);

export type SegmentStats = {
  offerType: "SALE" | "RENT";
  propertyType: "APARTMENT" | "HOUSE";
  listings: number;
  avgPerSqm: number | null;
  medianPerSqm: number | null;
  medianPrice: number | null;
  medianArea: number | null;
};

export type TrendPoint = { month: string; avgPerSqm: number; listings: number };

export type CityStats = {
  city: string;
  slug: string;
  countryCode: string;
  currency: "EUR" | "CZK";
  totalListings: number;
  forSale: number;
  forRent: number;
  newBuilds: number;
  reducedShare: number;
  segments: SegmentStats[];
  /** Flats for sale: average asking price per m² by month listed (last 12 months) */
  trend: TrendPoint[];
  /** Real spellings of the city in listings (for the search link) */
  names: string[];
  updatedAt: string;
};

export const getCityStats = unstable_cache(
  async (countryCode: string, slug: string): Promise<CityStats | null> => {
    const cities = await getCountryCities(countryCode);
    const match = cities.find((c) => c.slug === slug);
    if (!match) return null;
    const names = match.names;
    const currency = statsCurrency(countryCode);
    const base = Prisma.sql`"status" = 'PUBLISHED' AND "countryCode" = ${countryCode} AND "city" IN (${Prisma.join(names)})`;

    const [totals] = await prisma.$queryRaw<
      Array<{ total: bigint; sale: bigint; rent: bigint; newb: bigint; reduced: bigint }>
    >(Prisma.sql`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE "offerType" = 'SALE') AS sale,
             COUNT(*) FILTER (WHERE "offerType" = 'RENT') AS rent,
             COUNT(*) FILTER (WHERE "isNewBuild") AS newb,
             COUNT(*) FILTER (WHERE "previousPrice" IS NOT NULL) AS reduced
      FROM "Property" WHERE ${base}`);

    const segRows = await prisma.$queryRaw<
      Array<{
        offerType: "SALE" | "RENT";
        propertyType: "APARTMENT" | "HOUSE";
        n: bigint;
        avg_sqm: number | null;
        med_sqm: number | null;
        med_price: number | null;
        med_area: number | null;
      }>
    >(Prisma.sql`
      SELECT "offerType", "propertyType", COUNT(*) AS n,
             AVG("price" / "areaSqm")::float AS avg_sqm,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "price" / "areaSqm")::float AS med_sqm,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "price")::float AS med_price,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "areaSqm")::float AS med_area
      FROM "Property"
      WHERE ${base} AND "areaSqm" >= ${MIN_AREA} AND "currency"::text = ${currency}
        AND "propertyType" IN ('APARTMENT', 'HOUSE')
      GROUP BY "offerType", "propertyType"`);

    const trendRows = await prisma.$queryRaw<Array<{ month: Date; avg_sqm: number; n: bigint }>>(Prisma.sql`
      SELECT date_trunc('month', "createdAt") AS month,
             AVG("price" / "areaSqm")::float AS avg_sqm, COUNT(*) AS n
      FROM "Property"
      WHERE ${base} AND "areaSqm" >= ${MIN_AREA} AND "currency"::text = ${currency}
        AND "offerType" = 'SALE' AND "propertyType" = 'APARTMENT'
        AND "createdAt" >= date_trunc('month', now()) - interval '11 months'
      GROUP BY 1 ORDER BY 1`);

    const round = (v: number | null) => (v == null ? null : Math.round(v));
    const segments: SegmentStats[] = [];
    for (const offerType of ["SALE", "RENT"] as const) {
      for (const propertyType of ["APARTMENT", "HOUSE"] as const) {
        const r = segRows.find((s) => s.offerType === offerType && s.propertyType === propertyType);
        const n = r ? Number(r.n) : 0;
        // Fewer than 3 listings: an "average" would be misleading.
        segments.push({
          offerType,
          propertyType,
          listings: n,
          avgPerSqm: n >= 3 ? round(r!.avg_sqm) : null,
          medianPerSqm: n >= 3 ? round(r!.med_sqm) : null,
          medianPrice: n >= 3 ? round(r!.med_price) : null,
          medianArea: n >= 3 ? round(r!.med_area) : null,
        });
      }
    }

    const total = Number(totals?.total ?? 0);
    return {
      city: match.city,
      slug,
      countryCode,
      currency,
      totalListings: total,
      forSale: Number(totals?.sale ?? 0),
      forRent: Number(totals?.rent ?? 0),
      newBuilds: Number(totals?.newb ?? 0),
      reducedShare: total > 0 ? Math.round((Number(totals?.reduced ?? 0) / total) * 100) : 0,
      segments,
      trend: trendRows
        .filter((t) => Number(t.n) >= 3)
        .map((t) => ({
          month: t.month.toISOString().slice(0, 7),
          avgPerSqm: Math.round(t.avg_sqm),
          listings: Number(t.n),
        })),
      names,
      updatedAt: new Date().toISOString(),
    };
  },
  ["market-city-stats-v1"],
  { revalidate: DAY }
);

/** Countries that have listings (for the prices index + sitemap). */
export const getCountriesWithListings = unstable_cache(
  async (): Promise<Array<{ countryCode: string; listings: number }>> => {
    const rows = await prisma.$queryRaw<Array<{ countryCode: string; n: bigint }>>(Prisma.sql`
      SELECT "countryCode", COUNT(*) AS n FROM "Property"
      WHERE "status" = 'PUBLISHED' AND "countryCode" IS NOT NULL
      GROUP BY "countryCode" ORDER BY n DESC`);
    return rows.map((r) => ({ countryCode: r.countryCode, listings: Number(r.n) }));
  },
  ["market-countries-v1"],
  { revalidate: DAY }
);
