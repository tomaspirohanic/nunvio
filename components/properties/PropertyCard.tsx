/* eslint-disable @next/next/no-img-element */
"use client";

import { Link } from "@/src/i18n/routing";
import {
  convertPrice,
  isSupportedCurrency,
  type Currency as UiCurrency,
} from "@/lib/currency";
import { formatArea, formatCurrency } from "@/lib/formatters";
import { localizeCountryName } from "@/lib/country-display";
import { Bath, BedDouble, Square } from "lucide-react";
import { PromotionLevel } from "@prisma/client";
import type { Currency, ListingOffer, PropertyType } from "@prisma/client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export type FeaturedProperty = {
  id: string;
  title: string;
  description: string;
  price: number | { toString(): string };
  currency: Currency;
  city: string;
  country: string;
  propertyType: PropertyType;
  offerType?: ListingOffer;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  images?: string[];
  promotionLevel: PromotionLevel;
  featuredUntil: Date | string | null;
  translations?: Array<{
    translatedTitle: string;
    translatedDescription: string;
  }>;
};

function getPromotionBadge(
  promotionLevel: PromotionLevel,
  featuredUntil: Date | string | null
) {
  const featuredUntilDate = featuredUntil ? new Date(featuredUntil) : null;
  const isPromotionActive =
    promotionLevel !== PromotionLevel.NONE &&
    featuredUntilDate &&
    !isNaN(featuredUntilDate.getTime()) &&
    featuredUntilDate > new Date();

  if (!isPromotionActive) return null;

  switch (promotionLevel) {
    case PromotionLevel.BRONZE:
      return {
        className: "bg-orange-100 text-orange-800 border border-orange-300",
        label: "BRONZE",
      };
    case PromotionLevel.SILVER:
      return {
        className: "bg-slate-200 text-slate-800 border border-slate-400",
        label: "SILVER",
      };
    case PromotionLevel.GOLD:
      return {
        className:
          "bg-yellow-400 text-yellow-900 shadow-md border border-yellow-500",
        label: "GOLD",
      };
    default:
      return null;
  }
}

export default function PropertyCard({
  property,
  locale,
}: {
  property: FeaturedProperty;
  locale: string;
  /** @deprecated Use internal useTranslations — kept optional for older call sites. */
  tProperties?: (key: string) => string;
}) {
  const t = useTranslations("Properties");
  const [targetCurrency, setTargetCurrency] = useState<UiCurrency>("EUR");
  const [units, setUnits] = useState<string>("metric");

  useEffect(() => {
    function getCookie(name: string): string | null {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(";").shift() || null;
      }
      return null;
    }

    const updateCurrency = () => {
      const cookieCurrency =
        getCookie("NEXT_CURRENCY_OVERRIDE") ?? getCookie("NEXT_CURRENCY");
      if (isSupportedCurrency(cookieCurrency)) {
        setTargetCurrency(cookieCurrency);
      }
      const u = getCookie("NEXT_UNITS_OVERRIDE") ?? getCookie("NEXT_UNITS");
      if (u) setUnits(u);
    };

    updateCurrency();
    const interval = setInterval(updateCurrency, 500);
    return () => clearInterval(interval);
  }, []);

  const featuredUntilDate = property.featuredUntil
    ? new Date(property.featuredUntil)
    : null;

  const isPromotionActive =
    !!featuredUntilDate &&
    !isNaN(featuredUntilDate.getTime()) &&
    featuredUntilDate > new Date();

  const statusLabel = isPromotionActive
    ? t("statusActive")
    : null;

  const promotionBadge = getPromotionBadge(
    property.promotionLevel,
    property.featuredUntil
  );

  const propertyImage =
    property.images && property.images.length > 0
      ? property.images[0]
      : "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop&q=80";

  const priceNumber =
    typeof property.price === "number"
      ? property.price
      : Number(property.price.toString());

  const formattedPrice = formatCurrency(
    priceNumber,
    property.currency,
    targetCurrency,
    locale === "sk" ? "sk-SK" : locale === "de" ? "de-DE" : locale
  );

  const displayCountry = localizeCountryName(property.country, locale);

  const displayTitle =
    property.translations && property.translations.length > 0
      ? property.translations[0].translatedTitle
      : property.title;

  return (
    <Link
      href={`/properties/${property.id}`}
      className="w-full bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow block"
    >
      <div className="relative w-full h-56 md:h-60 bg-gray-100">
        <img
          src={propertyImage}
          alt={property.title}
          className="w-full h-full object-cover"
        />

        {promotionBadge && (
          <div className="absolute top-3 left-3 z-10">
            <div
              className={`px-3 py-1 text-xs font-bold uppercase rounded ${promotionBadge.className}`}
            >
              {promotionBadge.label}
            </div>
          </div>
        )}
      </div>

      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-gray-900 leading-tight">
              {formattedPrice}
              {property.offerType === "RENT" ? (
                <span className="text-base font-medium text-gray-500"> /mes</span>
              ) : null}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {property.offerType === "RENT" ? t("forRent") : t("forSale")}
            </div>
            {statusLabel && (
              <div className="mt-1 text-sm font-bold text-green-600">
                {statusLabel}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-gray-600 text-sm font-medium">
          {property.city}, {displayCountry}
        </div>

        <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
          <span className="inline-flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-gray-800">{property.bedrooms}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <Bath className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-gray-800">{property.bathrooms}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <Square className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-gray-800">
              {formatArea(property.areaSqm, units, locale)}
            </span>
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-sm font-semibold text-gray-900 line-clamp-1">
            {displayTitle}
          </div>
        </div>
      </div>
    </Link>
  );
}

