// ============================================
// SEARCH FILTERS AS RAW SQL (SERVER-ONLY)
// ============================================
// Same filters as buildListingWhere() in lib/listing-search.server.ts, as a
// SQL fragment. Needed where Prisma's query builder can't go: grouping map
// points into clusters, and "inside the area drawn on the map" (Postgres'
// built-in point <@ polygon, no PostGIS needed).
// Keep both builders in sync — tests/listings-db.test.ts compares them.
// ============================================

import "server-only";
import { Prisma, PropertyType } from "@prisma/client";
import { countryCodeFor } from "@/lib/country-display";
import { citiesForArea } from "@/lib/places";
import type { ListingSearchParams } from "@/lib/listing-search-params";

function likeEscape(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function polygonLiteral(area: Array<[number, number]>): string {
  // Postgres polygon uses (x, y) = (lng, lat)
  return `(${area.map(([lat, lng]) => `(${lng},${lat})`).join(",")})`;
}

export function listingSqlWhere(p: ListingSearchParams): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`"status" = 'PUBLISHED'`];

  if (p.location) {
    const code = countryCodeFor(p.location);
    const areaCities = code ? null : citiesForArea(p.location);
    if (code) parts.push(Prisma.sql`"countryCode" = ${code}`);
    else if (areaCities) {
      // "okres Sobrance", "Košický kraj" -> any of its towns
      parts.push(Prisma.sql`lower("city") = ANY(${areaCities.map((c) => c.toLowerCase())}::text[])`);
    } else {
      const like = `%${likeEscape(p.location)}%`;
      parts.push(Prisma.sql`("city" ILIKE ${like} OR "country" ILIKE ${like})`);
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
    parts.push(Prisma.sql`"propertyType"::text IN (${Prisma.join(Array.from(mapped))})`);
  } else if (p.type) {
    const t = p.type.toUpperCase();
    if ((Object.values(PropertyType) as string[]).includes(t)) {
      parts.push(Prisma.sql`"propertyType"::text = ${t}`);
    }
  }

  if (p.offer === "buy") parts.push(Prisma.sql`"offerType" = 'SALE'`);
  else if (p.offer === "rent") parts.push(Prisma.sql`"offerType" = 'RENT'`);
  if (p.minArea !== undefined) parts.push(Prisma.sql`"areaSqm" >= ${Math.floor(p.minArea)}`);
  if (p.maxArea !== undefined) parts.push(Prisma.sql`"areaSqm" <= ${Math.floor(p.maxArea)}`);
  if (p.isNewBuild) parts.push(Prisma.sql`"isNewBuild" = true`);
  if (p.reduced) parts.push(Prisma.sql`"previousPrice" IS NOT NULL`);
  if (p.keyword) {
    const like = `%${likeEscape(p.keyword)}%`;
    parts.push(Prisma.sql`("title" ILIKE ${like} OR "description" ILIKE ${like})`);
  }
  if (p.minPrice !== undefined) parts.push(Prisma.sql`"price" >= ${p.minPrice}`);
  if (p.maxPrice !== undefined) parts.push(Prisma.sql`"price" <= ${p.maxPrice}`);
  if (p.area) {
    parts.push(
      Prisma.sql`"latitude" IS NOT NULL AND "longitude" IS NOT NULL
        AND point("longitude", "latitude") <@ ${polygonLiteral(p.area)}::polygon`
    );
  }
  return Prisma.join(parts, " AND ");
}
