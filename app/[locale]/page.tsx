import Hero from "@/components/home/Hero";
import FeaturedProperties from "@/components/home/FeaturedProperties";
import { prisma } from "@/lib/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PromotionLevel } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { LISTINGS_CACHE_TAG } from "@/lib/revalidate-listings";

// Rendered per request (cheap: the DB work is cached in getHomeData) so the
// build never needs a database connection. The data is cached for 5 minutes
// and dropped immediately when listings change (revalidateListings).
export const dynamic = "force-dynamic";

const getHomeData = unstable_cache(
  async () => {
    const propertyCount = await prisma.property.count({
      where: { status: "PUBLISHED" },
    });
    const promotedRaw = await prisma.property.findMany({
      where: {
        status: "PUBLISHED",
        promotionLevel: { not: PromotionLevel.NONE },
        featuredUntil: { gt: new Date() },
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        currency: true,
        city: true,
        country: true,
        propertyType: true,
        offerType: true,
        images: true,
        promotionLevel: true,
        featuredUntil: true,
        bedrooms: true,
        bathrooms: true,
        areaSqm: true,
        createdAt: true,
      },
      orderBy: [{ promotionLevel: "desc" }, { createdAt: "desc" }],
      take: 4,
    });
    // No paid promotions yet: show the newest listings instead of an empty
    // carousel (the section title changes accordingly).
    const isLatest = promotedRaw.length === 0;
    const listRaw = isLatest
      ? await prisma.property.findMany({
          where: { status: "PUBLISHED" },
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            currency: true,
            city: true,
            country: true,
            propertyType: true,
            offerType: true,
            images: true,
            promotionLevel: true,
            featuredUntil: true,
            bedrooms: true,
            bathrooms: true,
            areaSqm: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : promotedRaw;
    // Plain JSON only (Decimal / Date are not cache-serializable as-is).
    const promoted = listRaw.map((p) => ({
      ...p,
      price: Number(p.price.toString()),
      createdAt: p.createdAt.toISOString(),
      featuredUntil: p.featuredUntil ? p.featuredUntil.toISOString() : null,
    }));
    return { propertyCount, promoted, isLatest };
  },
  ["home-data-v2"],
  { revalidate: 300, tags: [LISTINGS_CACHE_TAG] }
);

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tHome = await getTranslations("Home");
  const data = await getHomeData();
  const promoted = data.promoted.map((p) => ({
    ...p,
    createdAt: new Date(p.createdAt),
    featuredUntil: p.featuredUntil ? new Date(p.featuredUntil) : null,
  }));

  return (
    <div className="bg-white w-full min-h-screen">
      <Hero propertyCount={data.propertyCount} />
      <section className="w-full bg-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <FeaturedProperties
            title={tHome(data.isLatest ? "latestTitle" : "featuredTitle")}
            showAllLabel={tHome("showAll")}
            locale={locale}
            properties={promoted}
          />
        </div>
      </section>
    </div>
  );
}
