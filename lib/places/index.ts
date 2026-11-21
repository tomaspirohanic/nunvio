// ============================================
// PLACE LIST FOR LOCATION SEARCH
// ============================================
// Every town, village, city part, district and region of a country, kept as a
// static file (no outside service, no rate limits, works for places that have
// no listings yet). One file per country in lib/places/data/; to add a
// country, add its file and one line in COUNTRY_DATA below.
//
// Used by /api/locations/suggest (the "Kde:" box) and by the listing search,
// which turns "okres Sobrance" / "Košický kraj" into the list of its towns.
// ============================================

import sk from "./data/sk.json";

type PlaceType = "c" | "v" | "p";
type PlaceRow = [string, PlaceType, number, number, number, number, string?];
type DistrictRow = [string, number, number, number];

interface CountryFile {
  country: string;
  regions: string[];
  districts: DistrictRow[];
  places: PlaceRow[];
}

const COUNTRY_DATA: CountryFile[] = [sk as unknown as CountryFile];

/** Word used before district names in the search box, per country. */
const DISTRICT_PREFIX: Record<string, string> = { SK: "okres" };

export type PlaceKind = "city" | "village" | "part" | "district" | "region" | "street" | "country";

export interface Place {
  id: string;
  kind: PlaceKind;
  /** Shown in bold, e.g. "Sobrance", "okres Sobrance", "Petržalka". */
  name: string;
  /** Put into the search box and the URL when picked. */
  value: string;
  /** Smaller line under the name, e.g. "okres Sobrance, Košický kraj". */
  context: string[];
  countryCode: string;
  lat: number | null;
  lng: number | null;
  /**
   * Set for places found by the worldwide search (lib/places/geocoder.server):
   * listings are then searched inside this box [west, south, east, north]
   * instead of by the town name.
   */
  bbox?: [number, number, number, number] | null;
  /** Districts / regions: box around their towns [west, south, east, north], for the map. */
  bounds?: [number, number, number, number];
}

interface Entry {
  place: Place;
  key: string; // folded name
  words: string[]; // folded words of the name, for "matches a later word"
  rank: number; // kind rank, lower first
  /** Town names this entry stands for in a listing search. */
  cities?: string[];
}

/** Lowercase, without diacritics: "Žilina" -> "zilina". */
export function foldPlaceName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

const KIND_RANK: Record<PlaceKind, number> = {
  city: 0,
  country: 0,
  region: 1,
  district: 2,
  part: 3,
  village: 4,
  street: 5,
};

let index: { entries: Entry[]; byValue: Map<string, Entry> } | null = null;

function cityVariants(name: string, parent?: string): string[] {
  if (!parent) return [name];
  return [name, `${parent} - ${name}`, `${parent}-${name}`, `${parent} ${name}`];
}

function build() {
  const entries: Entry[] = [];

  for (const file of COUNTRY_DATA) {
    const cc = file.country;
    const prefix = DISTRICT_PREFIX[cc] ?? "";
    const districtLabel = (d: string) => (prefix ? `${prefix} ${d}` : d);
    const districtCities: string[][] = file.districts.map(() => []);
    const regionCities: string[][] = file.regions.map(() => []);
    type Box = [number, number, number, number];
    const grow = (b: Box | undefined, lat: number, lng: number): Box =>
      b ? [Math.min(b[0], lng), Math.min(b[1], lat), Math.max(b[2], lng), Math.max(b[3], lat)] : [lng, lat, lng, lat];
    const districtBox: Array<Box | undefined> = file.districts.map(() => undefined);
    const regionBox: Array<Box | undefined> = file.regions.map(() => undefined);

    file.places.forEach(([name, type, ri, di, lat, lng, parent], i) => {
      const kind: PlaceKind = type === "c" ? "city" : type === "p" ? "part" : "village";
      const context: string[] = [];
      if (parent) context.push(parent);
      else if (di >= 0) context.push(districtLabel(file.districts[di][0]));
      context.push(file.regions[ri]);
      const cities = cityVariants(name, parent);
      if (di >= 0) districtCities[di].push(...cities);
      regionCities[ri].push(...cities);
      if (lat && lng && type !== "p") {
        if (di >= 0) districtBox[di] = grow(districtBox[di], lat, lng);
        regionBox[ri] = grow(regionBox[ri], lat, lng);
      }
      entries.push({
        place: {
          id: `${cc}-p${i}`,
          kind,
          name,
          value: name,
          context,
          countryCode: cc,
          lat: lat || null,
          lng: lng || null,
        },
        key: foldPlaceName(name),
        words: [],
        rank: KIND_RANK[kind],
      });
    });

    file.districts.forEach(([name, ri, lat, lng], i) => {
      const label = districtLabel(name);
      entries.push({
        place: {
          id: `${cc}-d${i}`,
          kind: "district",
          name: label,
          value: label,
          context: [file.regions[ri]],
          countryCode: cc,
          lat: lat || null,
          lng: lng || null,
          bounds: districtBox[i],
        },
        key: foldPlaceName(name),
        words: [],
        rank: KIND_RANK.district,
        cities: districtCities[i],
      });
    });

    file.regions.forEach((name, ri) => {
      const pts = file.districts.filter((d) => d[1] === ri && d[2]);
      const avg = (k: 2 | 3) =>
        pts.length ? Math.round((pts.reduce((s, d) => s + d[k], 0) / pts.length) * 1e4) / 1e4 : null;
      // Whole cities spanning several districts (Bratislava, Košice).
      regionCities[ri].push(
        ...file.places.filter((p) => p[2] === ri && p[3] < 0).map((p) => p[0])
      );
      entries.push({
        place: {
          id: `${cc}-r${ri}`,
          kind: "region",
          name,
          value: name,
          context: [],
          countryCode: cc,
          lat: avg(2),
          lng: avg(3),
          bounds: regionBox[ri],
        },
        key: foldPlaceName(name),
        words: [],
        rank: KIND_RANK.region,
        cities: regionCities[ri],
      });
    });
  }

  const byValue = new Map<string, Entry>();
  for (const e of entries) {
    e.words = e.key.split(/[\s-]+/).filter(Boolean);
    const v = foldPlaceName(e.place.value);
    // First one wins: towns before districts with the same text.
    if (!byValue.has(v)) byValue.set(v, e);
  }
  return { entries, byValue };
}

function getIndex() {
  if (!index) index = build();
  return index;
}

/**
 * Places whose name starts with the query (or has a word starting with it),
 * ignoring case and diacritics: "sobra" -> Sobrance, okres Sobrance, …
 */
export function searchPlaces(query: string, limit = 8): Place[] {
  let q = foldPlaceName(query);
  // "okres sobr" -> "sobr"
  for (const p of Object.values(DISTRICT_PREFIX)) {
    if (q.startsWith(`${p} `)) q = q.slice(p.length + 1);
  }
  if (q.length < 2) return [];

  const scored: Array<[number, number, number, Entry]> = [];
  for (const e of getIndex().entries) {
    let match: number;
    if (e.key === q) match = 0;
    else if (e.key.startsWith(q)) match = 1;
    else if (e.words.some((w) => w.startsWith(q)) || e.key.includes(` ${q}`)) match = 2;
    else continue;
    scored.push([match, e.rank, e.key.length, e]);
  }
  scored.sort(
    (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || (a[3].key < b[3].key ? -1 : 1)
  );
  return scored.slice(0, limit).map((s) => s[3].place);
}

/** A place picked in the box, found by the text that was put into it. */
export function findPlaceByValue(value: string): Place | null {
  return getIndex().byValue.get(foldPlaceName(value))?.place ?? null;
}

/**
 * Town names a district or region stands for ("okres Sobrance" -> all
 * municipalities of the district). Null for anything else — towns, villages
 * and free text keep the usual "city contains the text" search.
 */
export function citiesForArea(location: string): string[] | null {
  const e = getIndex().byValue.get(foldPlaceName(location));
  if (!e || !e.cities || e.cities.length === 0) return null;
  return e.cities;
}
