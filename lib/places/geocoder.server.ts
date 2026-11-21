// ============================================
// WORLDWIDE PLACE SEARCH (streets, city parts, towns, regions)
// ============================================
// Photon (photon.komoot.io): autocomplete over OpenStreetMap, worldwide,
// free, no API key. Called only from our server (/api/locations/suggest),
// whose answers the CDN caches per typed text, so each text reaches Photon
// at most about once an hour.
//
// To switch to a paid provider later (Mapbox, Google…), replace
// geocodePlaces() — the rest of the app only sees Place objects.
// ============================================

import "server-only";
import type { Place, PlaceKind } from "@/lib/places";

const PHOTON_URL = process.env.PHOTON_URL || "https://photon.komoot.io/api/";
/** Photon has names in these languages; anything else gets local names. */
const PHOTON_LANGS = new Set(["en", "de", "fr"]);

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    extent?: [number, number, number, number]; // [minLon, maxLat, maxLon, minLat]
  };
};

const KIND_BY_TYPE: Record<string, PlaceKind> = {
  street: "street",
  locality: "part",
  district: "part",
  city: "city",
  county: "district",
  state: "region",
  country: "country",
};

// Smallest box we search in: about 1.5 km around a street, ~3 km around a point.
const MIN_HALF_SIZE: Partial<Record<PlaceKind, number>> = { street: 0.007, part: 0.012 };

function boxFor(f: PhotonFeature, kind: PlaceKind): [number, number, number, number] | null {
  const c = f.geometry?.coordinates;
  const ext = f.properties.extent;
  let w: number, s: number, e: number, n: number;
  if (ext && ext.length === 4) {
    [w, n, e, s] = ext;
    if (s > n) [s, n] = [n, s];
    if (w > e) [w, e] = [e, w];
  } else if (c) {
    [w, e, s, n] = [c[0], c[0], c[1], c[1]];
  } else return null;
  const half = MIN_HALF_SIZE[kind] ?? 0.02;
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  const hx = Math.max((e - w) / 2, half * 1.5);
  const hy = Math.max((n - s) / 2, half);
  const r = (x: number) => Math.round(x * 1e5) / 1e5;
  return [r(Math.max(-180, cx - hx)), r(Math.max(-90, cy - hy)), r(Math.min(180, cx + hx)), r(Math.min(90, cy + hy))];
}

function uniq(parts: Array<string | undefined>): string[] {
  const out: string[] = [];
  for (const p of parts) if (p && !out.includes(p)) out.push(p);
  return out;
}

export async function geocodePlaces(query: string, locale: string, limit = 8): Promise<Place[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit * 2));
  if (PHOTON_LANGS.has(locale)) url.searchParams.set("lang", locale);
  // Places and streets only — no shops, bus stops or single houses.
  for (const layer of ["street", "locality", "district", "city", "county", "state", "country"]) {
    url.searchParams.append("layer", layer);
  }

  const res = await fetch(url, {
    signal: AbortSignal.timeout(2500),
    headers: { "User-Agent": "Nunvio real-estate search (server)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const data = (await res.json()) as { features?: PhotonFeature[] };

  const out: Place[] = [];
  const seen = new Set<string>();
  for (const f of data.features ?? []) {
    const p = f.properties;
    const kind = KIND_BY_TYPE[p.type ?? ""];
    if (!kind || !p.name) continue;
    const town = p.city && p.city !== p.name ? p.city : undefined;
    const part = kind === "street" && p.district && p.district !== town ? p.district : undefined;
    const context =
      kind === "country"
        ? []
        : uniq([part, town, kind === "city" || kind === "district" ? p.state : undefined, p.country]).filter(
            (x) => x !== p.name
          );
    // The same street often comes back in several pieces.
    const key = `${kind}|${p.name}|${context.slice(0, 2).join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const c = f.geometry?.coordinates;
    const bbox = kind === "country" ? null : boxFor(f, kind);
    const label = kind === "street" && town ? `${p.name}, ${town}` : town && kind === "part" ? `${p.name}, ${town}` : p.name;
    out.push({
      id: `osm-${p.osm_type ?? ""}${p.osm_id ?? out.length}`,
      kind,
      name: p.name,
      value: label,
      context,
      countryCode: (p.countrycode ?? "").toUpperCase(),
      lat: c ? c[1] : null,
      lng: c ? c[0] : null,
      bbox,
    });
    if (out.length >= limit) break;
  }
  return out;
}
