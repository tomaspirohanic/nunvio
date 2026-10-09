"use client";

// ============================================
// PROPERTY LIST COMPONENT
// ============================================
// Displays list of properties in a grid
// Uses PropertyTranslation for EN language display
// Supports dynamic currency conversion
// ============================================

import { Currency, PropertyType, PromotionLevel } from "@prisma/client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  convertPrice,
  formatPrice,
  isSupportedCurrency,
  type Currency as CurrencyType,
} from "@/lib/currency";
import AddPropertyButton from "../common/AddPropertyButton";

type PriceLike = number | { toString(): string };

interface Property {
  id: string;
  title: string;
  description: string;
  price: PriceLike;
  currency: Currency;
  city: string;
  country: string;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  promotionLevel: PromotionLevel;
  isFeatured: boolean;
  featuredUntil?: Date | string | null;
  images?: string[];
  translations: Array<{
    translatedTitle: string;
    translatedDescription: string;
  }>;
}

interface PropertyListProps {
  properties: Property[];
}

export default function PropertyList({ properties }: PropertyListProps) {
  const locale = useLocale();
  const t = useTranslations("Properties");
  const [targetCurrency, setTargetCurrency] = useState<CurrencyType>("EUR");

  // Read currency from cookie on mount and listen for changes
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
      const cookieCurrency = getCookie("NEXT_CURRENCY");
      if (isSupportedCurrency(cookieCurrency)) {
        setTargetCurrency(cookieCurrency);
      }
    };

    // Initial load
    updateCurrency();

    // Listen for currency changes (poll every 500ms)
    const interval = setInterval(updateCurrency, 500);

    return () => clearInterval(interval);
  }, []);

  const formatPropertyPrice = (price: PriceLike, originalCurrency: Currency) => {
    const normalized = typeof price === "number" ? price : Number(price.toString());
    
    // Convert to target currency
    const convertedAmount = convertPrice(normalized, originalCurrency, targetCurrency);
    
    // Format with locale
    return formatPrice(convertedAmount, targetCurrency, locale);
  };

  if (properties.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="max-w-md mx-auto">
          <svg
            className="mx-auto h-16 w-16 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {t("noProperties")}
          </h3>
          <p className="text-gray-500 mb-6">
            {t("noProperties")}
          </p>
          <AddPropertyButton variant="primary" size="md">
            {t("beFirst")}
          </AddPropertyButton>
        </div>
      </div>
    );
  }

  // Get promotion badge styling based on level (text-only, no emojis)
  const getPromotionBadge = (level: PromotionLevel, featuredUntil: Date | string | null) => {
    // Check if promotion is active (not NONE and featuredUntil is in the future)
    const featuredUntilDate = featuredUntil 
      ? new Date(featuredUntil) 
      : null;
    const isPromotionActive =
      level !== PromotionLevel.NONE &&
      featuredUntilDate &&
      !isNaN(featuredUntilDate.getTime()) &&
      featuredUntilDate > new Date();

    if (!isPromotionActive) return null;

    switch (level) {
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
          className: "bg-yellow-400 text-yellow-900 shadow-md border border-yellow-500",
          label: "GOLD",
        };
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {properties.map((property) => {
        // Use translation if available, otherwise fall back to original
        const displayTitle =
          property.translations[0]?.translatedTitle || property.title;
        const displayDescription =
          property.translations[0]?.translatedDescription || property.description;

        const promotionBadge = getPromotionBadge(property.promotionLevel, property.featuredUntil);
        
        // Fallback image for properties without images
        const propertyImage = property.images && property.images.length > 0
          ? property.images[0]
          : "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop&q=80";

        // Determine border styling based on promotion level
        const getCardBorderClass = () => {
          if (promotionBadge && property.promotionLevel === PromotionLevel.GOLD) {
            return "border-2 border-yellow-400 shadow-md";
          }
          return "border border-gray-200";
        };

        return (
          <Link
            key={property.id}
            href={`/properties/${property.id}`}
            className={`bg-white rounded-lg overflow-hidden hover:shadow-lg transition-all block ${getCardBorderClass()}`}
          >
            {/* Property Image with Badge */}
            <div className="relative w-full h-48 bg-gray-100">
              <img
                src={propertyImage}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
              {/* Promotion Badge - Top Left */}
              {promotionBadge && (
                <div className="absolute top-2 left-2 z-10">
                  <div
                    className={`px-2 py-1 text-xs font-bold uppercase rounded ${promotionBadge.className}`}
                  >
                    {promotionBadge.label}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">
                  {displayTitle}
                </h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded whitespace-nowrap ml-2">
                  {property.propertyType}
                </span>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {displayDescription}
              </p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-500">
                  <span className="font-medium">{t("location")}:</span>
                  <span className="ml-2">
                    {property.city}, {property.country}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="font-medium text-gray-500">{t("price")}:</span>
                  <span className="ml-2 font-semibold text-gray-900 text-lg">
                    {formatPropertyPrice(property.price, property.currency)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>
                    <span className="font-medium">{t("bedrooms")}:</span> {property.bedrooms}
                  </span>
                  <span>
                    <span className="font-medium">{t("bathrooms")}:</span> {property.bathrooms}
                  </span>
                  <span>
                    <span className="font-medium">{t("area")}:</span> {property.areaSqm} m²
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
