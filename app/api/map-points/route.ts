// ============================================
// MAP POINTS FOR THE SEARCH MAP
// ============================================
// GET /api/map-points?<search filters>&bbox=west,south,east,north&zoom=12
// Returns every matching listing in the visible map area — not only the 48
// on the current results page. Many results are grouped into clusters on
// the server (grid by zoom level), so the map stays fast at millions of
// listings: the browser never receives more than MAX_POINTS markers.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseListingSearchParams } from "@/lib/listing-search-params";
import { listingSqlWhere } from "@/lib/listing-search-sql.server";

export const runtime = "nodejs";

const MAX_POINTS = 200;
/** Cluster cell ≈ 60 px on screen at the given zoom (256 px tiles). */
function cellDegrees(zoom: number) {
  return (360 / Math.pow(2, zoom)) * (60 / 256);
}

export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const bbox = (sp.bbox ?? "").split(",").map(Number);
  const zoom = Math.min(20, Math.max(1, Math.floor(Number(sp.zoom) || 7)));
  if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: "bbox required" }, { status: 400 });
  }
  const [west, south, east, north] = bbox;
  const filters = parseListingSearchParams(sp);
  const where = Prisma.sql`${listingSqlWhere(filters)}
    AND "showOnMap" = true
    AND "latitude" BETWEEN ${south} AND ${north}
    AND "longitude" BETWEEN ${west} AND ${east}`;

  try {
    const [{ n }] = await prisma.$queryRaw<Array<{ n: bigint }>>(
      Prisma.sql`SELECT COUNT(*) AS n FROM (SELECT 1 FROM "Property" WHERE ${where} LIMIT ${MAX_POINTS + 1}) x`
    );
    const headers = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

    if (Number(n) <= MAX_POINTS) {
      const points = await prisma.$queryRaw<
        Array<{ id: string; lat: number; lng: number; price: number; currency: string; offerType: string }>
      >(Prisma.sql`
        SELECT "id", "latitude" AS lat, "longitude" AS lng, "price"::float AS price,
               "currency"::text AS currency, "offerType"::text AS "offerType"
        FROM "Property" WHERE ${where}
        ORDER BY "promotionLevel" DESC, "createdAt" DESC
        LIMIT ${MAX_POINTS}`);
      return NextResponse.json({ kind: "points", points }, { headers });
    }

    const cell = cellDegrees(zoom);
    const clusters = await prisma.$queryRaw<Array<{ lat: number; lng: number; count: bigint }>>(Prisma.sql`
      SELECT AVG("latitude")::float AS lat, AVG("longitude")::float AS lng, COUNT(*) AS count
      FROM "Property" WHERE ${where}
      GROUP BY floor("latitude" / ${cell}), floor("longitude" / ${cell})
      LIMIT 2000`);
    return NextResponse.json(
      {
        kind: "clusters",
        clusters: clusters.map((c) => ({ lat: c.lat, lng: c.lng, count: Number(c.count) })),
      },
      { headers }
    );
  } catch (err) {
    console.error("[map-points]", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
