import Hero from "@/components/home/Hero";
import FeaturedProperties from "@/components/home/FeaturedProperties";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { PromotionLevel } from "@prisma/client";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const propertyCount = await prisma.property.count({
    where: { status: "PUBLISHED" },
  });

  const tHome = await getTranslations("Home");

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
      images: true,
      promotionLevel: true,
      featuredUntil: true,
      bedrooms: true,
      bathrooms: true,
      areaSqm: true,
      createdAt: true,
    },
    orderBy: [{ promotionLevel: "desc" }, { createdAt: "desc" }],
    take: 12,
  });

  const promoted = promotedRaw.slice(0, 4).map((p) => ({
    ...p,
    price: Number(p.price.toString()),
  }));

  return (
    <div className="bg-white w-full min-h-screen">
      <Hero propertyCount={propertyCount} />
      <section className="w-full bg-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <FeaturedProperties
            title={tHome("featuredTitle")}
            locale={locale}
            properties={promoted}
          />
        </div>
      </section>
    </div>
  );
}
