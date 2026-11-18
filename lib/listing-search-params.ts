// ============================================
// SEARCH FILTERS <-> URL (shared: server pages, saved searches, alerts)
// ============================================

export type ListingSearchParams = {
  location?: string;
  /** Exact property type, e.g. "APARTMENT" */
  type?: string;
  /** UI type chips, e.g. ["flat_2", "house_villa"] */
  types?: string[];
  offer?: "buy" | "rent";
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  keyword?: string;
  isNewBuild?: boolean;
  /** Only listings whose price went down (previousPrice set) */
  reduced?: boolean;
  /** Area drawn on the map: polygon of [lat, lng] points (3–60 points) */
  area?: Array<[number, number]>;
  page?: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined) =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

const num = (v: string | string[] | undefined) => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export const MAX_AREA_POINTS = 60;

/** "48.1,17.1;48.2,17.2;…" -> [[48.1,17.1],…]; invalid input -> undefined */
export function parseArea(raw: string | undefined): Array<[number, number]> | undefined {
  if (!raw) return undefined;
  const pts: Array<[number, number]> = [];
  for (const pair of raw.split(";").slice(0, MAX_AREA_POINTS)) {
    const [a, b] = pair.split(",").map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return undefined;
    pts.push([Math.round(a * 1e6) / 1e6, Math.round(b * 1e6) / 1e6]);
  }
  return pts.length >= 3 ? pts : undefined;
}

export function serializeArea(area: Array<[number, number]>): string {
  return area.map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).join(";");
}

/** Ray casting; exported for tests and for post-filtering in JS. */
export function pointInArea(lat: number, lng: number, area: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = area.length - 1; i < area.length; j = i++) {
    const [yi, xi] = area[i];
    const [yj, xj] = area[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Read filters from a /properties URL query. */
export function parseListingSearchParams(sp: RawParams): ListingSearchParams {
  const offer = str(sp.offer);
  const typesParam = str(sp.types);
  const types = typesParam
    ? typesParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20)
    : undefined;
  return {
    location: str(sp.location) ?? str(sp.city),
    type: str(sp.type) ?? str(sp.propertyType),
    types,
    offer: offer === "buy" || offer === "rent" ? offer : undefined,
    minPrice: num(sp.minPrice),
    maxPrice: num(sp.maxPrice),
    minArea: num(sp.minArea),
    maxArea: num(sp.maxArea),
    keyword: str(sp.keyword),
    isNewBuild: sp.isNewBuild === "true" ? true : undefined,
    reduced: sp.reduced === "true" ? true : undefined,
    area: parseArea(str(sp.area)),
    page: Math.max(1, Math.floor(num(sp.page) ?? 1)),
  };
}

/** Filters without paging and empty values (what a saved search stores). */
export function filtersForSaving(p: ListingSearchParams): ListingSearchParams {
  const out: ListingSearchParams = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === "page" || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Back to a query string, e.g. for "open this search" links in e-mails. */
export function listingSearchQuery(p: ListingSearchParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filtersForSaving(p))) {
    if (k === "area") q.set(k, serializeArea(v as Array<[number, number]>));
    else q.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  return q.toString();
}
