"use client";

// ============================================
// HERO SEARCH COMPONENT
// ============================================
// Horizontal search bar floating over Hero image
// Zillow/Airbnb style with filters and advanced options
// ============================================

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PropertyType } from "@prisma/client";
import AdvancedFilterModal from "./AdvancedFilterModal";

type OfferType = "buy" | "rent" | "";

interface SearchFilters {
  city: string;
  offer: OfferType;
  propertyType: PropertyType | "";
  isNewBuild: boolean;
  minPrice: string;
  maxPrice: string;
  minArea: string;
  maxArea: string;
  keyword: string;
}

export default function HeroSearch() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Search");
  const tPropertyTypes = useTranslations("PropertyTypes");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"offer" | "what" | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const whereContainerRef = useRef<HTMLDivElement>(null);
  const whereInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    city: "",
    offer: "",
    propertyType: "",
    isNewBuild: false,
    minPrice: "",
    maxPrice: "",
    minArea: "",
    maxArea: "",
    keyword: "",
  });

  const handleSearch = () => {
    const params = new URLSearchParams();

    // Results page expects: location, offer, type
    if (filters.city) params.set("location", filters.city);
    if (filters.offer) params.set("offer", filters.offer);
    if (filters.propertyType)
      params.set("type", String(filters.propertyType).toLowerCase());
    if (filters.isNewBuild) params.set("isNewBuild", "true");
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.minArea) params.set("minArea", filters.minArea);
    if (filters.maxArea) params.set("maxArea", filters.maxArea);
    if (filters.keyword) params.set("keyword", filters.keyword);

    router.push(`/${locale}/properties?${params.toString()}`);
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const query = filters.city.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&format=json&addressdetails=1&limit=5`
        );

        if (!response.ok) {
          throw new Error(`Nominatim request failed: ${response.status}`);
        }

        const data = await response.json();
        const raw = Array.isArray(data) ? data : [];

        // SAFE DEDUPE: keep first occurrence of each exact display_name
        const uniqueResults = Array.from(
          new Map(raw.map((item: any) => [item.display_name, item])).values()
        ).slice(0, 5);

        setSuggestions(uniqueResults);
        setShowDropdown(true);
      } catch (error) {
        console.error("City autocomplete error:", error);
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters.city]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBarRef.current && !searchBarRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: any) => {
    const selectedCity =
      suggestion?.address?.city ||
      suggestion?.address?.town ||
      suggestion?.address?.village ||
      suggestion?.name ||
      suggestion?.display_name ||
      "";

    handleFilterChange("city", selectedCity);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const clearFilters = () => {
    setFilters({
      city: "",
      offer: "",
      propertyType: "",
      isNewBuild: false,
      minPrice: "",
      maxPrice: "",
      minArea: "",
      maxArea: "",
      keyword: "",
    });
  };

  const hasAdvancedFilters = filters.isNewBuild || filters.minPrice || filters.maxPrice || filters.minArea || filters.maxArea || filters.keyword;
  const offerValueLabel = filters.offer ? t(filters.offer) : t("offerPlaceholder");
  const whatValueLabel = filters.propertyType ? tPropertyTypes(filters.propertyType) : t("whatPlaceholder");

  const offerOptions: Array<{ value: OfferType; label: string; subtext: string }> = [
    { value: "buy", label: t("buy"), subtext: t("buySubtext") },
    { value: "rent", label: t("rent"), subtext: t("rentSubtext") },
  ];

  const whatOptions: Array<{ value: PropertyType; label: string; subtext: string }> = [
    { value: PropertyType.HOUSE, label: tPropertyTypes("HOUSE"), subtext: t("houseSubtext") },
    { value: PropertyType.APARTMENT, label: tPropertyTypes("APARTMENT"), subtext: t("apartmentSubtext") },
    { value: PropertyType.COMMERCIAL, label: tPropertyTypes("COMMERCIAL"), subtext: t("commercialSubtext") },
    { value: PropertyType.LAND, label: tPropertyTypes("LAND"), subtext: t("landSubtext") },
  ];

  return (
    <>
      {/* Horizontal Search Bar */}
      <div
        ref={searchBarRef}
        className="w-full max-w-6xl mx-auto bg-white rounded-2xl md:rounded-full shadow-lg border border-gray-200 p-4 md:p-3"
      >
        <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-stretch md:items-center">
          {/* Where: City Autocomplete */}
          <div
            ref={whereContainerRef}
            className="relative flex items-center px-3 py-2 gap-2 w-full md:w-auto md:flex-[2] md:min-w-[200px] cursor-pointer hover:bg-gray-50 rounded-lg min-h-12 border-b border-gray-100 md:border-b-0"
            onClick={() => {
              whereInputRef.current?.focus();
              setActiveDropdown(null);
            }}
          >
            <svg className="w-4 h-4 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 6-7.5 11-7.5 11s-7.5-5-7.5-11a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="font-bold text-sm text-gray-900 whitespace-nowrap">{t("whereLabel")}</span>
            <input
              ref={whereInputRef}
              type="text"
              value={filters.city}
              onChange={(e) => handleFilterChange("city", e.target.value)}
              onFocus={() => setShowDropdown(suggestions.length > 0)}
              placeholder={t("wherePlaceholder")}
              className="bg-transparent outline-none border-0 w-full text-sm text-gray-600 placeholder-gray-400 placeholder:text-sm"
            />
            {showDropdown && (suggestions.length > 0 || isSearching) && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white shadow-xl rounded-xl max-h-72 overflow-y-auto border border-gray-200 p-2">
                <div className="text-sm font-bold text-gray-500 mb-2 px-2">{t("locationHeader")}</div>
                <ul>
                {isSearching && suggestions.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-gray-500">{t("loadingSuggestions")}</li>
                ) : (
                  suggestions.map((suggestion) => (
                    <li
                      key={suggestion.place_id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded-lg border-b border-gray-100 last:border-b-0"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 6-7.5 11-7.5 11s-7.5-5-7.5-11a7.5 7.5 0 1115 0z" />
                        </svg>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-gray-800 truncate">
                          {String(suggestion.display_name).split(",")[0]}
                        </span>
                        <span className="text-xs text-gray-500 truncate">
                          {String(suggestion.display_name).split(",").slice(1).join(",").trim()}
                        </span>
                      </div>
                    </li>
                  ))
                )}
                </ul>
              </div>
            )}
          </div>
          <div className="hidden md:block h-8 border-l border-gray-300" />

          {/* Offer: Buy/Rent */}
          <div
            className="relative flex items-center px-3 py-2 gap-2 w-full md:w-auto md:flex-[1] md:min-w-[140px] cursor-pointer hover:bg-gray-50 rounded-lg min-h-12 border-b border-gray-100 md:border-b-0"
            onClick={() => {
              setActiveDropdown((prev) => (prev === "offer" ? null : "offer"));
              setShowDropdown(false);
            }}
          >
            <svg className="w-4 h-4 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12V8a2 2 0 00-2-2h-4l-2-2H8a2 2 0 00-2 2v2m14 4v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4m16 0l-2.5 4.5a2 2 0 01-1.74 1H8.24a2 2 0 01-1.74-1L4 12" />
            </svg>
            <span className="font-bold text-sm text-gray-900 whitespace-nowrap shrink-0">{t("offerLabel")}</span>
            <span className="w-full text-sm text-gray-600 truncate">{offerValueLabel}</span>

            {activeDropdown === "offer" && (
              <div className="absolute left-0 top-full z-50 bg-white rounded-xl shadow-2xl w-72 p-2 mt-2 border border-gray-200">
                {offerOptions.map((option) => {
                  const isSelected = filters.offer === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFilterChange("offer", option.value);
                        setActiveDropdown(null);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 text-sm">{option.label}</span>
                          <span className="text-xs text-gray-500">{option.subtext}</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border ${isSelected ? "border-red-600 bg-red-600" : "border-gray-300 bg-white"}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="hidden md:block h-8 border-l border-gray-300" />

          {/* What: Property Type */}
          <div
            className="relative flex items-center px-3 py-2 gap-2 w-full md:w-auto md:flex-[1.5] md:min-w-[220px] cursor-pointer hover:bg-gray-50 rounded-lg min-h-12 border-b border-gray-100 md:border-b-0"
            onClick={() => {
              setActiveDropdown((prev) => (prev === "what" ? null : "what"));
              setShowDropdown(false);
            }}
          >
            <svg className="w-4 h-4 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10z" />
            </svg>
            <span className="font-bold text-sm text-gray-900 whitespace-nowrap shrink-0">{t("whatLabel")}</span>
            <span className="w-full text-sm text-gray-600 truncate">{whatValueLabel}</span>

            {activeDropdown === "what" && (
              <div className="absolute left-0 top-full z-50 bg-white rounded-xl shadow-2xl w-80 p-2 mt-2 border border-gray-200">
                <div className="max-h-72 overflow-y-auto">
                  {whatOptions.map((option) => {
                    const isSelected = filters.propertyType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFilterChange("propertyType", option.value);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10z" />
                            </svg>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 text-sm">{option.label}</span>
                            <span className="text-xs text-gray-500">{option.subtext}</span>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border ${isSelected ? "border-red-600 bg-red-600" : "border-gray-300 bg-white"}`} />
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(null);
                  }}
                  className="w-full bg-red-600 text-white font-bold py-3 rounded-lg mt-2"
                >
                  {t("confirmSelection")}
                </button>
              </div>
            )}
          </div>
          <div className="hidden md:block h-8 border-l border-gray-300" />

          {/* Buttons */}
          <div className="w-full md:w-auto flex flex-row justify-between mt-2 md:mt-0 md:justify-start gap-2 md:gap-3 md:pl-2">
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className={`h-12 px-5 rounded-lg border border-gray-300 transition-colors flex items-center justify-center gap-2 w-full md:w-auto ${
                hasAdvancedFilters ? "bg-blue-50 border-blue-300 text-blue-700" : "text-gray-700"
              }`}
              aria-label={t("filters")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>{t("filters")}</span>
              {hasAdvancedFilters && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  1
                </span>
              )}
            </button>

            <button
              onClick={handleSearch}
              className="h-12 min-w-32 px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-bold text-base flex items-center justify-center gap-2 w-full md:w-auto"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {t("search")}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filter Modal */}
      <AdvancedFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={clearFilters}
        onApply={handleSearch}
      />
    </>
  );
}
