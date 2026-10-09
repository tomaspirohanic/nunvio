"use client";

// ============================================
// ADDRESS / CITY AUTOCOMPLETE (Nominatim)
// ============================================
// Searches streets + places. On pick: keeps full address in the input,
// and returns city/country/GPS for the form & map.
// ============================================

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

export type PlaceSelection = {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  displayName: string;
  address: string;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  country?: string;
};

type NominatimResult = {
  display_name: string;
  place_id: number;
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: PlaceSelection) => void;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  inputClassName?: string;
  containerClassName?: string;
}

function extractCity(result: NominatimResult): string {
  const addr = result.address;
  if (addr?.city) return addr.city;
  if (addr?.town) return addr.town;
  if (addr?.village) return addr.village;
  if (addr?.municipality) return addr.municipality;
  return result.display_name.split(",")[0]?.trim() || result.display_name;
}

function extractCountry(result: NominatimResult): string {
  if (result.address?.country) return result.address.country;
  const parts = result.display_name.split(",").map((p) => p.trim());
  return parts[parts.length - 1] || "";
}

/** Prefer a readable street line; fall back to full Nominatim display name. */
function extractAddressLabel(result: NominatimResult): string {
  const addr = result.address;
  if (addr) {
    const street = [addr.road || addr.pedestrian, addr.house_number]
      .filter(Boolean)
      .join(" ");
    const city = extractCity(result);
    if (street && city) return `${street}, ${city}`;
    if (street) return street;
  }
  return result.display_name;
}

export default function CityAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  id,
  name,
  required,
  inputClassName,
  containerClassName,
}: CityAutocompleteProps) {
  const t = useTranslations("Filters");
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Skip the next fetch after we programmatically set query from a pick. */
  const skipSearchRef = useRef(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    if (query.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        // No featuretype=settlement → streets and full addresses are included
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&format=json&addressdetails=1&limit=8`,
          {
            headers: { "User-Agent": "Nunvio Real Estate Portal" },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch suggestions");

        const data = (await response.json()) as NominatimResult[];
        setSuggestions(data);
        setIsOpen(data.length > 0);
      } catch (error) {
        console.error("Error fetching address suggestions:", error);
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue);
  };

  const handleSuggestionClick = (suggestion: NominatimResult) => {
    const cityName = extractCity(suggestion);
    const countryName = extractCountry(suggestion);
    const addressLabel = extractAddressLabel(suggestion);
    const lat = parseFloat(suggestion.lat);
    const lon = parseFloat(suggestion.lon);

    skipSearchRef.current = true;
    setQuery(addressLabel);
    onChange(addressLabel);
    setIsOpen(false);
    setSuggestions([]);

    if (onPlaceSelect && countryName && !isNaN(lat) && !isNaN(lon)) {
      onPlaceSelect({
        city: cityName,
        country: countryName,
        latitude: lat,
        longitude: lon,
        displayName: suggestion.display_name,
        address: addressLabel,
      });
    }
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0 && query.trim().length >= 3) {
      setIsOpen(true);
    }
  };

  return (
    <div className={`relative ${containerClassName ?? ""}`} ref={wrapperRef}>
      <input
        type="text"
        id={id}
        name={name}
        required={required}
        value={query}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder || t("cityPlaceholder")}
        className={
          inputClassName ??
          "w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        }
        autoComplete="off"
      />

      {isLoading && query.trim().length >= 3 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.place_id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionClick(suggestion)}
              className="cursor-pointer border-b border-gray-100 px-4 py-2.5 text-sm text-gray-900 transition-colors last:border-b-0 hover:bg-blue-50 hover:text-blue-700"
            >
              <div className="font-medium">{extractAddressLabel(suggestion)}</div>
              <div className="mt-0.5 text-xs text-gray-500">
                {suggestion.display_name}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isOpen &&
        !isLoading &&
        suggestions.length === 0 &&
        query.trim().length >= 3 && (
          <ul className="absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
            <li className="px-4 py-2 text-sm text-gray-500">
              {t("noCitiesFound")}
            </li>
          </ul>
        )}
    </div>
  );
}
