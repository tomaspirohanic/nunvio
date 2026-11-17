import SearchLayout from "@/components/properties/SearchLayout";
import { comparePromotionThenDate } from "@/lib/listing";
import { normalizeLocale, pickListingText } from "@/lib/listing-text";
import { SEARCH_PAGE_SIZE, searchListings } from "@/lib/listing-search.server";

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

  const getString = (v: string | string[] | undefined) =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

  const getNumber = (v: string | string[] | undefined) => {
    if (typeof v !== "string") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const location = getString(sp.location) ?? getString(sp.city);
  const typeParam = getString(sp.type) ?? getString(sp.propertyType);
  const typesParam = getString(sp.types);
  const offer = getString(sp.offer);
  const minPrice = getNumber(sp.minPrice);
  const maxPrice = getNumber(sp.maxPrice);
  const minArea = getNumber(sp.minArea);
  const maxArea = getNumber(sp.maxArea);
  const keyword = getString(sp.keyword);
  const page = Math.max(1, Math.floor(getNumber(sp.page) ?? 1));
  const isNewBuild = sp.isNewBuild === "true";

  const types = typesParam
    ? typesParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const { total, totalIsCapped, pageCount, safePage, rows } = await searchListings(
    {
      location,
      type: typeParam,
      types,
      offer: offer === "buy" || offer === "rent" ? offer : undefined,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      keyword,
      isNewBuild,
      page,
    },
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

  const initialParams = {
    location,
    offer: offer === "buy" || offer === "rent" ? (offer as "buy" | "rent") : undefined,
    types:
      (typesParam
        ? typesParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : typeParam
          ? [typeParam.toLowerCase()]
          : undefined) ?? undefined,
    minPrice: typeof sp.minPrice === "string" ? sp.minPrice : undefined,
    maxPrice: typeof sp.maxPrice === "string" ? sp.maxPrice : undefined,
    minArea: typeof sp.minArea === "string" ? sp.minArea : undefined,
    maxArea: typeof sp.maxArea === "string" ? sp.maxArea : undefined,
    keyword: typeof sp.keyword === "string" ? sp.keyword : undefined,
    isNewBuild: isNewBuild ? true : undefined,
    hasVideo: undefined,
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
