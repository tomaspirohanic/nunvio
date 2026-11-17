import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Location suggestions for the public search box.
 *
 * Replaces direct browser calls to nominatim.openstreetmap.org (whose usage
 * policy forbids autocomplete and allows ~1 request/second — it would block
 * us with real traffic). Suggests only cities that actually have published
 * listings, so a pick never leads to an empty result page.
 *
 * Response shape mirrors the Nominatim fields the search UIs already read.
 */
const suggest = unstable_cache(
  async (q: string) => {
    const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const prefix = `${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    // Uses the pg_trgm index on "city" (see prisma/schema.prisma).
    const rows = await prisma.$queryRaw<
      Array<{ city: string; country: string; listings: bigint }>
    >`
      SELECT city, country, COUNT(*) AS listings
      FROM "Property"
      WHERE status = 'PUBLISHED' AND city ILIKE ${pattern}
      GROUP BY city, country
      ORDER BY (city ILIKE ${prefix}) DESC, COUNT(*) DESC
      LIMIT 8
    `;
    return rows.map((r, i) => ({
      place_id: `nunvio-${i}-${r.city}-${r.country}`,
      display_name: `${r.city}, ${r.country}`,
      name: r.city,
      listings: Number(r.listings),
      address: { city: r.city, country: r.country },
    }));
  },
  ["location-suggest-v1"],
  { revalidate: 3600 }
);

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json([]);

  try {
    const data = await suggest(q.toLowerCase());
    return NextResponse.json(data, {
      headers: {
        // Same query from many visitors -> served by the CDN.
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("[locations/suggest]", error);
    return NextResponse.json([], { status: 200 });
  }
}
