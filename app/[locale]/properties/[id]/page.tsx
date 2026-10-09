// ============================================
// PUBLIC PROPERTY DETAIL PAGE
// ============================================
// Public page - no authentication required
// Displays detailed information about a single property
// Uses PropertyTranslation for EN language display
// ============================================

import { prisma } from "@/lib/db";
import { Language, PromotionLevel } from "@prisma/client";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PropertyPrice from "@/components/properties/PropertyPrice";
import PropertyDetailMapClient from "@/components/properties/PropertyDetailMapClient";
import PropertyGallery from "@/components/properties/PropertyGallery";
import ContactBox from "@/components/properties/ContactBox";
import AreaValue from "@/components/common/AreaValue";
import { persistPropertyTranslation, translateText } from "@/lib/translate";
import { resolvePropertyImageUrls } from "@/lib/property-gallery";

async function getPropertyForPublicDetail(
  id: unknown,
  localeTag: string,
  legacyLang: Language
) {
  try {
    if (typeof id !== "string" || id.trim().length === 0) {
      return null;
    }

    const property = await prisma.property.findFirst({
      where: {
        id: id.trim(),
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        currency: true,
        city: true,
        country: true,
        address: true,
        latitude: true,
        longitude: true,
        showOnMap: true,
        bedrooms: true,
        bathrooms: true,
        areaSqm: true,
        propertyType: true,
        offerType: true,
        contactPhone: true,
        images: true,
        propertyImages: {
          orderBy: { order: "asc" },
          select: { url: true, order: true },
        },
        promotionLevel: true,
        featuredUntil: true,
        createdAt: true,
        owner: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
        agency: {
          select: {
            id: true,
            name: true,
            city: true,
            country: true,
            phone: true,
            email: true,
            logoUrl: true,
            website: true,
          },
        },
        translations: {
          where: {
            OR: [{ locale: localeTag }, { language: legacyLang }],
          },
          take: 1,
        },
      },
    });

    if (!property) return null;

    return {
      ...property,
      price: Number(property.price),
      bedrooms:
        typeof property.bedrooms === "number" && !isNaN(property.bedrooms)
          ? property.bedrooms
          : 0,
      bathrooms:
        typeof property.bathrooms === "number" && !isNaN(property.bathrooms)
          ? property.bathrooms
          : 0,
      areaSqm:
        typeof property.areaSqm === "number" && !isNaN(property.areaSqm)
          ? property.areaSqm
          : 0,
    };
  } catch (error) {
    console.error("getPropertyForPublicDetail failed:", error);
    return null;
  }
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const localeTag = (locale || "en").toLowerCase();
  const primary = localeTag.split("-")[0];
  const legacyLang =
    primary === "de" ? Language.DE : primary === "es" ? Language.ES : Language.EN;
  const property = await getPropertyForPublicDetail(id, localeTag, legacyLang);

  if (!property) {
    return {
      title: "Property Not Found | Nunvio",
    };
  }

  // Use translation if available, otherwise fall back to original
  const title =
    property.translations[0]?.title ||
    property.translations[0]?.translatedTitle ||
    property.title;
  const description =
    property.translations[0]?.description ||
    property.translations[0]?.translatedDescription ||
    property.description;
  const location = property.address
    ? `${property.address}, ${property.country}`
    : `${property.city}, ${property.country}`;

  // Simple price formatting for metadata (no conversion needed)
  const priceFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: property.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(property.price);

  return {
    title: `${title} - ${location} | Nunvio`,
    description: `${description.substring(0, 160)}... Location: ${location}. Price: ${priceFormatted}.`,
  };
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const localeTag = (locale || "en").toLowerCase();
  const primary = localeTag.split("-")[0];
  const legacyLang =
    primary === "de" ? Language.DE : primary === "es" ? Language.ES : Language.EN;
  const property = await getPropertyForPublicDetail(id, localeTag, legacyLang);

  if (!property) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "PropertyDetail" });

  // Use DB translation if available; otherwise translate, persist, and use result.
  const existing = property.translations?.[0];
  const baseTitle =
    existing?.title || existing?.translatedTitle || property.title;
  const baseDescription =
    existing?.description || existing?.translatedDescription || property.description;

  const shouldTranslate =
    primary !== "sk" && (!existing?.title || !existing?.description);
  const displayTitle = shouldTranslate
    ? await translateText({
        text: property.title,
        targetLocale: localeTag,
        cacheKey: `${localeTag}:${property.id}:detail:title`,
      })
    : baseTitle;

  const displayDescription = shouldTranslate
    ? await translateText({
        text: property.description,
        targetLocale: localeTag,
        cacheKey: `${localeTag}:${property.id}:detail:description`,
      })
    : baseDescription;

  if (shouldTranslate) {
    await persistPropertyTranslation({
      propertyId: property.id,
      locale: localeTag,
      title: displayTitle,
      description: displayDescription,
    });
  }

  const featuredUntilDate = property.featuredUntil
    ? new Date(property.featuredUntil)
    : null;
  const isPromotionActive =
    property.promotionLevel !== PromotionLevel.NONE &&
    featuredUntilDate &&
    !isNaN(featuredUntilDate.getTime()) &&
    featuredUntilDate > new Date();

  const promotionBadge =
    isPromotionActive && property.promotionLevel !== PromotionLevel.NONE
      ? property.promotionLevel === PromotionLevel.GOLD
        ? {
            className:
              "bg-yellow-400 text-yellow-950 border border-yellow-500 shadow-sm",
            label: "GOLD",
          }
        : property.promotionLevel === PromotionLevel.SILVER
          ? {
              className:
                "bg-slate-200 text-slate-900 border border-slate-300 shadow-sm",
              label: "SILVER",
            }
          : {
              className:
                "bg-orange-100 text-orange-900 border border-orange-200 shadow-sm",
              label: "BRONZE",
            }
      : null;

  const addressLine = property.address
    ? `${property.address}${property.country ? `, ${property.country}` : ""}`
    : `${property.city}, ${property.country}`;
  const contactBoxProperty = {
    id: property.id,
    title: displayTitle,
    price: property.price,
    currency: property.currency,
    contactPhone: property.contactPhone,
  };

  const contactAgency = property.agency
    ? {
        id: property.agency.id,
        name: property.agency.name,
        city: property.agency.city,
        country: property.agency.country,
        phone: property.agency.phone,
        email: property.agency.email,
        logoUrl: property.agency.logoUrl,
        website: property.agency.website,
      }
    : null;

  const contactOwner = property.owner
    ? {
        name: property.owner.name,
        phone: property.owner.phone,
        email: property.owner.email,
      }
    : null;

  const galleryImages = resolvePropertyImageUrls(property);

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <PropertyGallery images={galleryImages} />

        {/* Header */}
        <div className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-gray-950 tracking-tight">
                {displayTitle}
              </h1>
              <div className="mt-2 flex items-center gap-2 text-gray-500">
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="truncate">{addressLine}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">
                {property.offerType === "RENT" ? t("forRent") : t("forSale")}
              </span>
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">
                {property.propertyType}
              </span>
              {promotionBadge && (
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${promotionBadge.className}`}
                >
                  {promotionBadge.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-8 pb-16">
          {/* Left column */}
          <div className="lg:col-span-2">
            {/* Key features */}
            <div className="flex flex-wrap gap-6 rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <span className="text-sm font-semibold text-gray-700">🛏</span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">{t("beds")}</div>
                  <div className="text-lg font-semibold text-gray-950">
                    {property.bedrooms}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <span className="text-sm font-semibold text-gray-700">🛁</span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">{t("baths")}</div>
                  <div className="text-lg font-semibold text-gray-950">
                    {property.bathrooms}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <span className="text-sm font-semibold text-gray-700">㎡</span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">{t("area")}</div>
                  <div className="text-lg font-semibold text-gray-950">
                    <AreaValue areaSqm={property.areaSqm} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <span className="text-sm font-semibold text-gray-700">🏠</span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">{t("type")}</div>
                  <div className="text-lg font-semibold text-gray-950">
                    {property.propertyType}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-gray-950">
                {t("descriptionTitle")}
              </h2>
              <p className="text-gray-700 leading-relaxed mt-6 whitespace-pre-wrap">
                {displayDescription}
              </p>
            </div>

            {/* Map */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-gray-950">{t("locationTitle")}</h2>
              <div className="mt-4 relative z-0">
                {property.latitude && property.longitude ? (
                  <PropertyDetailMapClient
                    latitude={property.latitude}
                    longitude={property.longitude}
                    price={property.price}
                    currency={property.currency}
                    showOnMap={property.showOnMap ?? true}
                  />
                ) : (
                  <div className="w-full h-[360px] rounded-2xl border border-gray-200 bg-gray-100 flex items-center justify-center">
                    <div className="text-center px-6">
                      <div className="text-gray-700 font-semibold">
                        {t("mapUnavailableTitle")}
                      </div>
                      <div className="text-gray-500 mt-1">
                        {t("mapUnavailableDesc")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-1">
            <ContactBox
              property={contactBoxProperty}
              agency={contactAgency}
              owner={contactOwner}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
