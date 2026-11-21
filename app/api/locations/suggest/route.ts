import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { countryCodeFor } from "@/lib/country-display";
import { foldPlaceName, searchPlaces, type Place } from "@/lib/places";
import { geocodePlaces } from "@/lib/places/geocoder.server";

export const runtime = "nodejs";

const LIMIT = 8;

/**
 * Location suggestions for the public search box ("Kde:").
 *
 * 1. Every town, village, city part, district and region of the countries in
 *    lib/places (static list, so places with no listings yet are suggested
 *    too, e.g. "sobra" -> Sobrance, okres Sobrance).
 * 2. Worldwide streets, city parts, towns and regions from OpenStreetMap
 *    (lib/places/geocoder.server.ts). Picking one searches listings inside
 *    its area on the map.
 * 3. Plus towns that have listings but neither list knows, from the database.
 * Each suggestion carries how many listings it has right now.
 *
 * Replaces direct browser calls to nominatim.openstreetmap.org (whose usage
 * policy forbids autocomplete). Response keeps the Nominatim-like fields the
 * search UIs read (display_name, address.city) next to the new ones.
 */
type Suggestion = Place & {
  place_id: string;
  display_name: string;
  listings: number;
  address: { city: string; country: string };
};

function toSuggestion(p: Place, listings: number): Suggestion {
  return {
    ...p,
    place_id: p.id,
    display_name: [p.name, ...p.context].join(", "),
    listings,
    address: { city: p.value, country: p.countryCode },
  };
}

/** Own list first, but leave room for worldwide results. */
const OWN_MAX = 5;

const suggest = unstable_cache(
  async (q: string, locale: string): Promise<Suggestion[]> => {
    const [own, world] = await Promise.all([
      Promise.resolve(searchPlaces(q, LIMIT)),
      geocodePlaces(q, locale, LIMIT).catch((error) => {
        // Our own list still answers when the worldwide search is down.
        console.error("[locations/suggest] geocoder", error);
        return [] as Place[];
      }),
    ]);
    // Worldwide results that our own list already has (same name, same country).
    const ownKeys = new Set(own.map((p) => `${p.countryCode}|${foldPlaceName(p.name.replace(/^okres /, ""))}`));
    const fresh = world.filter(
      (p) =>
        p.kind === "street" ||
        !ownKeys.has(`${p.countryCode}|${foldPlaceName(p.name.replace(/^okres /, ""))}`)
    );
    const places = [...own.slice(0, Math.max(OWN_MAX, LIMIT - fresh.length)), ...fresh].slice(0, LIMIT);

    const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
    const pattern = `%${escaped}%`;
    const prefix = `${escaped}%`;
    const placeNames = places
      .filter((p) => !p.bbox && (p.kind === "city" || p.kind === "village" || p.kind === "part"))
      .map((p) => p.name);

    // Towns with listings matching the text, plus listing counts for the
    // towns found above. Uses the pg_trgm index on "city".
    const rows = await prisma.$queryRaw<
      Array<{ city: string; country: string; listings: bigint }>
    >`
      SELECT city, country, COUNT(*) AS listings
      FROM "Property"
      WHERE status = 'PUBLISHED'
        AND (city ILIKE ${pattern} OR city = ANY(${placeNames}::text[]))
      GROUP BY city, country
      ORDER BY (city ILIKE ${prefix}) DESC, COUNT(*) DESC
      LIMIT 20
    `.catch((error) => {
      // The place list alone is still useful when the database is slow/down.
      console.error("[locations/suggest] db", error);
      return [];
    });

    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = foldPlaceName(r.city);
      counts.set(k, (counts.get(k) ?? 0) + Number(r.listings));
    }

    const out = places.map((p) =>
      toSuggestion(
        p,
        p.bbox || p.kind === "district" || p.kind === "region" ? 0 : counts.get(foldPlaceName(p.name)) ?? 0
      )
    );

    // Towns with listings that the place list doesn't know (yet).
    const known = new Set(places.filter((p) => p.kind !== "street").map((p) => foldPlaceName(p.name)));
    const extra: Suggestion[] = [];
    for (const r of rows) {
      const k = foldPlaceName(r.city);
      if (known.has(k)) continue;
      known.add(k);
      const cc = countryCodeFor(r.country) ?? "";
      extra.push(
        toSuggestion(
          {
            id: `db-${k}-${cc}`,
            kind: "city",
            name: r.city,
            value: r.city,
            context: [r.country],
            countryCode: cc,
            lat: null,
            lng: null,
          },
          Number(r.listings)
        )
      );
    }

    // Keep room for a couple of those even when the list is full.
    const room = Math.min(extra.length, 2);
    return [...out.slice(0, LIMIT - room), ...extra].slice(0, LIMIT);
  },
  ["location-suggest-v3"],
  { revalidate: 3600 }
);

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 60);
  const locale = (req.nextUrl.searchParams.get("lang") || "").slice(0, 5).toLowerCase();
  if (q.length < 2) return NextResponse.json([]);

  try {
    const data = await suggest(q.toLowerCase(), locale);
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
