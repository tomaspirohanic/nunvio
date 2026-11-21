// ============================================
// WHERE TO OPEN THE SEARCH MAP
// ============================================
// GET /api/map-extent?location=Košice
// - A country ("Slovensko", "SK", "Czechia"…) → that country's outline box.
// - A city / place → the area where its listings are (outliers trimmed),
//   so searching "Košice" zooms the map onto Košice.
// - Nothing found → { bounds: null } and the map stays where it is.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { countryCodeFor } from "@/lib/country-display";
import { boundsForCountry } from "@/lib/country-bounds";
import { listingSqlWhere } from "@/lib/listing-search-sql.server";
import { findPlaceByValue } from "@/lib/places";
import { geocodePlaces } from "@/lib/places/geocoder.server";

/** A known town/district without listings yet: a box around its centre. */
type Box = [number, number, number, number]; // [west, south, east, north]
/** This route answers [south, west, north, east]. */
const toSWNE = (b: Box) => [b[1], b[0], b[3], b[2]];

async function geocodedBox(query: string): Promise<Box | null> {
  try {
    const [hit] = await geocodePlaces(query, "", 1);
    return hit?.bbox ?? null;
  } catch (err) {
    console.error("[map-extent] geocoder", err);
    return null;
  }
}

/**
 * Outline of a place we know: districts/regions from our list, towns and
 * city parts from OpenStreetMap ("Rusovce, Bratislava, Slovensko").
 */
async function knownPlaceBounds(location: string) {
  const place = findPlaceByValue(location);
  if (!place) return null;
  if (place.bounds) return toSWNE(place.bounds);
  const box = await geocodedBox([place.name, place.context[0], "Slovensko"].filter(Boolean).join(", "));
  return box ? toSWNE(box) : null;
}

function placeBounds(location: string) {
  const place = findPlaceByValue(location);
  if (!place || place.lat == null || place.lng == null) return null;
  const d = place.kind === "region" ? 0.6 : place.kind === "district" ? 0.25 : 0.05;
  return [place.lat - d, place.lng - d * 1.5, place.lat + d, place.lng + d * 1.5];
}

export const runtime = "nodejs";

const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

export async function GET(req: NextRequest) {
  const location = (req.nextUrl.searchParams.get("location") ?? "").trim().slice(0, 120);
  if (!location) return NextResponse.json({ bounds: null }, { headers });

  const country = boundsForCountry(countryCodeFor(location));
  if (country) return NextResponse.json({ bounds: country, kind: "country" }, { headers });

  const known = await knownPlaceBounds(location);
  if (known) return NextResponse.json({ bounds: known, kind: "place" }, { headers });

  try {
    const where = Prisma.sql`${listingSqlWhere({ location })}
      AND "showOnMap" = true AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL
      AND NOT ("latitude" = 0 AND "longitude" = 0)`;
    const [r] = await prisma.$queryRaw<
      Array<{ s: number | null; w: number | null; n: number | null; e: number | null }>
    >(Prisma.sql`
      SELECT percentile_cont(0.03) WITHIN GROUP (ORDER BY lat) AS s,
             percentile_cont(0.03) WITHIN GROUP (ORDER BY lng) AS w,
             percentile_cont(0.97) WITHIN GROUP (ORDER BY lat) AS n,
             percentile_cont(0.97) WITHIN GROUP (ORDER BY lng) AS e
      FROM (SELECT "latitude" AS lat, "longitude" AS lng FROM "Property" WHERE ${where} LIMIT 5000) x`);
    if (r?.s == null || r.w == null || r.n == null || r.e == null) {
      const fromPlace = placeBounds(location) ?? (await geocodedBox(location).then((b) => (b ? toSWNE(b) : null)));
      return NextResponse.json({ bounds: fromPlace, kind: fromPlace ? "place" : undefined }, { headers });
    }
    // A single building would zoom in to street level: keep at least ~2 km around it.
    const pad = 0.01;
    const bounds = [
      Math.min(r.s, r.n - pad),
      Math.min(r.w, r.e - pad),
      Math.max(r.n, r.s + pad),
      Math.max(r.e, r.w + pad),
    ];
    return NextResponse.json({ bounds, kind: "place" }, { headers });
  } catch (err) {
    console.error("[map-extent]", err);
    return NextResponse.json({ bounds: null }, { status: 200 });
  }
}
