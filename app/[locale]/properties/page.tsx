import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { PropertyType } from "@prisma/client";
import SearchLayout from "@/components/properties/SearchLayout";
import { comparePromotionThenDate } from "@/lib/listing";
import {
  normalizeLocale,
  pickListingText,
  translationWhereForLocale,
} from "@/lib/listing-text";
import { LISTINGS_CACHE_TAG } from "@/lib/revalidate-listings";

const PAGE_SIZE = 48;
const MAX_COUNTED_RESULTS = 10_000;

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

  const where: any = {
    status: "PUBLISHED",
  };

  if (location) {
    where.OR = [
      { city: { contains: location, mode: "insensitive" } },
      { country: { contains: location, mode: "insensitive" } },
    ];
  }

  const mappedPropertyTypes = new Set<PropertyType>();
  if (typesParam) {
    const parts = typesParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      if (p.startsWith("flat_")) mappedPropertyTypes.add(PropertyType.APARTMENT);
      if (p.startsWith("house_")) mappedPropertyTypes.add(PropertyType.HOUSE);
      if (p.startsWith("land_")) mappedPropertyTypes.add(PropertyType.LAND);
      if (p.startsWith("commercial_")) mappedPropertyTypes.add(PropertyType.COMMERCIAL);
    }
  }
  if (mappedPropertyTypes.size > 0) {
    where.propertyType = { in: Array.from(mappedPropertyTypes) };
  } else if (typeParam) {
    const normalized = typeParam.toUpperCase();
    if ((Object.values(PropertyType) as string[]).includes(normalized)) {
      where.propertyType = normalized as PropertyType;
    }
  }

  if (offer === "buy") where.offerType = "SALE";
  else if (offer === "rent") where.offerType = "RENT";

  if (minArea !== undefined || maxArea !== undefined) {
    where.areaSqm = {};
    if (minArea !== undefined) where.areaSqm.gte = Math.floor(minArea);
    if (maxArea !== undefined) where.areaSqm.lte = Math.floor(maxArea);
  }

  if (isNewBuild) where.isNewBuild = true;

  if (keyword) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { title: { contains: keyword, mode: "insensitive" } },
          { description: { contains: keyword, mode: "insensitive" } },
        ],
      },
    ];
  }

  // Price filter in DB (listing currency). Safe at 100k; avoids loading whole catalog.
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price.gte = minPrice;
    if (maxPrice !== undefined) where.price.lte = maxPrice;
  }

  // Identical searches (same filters + page + locale) share one cached DB
  // result for 60 s. Any listing change calls revalidateListings() which
  // drops this cache immediately (tag: LISTINGS_CACHE_TAG).
  const { total, safePage, rows } = await getCachedSearch(
    JSON.stringify(where),
    page,
    localeTag
  );
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        pageSize: PAGE_SIZE,
        total,
        pageCount,
      }}
    />
  );
}

const getCachedSearch = unstable_cache(
  async (whereJson: string, page: number, localeTag: string) => {
    const where = JSON.parse(whereJson);
    // Free-text keyword can match a large share of listings; counting them all
    // is the slowest part of the query, so stop counting at 10 000.
    const total = await prisma.property.count({
      where,
      ...(where.AND ? { take: MAX_COUNTED_RESULTS } : {}),
    });
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, pageCount);

    const properties = await prisma.property.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        currency: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        showOnMap: true,
        bedrooms: true,
        bathrooms: true,
        areaSqm: true,
        propertyType: true,
        offerType: true,
        images: true,
        promotionLevel: true,
        featuredUntil: true,
        createdAt: true,
        translations: {
          where: translationWhereForLocale(localeTag),
          select: {
            title: true,
            description: true,
            translatedTitle: true,
            translatedDescription: true,
          },
          take: 1,
        },
      },
      orderBy: [{ promotionLevel: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    // Plain JSON only (Decimal / Date are not cache-serializable as-is).
    const rows = properties.map((p) => ({
      ...p,
      price: Number(p.price),
      createdAt: p.createdAt.toISOString(),
      featuredUntil: p.featuredUntil ? p.featuredUntil.toISOString() : null,
    }));

    return { total, safePage, rows };
  },
  ["public-property-search-v1"],
  { revalidate: 60, tags: [LISTINGS_CACHE_TAG] }
);
