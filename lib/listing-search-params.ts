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
    q.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  return q.toString();
}
