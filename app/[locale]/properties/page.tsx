import SearchLayout from "@/components/properties/SearchLayout";
import { comparePromotionThenDate } from "@/lib/listing";
import { normalizeLocale, pickListingText } from "@/lib/listing-text";
import { SEARCH_PAGE_SIZE, searchListings } from "@/lib/listing-search.server";
import { parseListingSearchParams } from "@/lib/listing-search-params";

export default async function PropertiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const localeTag = normalizeLocale(locale);

  const filters = parseListingSearchParams(sp);
  const {
    location,
    type: typeParam,
    types,
    offer,
    keyword,
    isNewBuild,
    reduced,
  } = filters;

  const { total, totalIsCapped, pageCount, safePage, rows } = await searchListings(
    filters,
    localeTag
  );

  const now = new Date();
  const translatedSafeProperties = rows
    .map((p) => {
      const text = pickListingText(p, p.translations?.[0]);
      const featuredUntil = p.featuredUntil ? new Date(p.featuredUntil) : null;
      return {
        ...p,
        ...text,
        createdAt: new Date(p.createdAt),
        featuredUntil: featuredUntil ? featuredUntil.toISOString() : null,
        isFeatured: featuredUntil !== null && featuredUntil > now,
      };
    })
    .sort(comparePromotionThenDate);

  const paged = translatedSafeProperties;

  const place = typeof sp.place === "string" && !location ? sp.place.slice(0, 120) : undefined;
  const initialParams = {
    location,
    place: place && filters.bbox ? place : undefined,
    placeBbox: place && filters.bbox ? filters.bbox : undefined,
    offer,
    types: types ?? (typeParam ? [typeParam.toLowerCase()] : undefined),
    minPrice: typeof sp.minPrice === "string" ? sp.minPrice : undefined,
    maxPrice: typeof sp.maxPrice === "string" ? sp.maxPrice : undefined,
    minArea: typeof sp.minArea === "string" ? sp.minArea : undefined,
    maxArea: typeof sp.maxArea === "string" ? sp.maxArea : undefined,
    keyword,
    isNewBuild: isNewBuild ? true : undefined,
    reduced: reduced ? true : undefined,
    page: String(safePage),
  } satisfies Parameters<typeof SearchLayout>[0]["initialParams"];

  return (
    <SearchLayout
      properties={paged as any}
      initialParams={initialParams}
      locale={locale}
      pagination={{
        page: safePage,
        pageSize: SEARCH_PAGE_SIZE,
        total,
        totalIsCapped,
        pageCount,
      }}
    />
  );
}
