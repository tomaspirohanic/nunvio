import { prisma } from "@/lib/db";
import { PropertyType } from "@prisma/client";
import SearchLayout from "@/components/properties/SearchLayout";
import { persistPropertyTranslation, translateText } from "@/lib/translate";
import { Language } from "@prisma/client";
import { expireOutdatedPromotions } from "@/lib/promotions.server";
import { comparePromotionThenDate } from "@/lib/listing";

const PAGE_SIZE = 48;

export default async function PropertiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const localeTag = (locale || "en").toLowerCase();
  const primary = localeTag.split("-")[0];
  const legacyLang =
    primary === "de" ? Language.DE : primary === "es" ? Language.ES : Language.EN;

  await expireOutdatedPromotions().catch(() => undefined);

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

  const total = await prisma.property.count({ where });
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
        where: {
          OR: [{ locale: localeTag }, { language: legacyLang }],
        },
        take: 1,
      },
    },
    orderBy: [{ promotionLevel: "desc" }, { createdAt: "desc" }],
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const now = new Date();
  const safeProperties = properties
    .map((p) => ({
      ...p,
      price: Number(p.price),
      featuredUntil: p.featuredUntil ? p.featuredUntil.toISOString() : null,
      isFeatured: p.featuredUntil !== null && p.featuredUntil > now,
    }))
    .sort(comparePromotionThenDate);

  const translatedSafeProperties = await Promise.all(
    safeProperties.map(async (p: any) => {
      const existing = p.translations?.[0];
      const existingTitle = existing?.title ?? existing?.translatedTitle;
      const existingDescription =
        existing?.description ?? existing?.translatedDescription;

      if (existingTitle && existingDescription) {
        return {
          ...p,
          title: existingTitle,
          description: existingDescription,
        };
      }

      if (primary === "sk") return p;

      const title = await translateText({
        text: p.title,
        targetLocale: localeTag,
        cacheKey: `${localeTag}:${p.id}:title`,
      });
      const description = await translateText({
        text: p.description,
        targetLocale: localeTag,
        cacheKey: `${localeTag}:${p.id}:description`,
      });

      await persistPropertyTranslation({
        propertyId: p.id,
        locale: localeTag,
        title,
        description,
      });

      return { ...p, title, description };
    })
  );

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
