"use client";

// ============================================
// PROPERTY FILTERS COMPONENT
// ============================================
// Client component for filtering properties
// Uses URL search params for state management
// ============================================

import { PropertyType, Currency } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/src/i18n/routing";
import { useTranslations } from "next-intl";
import { useState } from "react";
import CityAutocomplete from "../ui/CityAutocomplete";

interface PropertyFiltersProps {
  initialFilters: {
    city?: string;
    country?: string;
    propertyType?: PropertyType;
    minPrice?: number;
    maxPrice?: number;
    currency?: Currency;
  };
}

export default function PropertyFilters({ initialFilters }: PropertyFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("Filters");
  const tPropertyTypes = useTranslations("PropertyTypes");

  const [filters, setFilters] = useState({
    city: initialFilters.city || "",
    country: initialFilters.country || "",
    propertyType: initialFilters.propertyType || "",
    minPrice: initialFilters.minPrice?.toString() || "",
    maxPrice: initialFilters.maxPrice?.toString() || "",
    currency: initialFilters.currency || "",
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "") {
        params.set(key, value);
      }
    });

    router.push(`/properties?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      city: "",
      country: "",
      propertyType: "",
      minPrice: "",
      maxPrice: "",
      currency: "",
    });
    router.push("/properties");
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {t("clear")}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* City Filter with Autocomplete */}
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
            {t("city")}
          </label>
          <CityAutocomplete
            id="city"
            value={filters.city}
            onChange={(value) => handleFilterChange("city", value)}
            placeholder={t("cityPlaceholder")}
          />
        </div>

        {/* Country Filter */}
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
            {t("country")}
          </label>
          <input
            type="text"
            id="country"
            value={filters.country}
            onChange={(e) => handleFilterChange("country", e.target.value)}
            placeholder={t("countryPlaceholder")}
            className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Property Type Filter */}
        <div>
          <label htmlFor="propertyType" className="block text-sm font-medium text-gray-700 mb-1">
            {t("propertyType")}
          </label>
          <select
            id="propertyType"
            value={filters.propertyType}
            onChange={(e) => handleFilterChange("propertyType", e.target.value)}
            className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t("allTypes")}</option>
            <option value={PropertyType.HOUSE}>{tPropertyTypes("HOUSE")}</option>
            <option value={PropertyType.APARTMENT}>{tPropertyTypes("APARTMENT")}</option>
            <option value={PropertyType.LAND}>{tPropertyTypes("LAND")}</option>
            <option value={PropertyType.COMMERCIAL}>{tPropertyTypes("COMMERCIAL")}</option>
          </select>
        </div>

        {/* Currency Filter */}
        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
            {t("currency")}
          </label>
          <select
            id="currency"
            value={filters.currency}
            onChange={(e) => handleFilterChange("currency", e.target.value)}
            className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t("allCurrencies")}</option>
            <option value={Currency.EUR}>EUR (€)</option>
            <option value={Currency.USD}>USD ($)</option>
            <option value={Currency.GBP}>GBP (£)</option>
          </select>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("priceRange")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="number"
                id="minPrice"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange("minPrice", e.target.value)}
                placeholder={t("min")}
                min="0"
                className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <input
                type="number"
                id="maxPrice"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
                placeholder={t("max")}
                min="0"
                className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Apply Filters Button */}
        <button
          onClick={applyFilters}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t("applyFilters")}
        </button>
      </div>
    </div>
  );
}
