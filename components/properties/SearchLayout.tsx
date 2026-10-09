"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Building2,
  Home,
  LandPlot,
  Map as MapIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import PropertyCard from "@/components/properties/PropertyCard";
import PropertyMap from "@/components/properties/PropertyMap";

type Property = Parameters<typeof PropertyCard>[0]["property"];

type InitialParams = Partial<{
  location: string;
  offer: "buy" | "rent";
  types: string[];
  minPrice: string;
  maxPrice: string;
  minArea: string;
  maxArea: string;
  keyword: string;
  isNewBuild: boolean;
  hasVideo: boolean;
  page: string;
}>;

export default function SearchLayout({
  properties,
  initialParams,
  locale,
  pagination,
}: {
  properties: Property[];
  initialParams: InitialParams;
  locale: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}) {
  const router = useRouter();
  const tProperties = useTranslations("Properties");
  const tSearch = useTranslations("Search");
  const tPropertyTypes = useTranslations("PropertyTypes");

  const regionNames = useMemo(() => {
    try {
      // Example: "SK" -> "Eslovaquia" when locale="es"
      return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return null;
    }
  }, [locale]);

  const [isMapOpen, setIsMapOpen] = useState(true);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"offer" | "what" | null>(
    null
  );
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const whereInputRef = useRef<HTMLInputElement>(null);

  const [location, setLocation] = useState(initialParams.location ?? "");
  const [offer, setOffer] = useState<"" | "buy" | "rent">(
    initialParams.offer ?? ""
  );
  const [types, setTypes] = useState<string[]>(initialParams.types ?? []);
  const [minPrice, setMinPrice] = useState(initialParams.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(initialParams.maxPrice ?? "");
  const [minArea, setMinArea] = useState(initialParams.minArea ?? "");
  const [maxArea, setMaxArea] = useState(initialParams.maxArea ?? "");
  const [keyword, setKeyword] = useState(initialParams.keyword ?? "");
  const [isNewBuild, setIsNewBuild] = useState(!!initialParams.isNewBuild);
  const [hasVideo, setHasVideo] = useState(!!initialParams.hasVideo);

  const [draftMinPrice, setDraftMinPrice] = useState(minPrice);
  const [draftMaxPrice, setDraftMaxPrice] = useState(maxPrice);
  const [draftMinArea, setDraftMinArea] = useState(minArea);
  const [draftMaxArea, setDraftMaxArea] = useState(maxArea);
  const [draftKeyword, setDraftKeyword] = useState(keyword);
  const [draftIsNewBuild, setDraftIsNewBuild] = useState(isNewBuild);
  const [draftHasVideo, setDraftHasVideo] = useState(hasVideo);
  const [draftTypes, setDraftTypes] = useState<string[]>(types);
  const [draftLocation, setDraftLocation] = useState(location);
  const [draftOffer, setDraftOffer] = useState<"" | "buy" | "rent">(offer);

  // Lock body scroll; list pane scrolls internally.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const query = location.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsSearching(true);
        const localSamples: Array<{ city: string; countryCode: string }> = [
          { city: "Bratislava", countryCode: "SK" },
          { city: "Senec", countryCode: "SK" },
          { city: "Miloslavov", countryCode: "SK" },
          { city: "Trnava", countryCode: "SK" },
          { city: "Pezinok", countryCode: "SK" },
        ];

        const localMatches = localSamples
          .map((s) => {
            const country =
              regionNames?.of(s.countryCode) ?? s.countryCode.toUpperCase();
            const display_name = `${s.city}, ${country}`;
            return { ...s, display_name };
          })
          .filter((s) => s.display_name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5)
          .map((s, idx) => ({
            place_id: `local-${idx}-${s.city}-${s.countryCode}`,
            display_name: s.display_name,
            address: { city: s.city, country_code: s.countryCode.toLowerCase() },
          }));

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
        const uniqueResults = Array.from(
          new Map(raw.map((item: any) => [item.display_name, item])).values()
        ).slice(0, 5);

        const merged = Array.from(
          new Map(
            [...localMatches, ...uniqueResults].map((item: any) => [
              item.display_name,
              item,
            ])
          ).values()
        ).slice(0, 8);

        setSuggestions(merged);
        setShowDropdown(true);
      } catch (error) {
        console.error("City autocomplete error:", error);
        // Fallback to local sample suggestions (localized country names)
        const localSamples: Array<{ city: string; countryCode: string }> = [
          { city: "Bratislava", countryCode: "SK" },
          { city: "Senec", countryCode: "SK" },
          { city: "Miloslavov", countryCode: "SK" },
          { city: "Trnava", countryCode: "SK" },
          { city: "Pezinok", countryCode: "SK" },
        ];
        const localMatches = localSamples
          .map((s) => {
            const country =
              regionNames?.of(s.countryCode) ?? s.countryCode.toUpperCase();
            const display_name = `${s.city}, ${country}`;
            return { ...s, display_name };
          })
          .filter((s) => s.display_name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 5)
          .map((s, idx) => ({
            place_id: `local-${idx}-${s.city}-${s.countryCode}`,
            display_name: s.display_name,
            address: { city: s.city, country_code: s.countryCode.toLowerCase() },
          }));
        setSuggestions(localMatches);
        setShowDropdown(localMatches.length > 0);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [location, regionNames]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const offerValueLabel = offer ? tSearch(offer) : tSearch("offerPlaceholder");

  const PROPERTY_TYPE_TREE = useMemo(
    () => [
      {
        key: "flats",
        label: tSearch("typeCategoryFlats"),
        description: tSearch("typeCategoryFlatsDesc"),
        Icon: Building2,
        items: [
          { value: "flat_studio", label: tSearch("typeFlatStudio") },
          { value: "flat_1", label: tSearch("typeFlat1") },
          { value: "flat_2", label: tSearch("typeFlat2") },
          { value: "flat_3", label: tSearch("typeFlat3") },
          { value: "flat_4", label: tSearch("typeFlat4") },
          { value: "flat_5p", label: tSearch("typeFlat5p") },
        ],
      },
      {
        key: "houses",
        label: tSearch("typeCategoryHouses"),
        description: tSearch("typeCategoryHousesDesc"),
        Icon: Home,
        items: [
          { value: "house_family", label: tSearch("typeHouseFamily") },
          { value: "house_villa", label: tSearch("typeHouseVilla") },
          { value: "house_cottage", label: tSearch("typeHouseCottage") },
        ],
      },
      {
        key: "land",
        label: tSearch("typeCategoryLand"),
        description: tSearch("typeCategoryLandDesc"),
        Icon: LandPlot,
        items: [
          { value: "land_family", label: tSearch("typeLandFamily") },
          { value: "land_commercial", label: tSearch("typeLandCommercial") },
          { value: "land_garden", label: tSearch("typeLandGarden") },
        ],
      },
    ],
    [tSearch]
  );

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [typesDraftOpen, setTypesDraftOpen] = useState(false);

  const typesLabel = useMemo(() => {
    if (types.length === 0) return tSearch("whatPlaceholder");

    const selected: Array<{ label: string; category: string }> = [];
    for (const cat of PROPERTY_TYPE_TREE) {
      for (const it of cat.items) {
        if (types.includes(it.value)) {
          selected.push({ label: it.label, category: cat.label });
        }
      }
    }

    if (selected.length === 0) return tSearch("whatPlaceholder");

    // If exactly one selected, show context (Category: Label)
    if (selected.length === 1) {
      return `${selected[0].category}: ${selected[0].label}`;
    }

    // If multiple, keep it clean and compact
    return `${tSearch("selected")} (${selected.length})`;
  }, [PROPERTY_TYPE_TREE, tSearch, types]);

  const selectedTypeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    for (const cat of PROPERTY_TYPE_TREE) {
      for (const it of cat.items) {
        if (types.includes(it.value)) {
          chips.push({ key: it.value, label: it.label });
        }
      }
    }
    return chips;
  }, [PROPERTY_TYPE_TREE, types]);

  const offerOptions: Array<{
    value: "buy" | "rent";
    label: string;
    subtext: string;
  }> = [
    { value: "buy", label: tSearch("buy"), subtext: tSearch("buySubtext") },
    { value: "rent", label: tSearch("rent"), subtext: tSearch("rentSubtext") },
  ];

  const whatOptions: Array<{
    value: string;
    label: string;
    subtext: string;
  }> = [
    {
      value: "house",
      label: tPropertyTypes("HOUSE"),
      subtext: tSearch("houseSubtext"),
    },
    {
      value: "apartment",
      label: tPropertyTypes("APARTMENT"),
      subtext: tSearch("apartmentSubtext"),
    },
    {
      value: "commercial",
      label: tPropertyTypes("COMMERCIAL"),
      subtext: tSearch("commercialSubtext"),
    },
    {
      value: "land",
      label: tPropertyTypes("LAND"),
      subtext: tSearch("landSubtext"),
    },
  ];

  const handleSelectSuggestion = (suggestion: any) => {
    const selectedCity =
      suggestion?.address?.city ||
      suggestion?.address?.town ||
      suggestion?.address?.village ||
      suggestion?.name ||
      suggestion?.display_name ||
      "";

    setLocation(selectedCity);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const isSelected = (value: string, list: string[]) => list.includes(value);
  const toggleValue = (value: string, list: string[], set: (v: string[]) => void) => {
    set(
      list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
    );
  };

  const setCategoryAll = (catKey: string, checked: boolean, list: string[], set: (v: string[]) => void) => {
    const cat = PROPERTY_TYPE_TREE.find((c) => c.key === catKey);
    if (!cat) return;
    const values = cat.items.map((i) => i.value);
    if (checked) {
      set(Array.from(new Set([...list, ...values])));
    } else {
      set(list.filter((v) => !values.includes(v)));
    }
  };

  const isCategoryAllChecked = (catKey: string, list: string[]) => {
    const cat = PROPERTY_TYPE_TREE.find((c) => c.key === catKey);
    if (!cat) return false;
    return cat.items.every((i) => list.includes(i.value));
  };

  const onSearch = () => {
    const params = new URLSearchParams();
    if (location.trim()) params.set("location", location.trim());
    if (offer) params.set("offer", offer);
    if (types.length > 0) params.set("types", types.join(","));
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (minArea) params.set("minArea", minArea);
    if (maxArea) params.set("maxArea", maxArea);
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (isNewBuild) params.set("isNewBuild", "true");
    if (hasVideo) params.set("hasVideo", "true");
    router.push(`/${locale}/properties?${params.toString()}`);
  };

  const showMap = isMapOpen;

  return (
    <div className="bg-white">
      {/* Top filter bar */}
      <div className="w-full bg-white border-b border-gray-200 p-4 z-10 sticky top-0">
        <div
          ref={barRef}
          className="max-w-7xl mx-auto flex items-center justify-between w-full gap-4"
        >
          {/* Inputs group */}
          <div className="flex-1 min-w-0">
            <div className="w-full bg-white rounded-2xl md:rounded-full border border-gray-200 shadow-sm px-3 py-3">
              <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch lg:items-center">
                {/* Where */}
                <div
                  className="relative flex items-center px-3 py-2 gap-2 w-full md:w-auto md:flex-[2] md:min-w-[220px] cursor-pointer hover:bg-gray-50 rounded-lg min-h-12 border-b border-gray-100 md:border-b-0"
                  onClick={() => {
                    whereInputRef.current?.focus();
                    setActiveDropdown(null);
                  }}
                >
                  <svg
                    className="w-4 h-4 text-red-600 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19.5 10.5c0 6-7.5 11-7.5 11s-7.5-5-7.5-11a7.5 7.5 0 1115 0z"
                    />
                  </svg>
                  <span className="font-bold text-sm text-gray-900 whitespace-nowrap">
                    {tSearch("whereLabel")}
                  </span>
                  <input
                    ref={whereInputRef}
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onFocus={() => setShowDropdown(suggestions.length > 0)}
                    placeholder={tSearch("wherePlaceholder")}
                    className="bg-transparent outline-none border-0 w-full text-sm text-gray-600 placeholder-gray-400 placeholder:text-sm"
                  />

                  {showDropdown && (suggestions.length > 0 || isSearching) && (
                    <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white shadow-xl rounded-xl max-h-72 overflow-y-auto border border-gray-200 p-2">
                      <div className="text-sm font-bold text-gray-500 mb-2 px-2">
                        {tSearch("locationHeader")}
                      </div>
                      <ul>
                        {isSearching && suggestions.length === 0 ? (
                          <li className="px-4 py-3 text-sm text-gray-500">
                            {tSearch("loadingSuggestions")}
                          </li>
                        ) : (
                          suggestions.map((suggestion) => (
                            <li
                              key={suggestion.place_id}
                              className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded-lg border-b border-gray-100 last:border-b-0"
                              onClick={() => handleSelectSuggestion(suggestion)}
                            >
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                <svg
                                  className="w-4 h-4 text-gray-500"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19.5 10.5c0 6-7.5 11-7.5 11s-7.5-5-7.5-11a7.5 7.5 0 1115 0z"
                                  />
                                </svg>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-gray-800 truncate">
                                  {String(suggestion.display_name).split(",")[0]}
                                </span>
                                <span className="text-xs text-gray-500 truncate">
                                  {String(suggestion.display_name)
                                    .split(",")
                                    .slice(1)
                                    .join(",")
                                    .trim()}
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

                {/* Offer */}
                <div
                  className="relative flex items-center px-3 py-2 gap-2 w-full md:w-auto md:flex-[1] md:min-w-[160px] cursor-pointer hover:bg-gray-50 rounded-lg min-h-12 border-b border-gray-100 md:border-b-0"
                  onClick={() => {
                    setActiveDropdown((prev) => (prev === "offer" ? null : "offer"));
                    setShowDropdown(false);
                    setTypesDraftOpen(false);
                  }}
                >
                  <svg
                    className="w-4 h-4 text-red-600 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 12V8a2 2 0 00-2-2h-4l-2-2H8a2 2 0 00-2 2v2m14 4v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16 0H4m16 0l-2.5 4.5a2 2 0 01-1.74 1H8.24a2 2 0 01-1.74-1L4 12"
                    />
                  </svg>
                  <span className="font-bold text-sm text-gray-900 whitespace-nowrap shrink-0">
                    {tSearch("offerLabel")}
                  </span>
                  <span className="w-full text-sm text-gray-600 truncate">
                    {offerValueLabel}
                  </span>

                  {activeDropdown === "offer" && (
                    <div className="absolute left-0 top-full z-50 bg-white rounded-xl shadow-2xl w-72 p-2 mt-2 border border-gray-200">
                      {offerOptions.map((option) => {
                        const isSelected = offer === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOffer(option.value);
                              setActiveDropdown(null);
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                <svg
                                  className="w-4 h-4 text-gray-500"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {option.label}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {option.subtext}
                                </span>
                              </div>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-full border ${
                                isSelected
                                  ? "border-red-600 bg-red-600"
                                  : "border-gray-300 bg-white"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="hidden md:block h-8 border-l border-gray-300" />

                {/* What */}
                <div
                  className="relative flex items-center px-3 py-2 gap-2 w-full md:w-auto md:flex-[1.5] md:min-w-[240px] cursor-pointer hover:bg-gray-50 rounded-lg min-h-12 border-b border-gray-100 md:border-b-0"
                  onClick={() => {
                    setActiveDropdown(null);
                    setShowDropdown(false);
                    setTypesDraftOpen((v) => !v);
                  }}
                >
                  <svg
                    className="w-4 h-4 text-red-600 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10z"
                    />
                  </svg>
                  <span className="font-bold text-sm text-gray-900 whitespace-nowrap shrink-0">
                    {tSearch("whatLabel")}
                  </span>
                  <div className="w-full min-w-0 flex items-center gap-2">
                    {selectedTypeChips.length > 0 ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {selectedTypeChips.slice(0, 1).map((chip) => (
                            <span
                              key={chip.key}
                              className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-md px-3 py-1 text-xs font-semibold"
                            >
                              {chip.label}
                              <button
                                type="button"
                                className="text-white/90 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTypes((prev) => prev.filter((x) => x !== chip.key));
                                }}
                                aria-label="Remove"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <span className="text-sm text-gray-500 truncate">
                          {tSearch("add")}…
                        </span>
                      </div>
                    ) : (
                      <span className="w-full text-sm text-gray-600 truncate">
                        {typesLabel}
                      </span>
                    )}
                  </div>

                  {typesDraftOpen && (
                    <div className="absolute left-0 top-full z-50 bg-white rounded-xl shadow-2xl w-96 p-2 mt-2 border border-gray-200">
                      <div className="max-h-80 overflow-y-auto">
                        {PROPERTY_TYPE_TREE.map((cat) => {
                          const isExpanded = expandedCategory === cat.key;
                          return (
                            <div
                              key={cat.key}
                              className="rounded-lg border border-gray-100 mb-2 overflow-hidden"
                            >
                              <button
                                type="button"
                                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedCategory((prev) =>
                                    prev === cat.key ? null : cat.key
                                  );
                                }}
                              >
                                <div className="font-semibold text-gray-900 text-sm">
                                  {cat.label}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {cat.items.filter((i) => types.includes(i.value)).length}
                                  /
                                  {cat.items.length}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="px-3 pb-3">
                                  <label className="flex items-center gap-2 py-2 text-sm text-gray-800 cursor-pointer w-full whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={isCategoryAllChecked(cat.key, types)}
                                      onChange={(e) =>
                                        setCategoryAll(
                                          cat.key,
                                          e.target.checked,
                                          types,
                                          setTypes
                                        )
                                      }
                                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500/30"
                                    />
                                    <span className="font-semibold">
                                      {tSearch("all")}
                                    </span>
                                  </label>
                                  <div className="h-px bg-gray-100 my-1" />
                                  <div className="grid grid-cols-2 gap-3 mt-2">
                                    {cat.items.map((it) => (
                                      <label
                                        key={it.value}
                                        className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer w-full whitespace-nowrap"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected(it.value, types)}
                                          onChange={() =>
                                            toggleValue(it.value, types, setTypes)
                                          }
                                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500/30"
                                        />
                                        <span className="truncate">{it.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="sticky bottom-0 bg-white pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTypesDraftOpen(false);
                          }}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors"
                        >
                          {tSearch("confirmSelection")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Actions group */}
          <div className="flex items-center gap-2 shrink-0">
                  <button
              type="button"
              onClick={() => {
                setDraftLocation(location);
                setDraftOffer(offer);
                setDraftTypes(types);
                setDraftMinPrice(minPrice);
                setDraftMaxPrice(maxPrice);
                setDraftMinArea(minArea);
                setDraftMaxArea(maxArea);
                setDraftKeyword(keyword);
                setDraftIsNewBuild(isNewBuild);
                setDraftHasVideo(hasVideo);
                setIsFilterModalOpen(true);
              }}
              className="h-11 px-4 rounded-xl border border-gray-200 text-gray-900 bg-white shadow-sm hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
                    <span>{tSearch("filter")}</span>
            </button>

            <button
              type="button"
              onClick={onSearch}
              className="h-11 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm transition-colors inline-flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {tSearch("search")}
            </button>
          </div>

          {/* Right: map toggle pushed to edge */}
          <div className="ml-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsMapOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <MapIcon className="w-4 h-4" />
              {showMap ? tSearch("mapHide") : tSearch("mapShow")}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced filters modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-w-5xl w-full bg-white rounded-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border border-gray-200">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <div className="text-lg font-bold text-gray-950">
                {tSearch("megaTitle")}
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="w-10 h-10 rounded-full hover:bg-gray-100 inline-flex items-center justify-center text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              {/* Row 1: core inputs */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="relative">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {tSearch("whereLabel")}
                    </label>
                    <input
                      value={draftLocation}
                      onChange={(e) => setDraftLocation(e.target.value)}
                      placeholder={tSearch("wherePlaceholder")}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {tSearch("offerLabel")}
                    </label>
                    <select
                      value={draftOffer}
                      onChange={(e) =>
                        setDraftOffer(e.target.value as "" | "buy" | "rent")
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                    >
                      <option value="">{tSearch("offerPlaceholder")}</option>
                      <option value="buy">{tSearch("buy")}</option>
                      <option value="rent">{tSearch("rent")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {tSearch("whatLabel")}
                    </label>
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      {/* Trigger-like field with chips */}
                      <div className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                        <div className="flex items-center gap-2 min-w-0">
                          {draftTypes.length === 0 ? (
                            <span className="text-gray-500">
                              {tSearch("whatPlaceholder")}
                            </span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-md px-3 py-1 text-xs font-semibold">
                                {tSearch("typeCategoryFlats")}
                                <button
                                  type="button"
                                  className="text-white/90 hover:text-white"
                                  onClick={() => setDraftTypes([])}
                                >
                                  ×
                                </button>
                              </span>
                              <span className="text-sm text-gray-500 truncate">
                                {tSearch("add")}…
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Category list / expanded */}
                      <div className="max-h-[320px] overflow-y-auto">
                        {PROPERTY_TYPE_TREE.map((cat) => {
                          const catChecked = isCategoryAllChecked(cat.key, draftTypes);
                          const expanded = expandedCategory === `modal-${cat.key}`;
                          const Icon = cat.Icon;
                          return (
                            <div key={cat.key} className="border-b border-gray-100 last:border-b-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedCategory((prev) =>
                                    prev === `modal-${cat.key}` ? null : `modal-${cat.key}`
                                  )
                                }
                                className="w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 text-left"
                              >
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                  <Icon className="w-5 h-5 text-gray-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-gray-900">
                                    {cat.label}
                                  </div>
                                  <div className="text-sm text-gray-500 truncate">
                                    {cat.description}
                                  </div>
                                </div>
                                <label
                                  className="flex items-center gap-2 cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={catChecked}
                                    onChange={(e) =>
                                      setCategoryAll(
                                        cat.key,
                                        e.target.checked,
                                        draftTypes,
                                        setDraftTypes
                                      )
                                    }
                                    className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500/30"
                                  />
                                </label>
                              </button>

                              {expanded && (
                                <div className="px-4 pb-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="font-semibold">{cat.label}</div>
                                    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm text-gray-700">
                                      <span>{tSearch("all")}</span>
                                      <input
                                        type="checkbox"
                                        checked={catChecked}
                                        onChange={(e) =>
                                          setCategoryAll(
                                            cat.key,
                                            e.target.checked,
                                            draftTypes,
                                            setDraftTypes
                                          )
                                        }
                                        className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500/30"
                                      />
                                    </label>
                                  </div>
                                  <div className="space-y-3">
                                    {cat.items.map((it) => (
                                      <label
                                        key={it.value}
                                        className="flex items-center justify-between gap-4 cursor-pointer w-full"
                                      >
                                        <span className="text-sm text-gray-800">
                                          {it.label}
                                        </span>
                                        <input
                                          type="checkbox"
                                          checked={isSelected(it.value, draftTypes)}
                                          onChange={() =>
                                            toggleValue(it.value, draftTypes, setDraftTypes)
                                          }
                                          className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500/30"
                                        />
                                      </label>
                                    ))}
                                  </div>
                                  <div className="mt-4">
                                    <button
                                      type="button"
                                      className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors"
                                      onClick={() => setExpandedCategory(null)}
                                    >
                                      {tSearch("confirmSelection")}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: special features */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="flex items-center gap-2 cursor-pointer w-full whitespace-nowrap text-sm font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={draftIsNewBuild}
                      onChange={(e) => setDraftIsNewBuild(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500/30"
                    />
                    {tSearch("onlyNew")}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer w-full whitespace-nowrap text-sm font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={draftHasVideo}
                      onChange={(e) => setDraftHasVideo(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500/30"
                    />
                    {tSearch("onlyWithVideo")}
                  </label>
                </div>
              </div>

              {/* Row 3: price */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">
                  {tSearch("price")}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {tSearch("priceFrom")} (€)
                    </label>
                    <input
                      value={draftMinPrice}
                      onChange={(e) => setDraftMinPrice(e.target.value)}
                      placeholder="0"
                      inputMode="numeric"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {tSearch("priceTo")} (€)
                    </label>
                    <input
                      value={draftMaxPrice}
                      onChange={(e) => setDraftMaxPrice(e.target.value)}
                      placeholder="∞"
                      inputMode="numeric"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: area */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">
                  {tSearch("area")}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {tSearch("areaFrom")} (m²)
                    </label>
                    <input
                      value={draftMinArea}
                      onChange={(e) => setDraftMinArea(e.target.value)}
                      placeholder="0"
                      inputMode="numeric"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {tSearch("areaTo")} (m²)
                    </label>
                    <input
                      value={draftMaxArea}
                      onChange={(e) => setDraftMaxArea(e.target.value)}
                      placeholder="∞"
                      inputMode="numeric"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: keyword */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">
                  {tSearch("keyword")}
                </div>
                <input
                  value={draftKeyword}
                  onChange={(e) => setDraftKeyword(e.target.value)}
                  placeholder={tSearch("keywordPlaceholder")}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300"
                />
              </div>
            </div>

            <div className="border-t p-4 flex justify-between items-center bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setDraftLocation("");
                  setDraftOffer("");
                  setDraftTypes([]);
                  setDraftMinPrice("");
                  setDraftMaxPrice("");
                  setDraftMinArea("");
                  setDraftMaxArea("");
                  setDraftKeyword("");
                  setDraftIsNewBuild(false);
                  setDraftHasVideo(false);
                }}
                className="text-sm text-gray-500 underline hover:text-gray-700"
              >
                {tSearch("clear")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocation(draftLocation.trim());
                  setOffer(draftOffer);
                  setTypes(draftTypes);
                  setMinPrice(draftMinPrice.trim());
                  setMaxPrice(draftMaxPrice.trim());
                  setMinArea(draftMinArea.trim());
                  setMaxArea(draftMaxArea.trim());
                  setKeyword(draftKeyword.trim());
                  setIsNewBuild(draftIsNewBuild);
                  setHasVideo(draftHasVideo);
                  setIsFilterModalOpen(false);
                  // Apply immediately, matching reference UX.
                  const params = new URLSearchParams();
                  if (draftLocation.trim()) params.set("location", draftLocation.trim());
                  if (draftOffer) params.set("offer", draftOffer);
                  if (draftTypes.length > 0) params.set("types", draftTypes.join(","));
                  if (draftMinPrice.trim()) params.set("minPrice", draftMinPrice.trim());
                  if (draftMaxPrice.trim()) params.set("maxPrice", draftMaxPrice.trim());
                  if (draftMinArea.trim()) params.set("minArea", draftMinArea.trim());
                  if (draftMaxArea.trim()) params.set("maxArea", draftMaxArea.trim());
                  if (draftKeyword.trim()) params.set("keyword", draftKeyword.trim());
                  if (draftIsNewBuild) params.set("isNewBuild", "true");
                  if (draftHasVideo) params.set("hasVideo", "true");
                  router.push(`/${locale}/properties?${params.toString()}`);
                }}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-sm font-bold transition-colors"
              >
                {tSearch("showResults")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split-screen area */}
      <div className="h-[calc(100vh-140px)] overflow-hidden flex flex-col lg:flex-row">
        {/* LEFT: List */}
        <div
          className={
            showMap
              ? "w-full lg:w-1/2 h-full overflow-y-auto p-4 md:p-6"
              : "w-full h-full overflow-y-auto p-4 md:p-6 max-w-5xl mx-auto"
          }
        >
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-950 tracking-tight">
              {tProperties("resultsTitle")}
            </h1>
            <div className="mt-2 text-sm text-gray-500">
              {tProperties("resultsCount", {
                count: pagination?.total ?? properties.length,
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                locale={locale}
                tProperties={tProperties}
              />
            ))}
          </div>

          {pagination && pagination.pageCount > 1 && (
            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  params.set("page", String(Math.max(1, pagination.page - 1)));
                  router.push(`/${locale}/properties?${params.toString()}`);
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 disabled:opacity-40"
              >
                ←
              </button>
              <div className="text-sm text-gray-600">
                {pagination.page} / {pagination.pageCount}
              </div>
              <button
                type="button"
                disabled={pagination.page >= pagination.pageCount}
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  params.set(
                    "page",
                    String(Math.min(pagination.pageCount, pagination.page + 1))
                  );
                  router.push(`/${locale}/properties?${params.toString()}`);
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 disabled:opacity-40"
              >
                →
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Map */}
        {showMap && (
          <div className="hidden lg:block lg:w-1/2 h-full overflow-hidden border-l border-gray-200 bg-white relative z-0">
            <div className="h-full w-full">
              <PropertyMap properties={properties as any} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

