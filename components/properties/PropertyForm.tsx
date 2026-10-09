"use client";

// ============================================
// PROPERTY FORM COMPONENT
// ============================================
// Reusable form for creating/editing properties
// Uses Tailwind CSS for styling
// ============================================

import { Currency, ListingOffer, PropertyType } from "@prisma/client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import ImageUploader from "./ImageUploader";
import CityAutocomplete from "@/components/ui/CityAutocomplete";
import { Link } from "@/src/i18n/routing";
import { useTranslations } from "next-intl";
import type { SavedPropertyImage } from "@/actions/property-images";

// Dynamically import LocationPickerMap to prevent SSR issues
const LocationPickerMap = dynamic(
  () => import("../dashboard/LocationPickerMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] rounded-lg border border-gray-300 bg-gray-100 animate-pulse flex items-center justify-center">
        <p className="text-gray-500">Loading map...</p>
      </div>
    ),
  }
);

interface PropertyFormProps {
  action: (formData: FormData) => Promise<void>;
  propertyId?: string;
  initialImages?: Pick<SavedPropertyImage, "id" | "url" | "order">[];
  initialData?: {
    title?: string;
    description?: string;
    price?: number;
    currency?: Currency;
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    showOnMap?: boolean;
    bedrooms?: number;
    bathrooms?: number;
    areaSqm?: number;
    propertyType?: PropertyType;
    offerType?: ListingOffer;
    contactPhone?: string | null;
    isNewBuild?: boolean;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    address?: string | null;
  };
  submitLabel?: string;
}

export default function PropertyForm({
  action,
  propertyId,
  initialImages,
  initialData,
  submitLabel = "Create Property",
}: PropertyFormProps) {
  const tPropertyForm = useTranslations("PropertyForm");
  const tSearch = useTranslations("Search");
  const tFilters = useTranslations("Filters");
  const tCommon = useTranslations("Common");
  const tProperties = useTranslations("Properties");
  const tPropertyTypes = useTranslations("PropertyTypes");

  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Full address shown in the autocomplete input */
  const [addressLine, setAddressLine] = useState(
    initialData?.address || initialData?.city || ""
  );
  /** City name used for search / DB filters */
  const [city, setCity] = useState(initialData?.city || "");
  const [country, setCountry] = useState(initialData?.country || "");
  const [position, setPosition] = useState<[number, number] | null>(
    initialData?.latitude && initialData?.longitude
      ? [initialData.latitude, initialData.longitude]
      : null
  );
  const [showOnMap, setShowOnMap] = useState(initialData?.showOnMap ?? true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  /** Skip the next geocode run when address was set from autocomplete. */
  const skipGeocodeRef = useRef(false);

  // Edit mode: hydrate state from DB-backed images (PropertyImage)
  useEffect(() => {
    if (!initialImages || initialImages.length === 0) return;
    const urls = initialImages
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((img) => img.url)
      .filter((u) => typeof u === "string" && u.trim().length > 0);
    setUploadedImages(urls);
  }, [initialImages]);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

  // Auto-geocoding when address is typed manually (not from autocomplete pick).
  useEffect(() => {
    if (skipGeocodeRef.current) {
      skipGeocodeRef.current = false;
      return;
    }
    const query = addressLine.trim() || [city.trim(), country.trim()].filter(Boolean).join(", ");
    if (query.length < 3) return;

    const debounceTimer = setTimeout(async () => {
      setIsGeocoding(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          {
            headers: {
              "User-Agent": "Nunvio Real Estate Portal",
            },
          }
        );

        if (!response.ok) throw new Error("Geocoding failed");

        const data = await response.json();
        if (data.length > 0 && data[0].lat && data[0].lon) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lon)) {
            setPosition([lat, lon]);
          }
        }
      } catch (error) {
        console.error("Geocoding error:", error);
      } finally {
        setIsGeocoding(false);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [addressLine, city, country]);

  const handlePositionChange = (newPosition: [number, number]) => {
    setPosition(newPosition);
  };

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    try {
      if (position) {
        formData.set("latitude", position[0].toString());
        formData.set("longitude", position[1].toString());
      }
      formData.set("showOnMap", showOnMap ? "true" : "false");

      await action(formData);
    } catch (error) {
      // Next.js redirect() throws a special error — rethrow so navigation works.
      const digest =
        error && typeof error === "object" && "digest" in error
          ? String((error as { digest?: unknown }).digest)
          : "";
      if (digest.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
      console.error("Form submission error:", error);
      const message =
        error instanceof Error ? error.message : "Error submitting form. Please try again.";
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          {tPropertyForm("titleLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          defaultValue={initialData?.title}
          className={inputClass}
          placeholder={tPropertyForm("titlePlaceholder")}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          {tPropertyForm("descriptionLabel")} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          defaultValue={initialData?.description}
          className={inputClass}
          placeholder={tPropertyForm("descriptionPlaceholder")}
        />
      </div>

      {/* Price and Currency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
            {tProperties("price")} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="price"
            name="price"
            required
            min="0"
            step="0.01"
            defaultValue={initialData?.price}
            className={inputClass}
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
            {tFilters("currency")} <span className="text-red-500">*</span>
          </label>
          <select
            id="currency"
            name="currency"
            required
            defaultValue={initialData?.currency || Currency.EUR}
            className={inputClass}
          >
            <option value={Currency.EUR}>EUR (€)</option>
            <option value={Currency.USD}>USD ($)</option>
            <option value={Currency.GBP}>GBP (£)</option>
            <option value={Currency.CZK}>CZK (Kč)</option>
          </select>
        </div>
      </div>

      {/* Offer type: sale vs. rent */}
      <div>
        <label htmlFor="offerType" className="block text-sm font-medium text-gray-700 mb-1">
          {tPropertyForm("offerTypeLabel")} <span className="text-red-500">*</span>
        </label>
        <select
          id="offerType"
          name="offerType"
          required
          defaultValue={initialData?.offerType || ListingOffer.SALE}
          className={inputClass}
        >
          <option value={ListingOffer.SALE}>{tSearch("buy")}</option>
          <option value={ListingOffer.RENT}>{tSearch("rent")}</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initialData?.status || "PUBLISHED"}
            className={inputClass}
          >
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <div>
          <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">
            Contact phone
          </label>
          <input
            type="tel"
            id="contactPhone"
            name="contactPhone"
            defaultValue={initialData?.contactPhone || ""}
            className={inputClass}
            placeholder="+421..."
          />
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isNewBuild"
          name="isNewBuild"
          value="true"
          defaultChecked={initialData?.isNewBuild ?? false}
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <span className="text-sm text-gray-700">New build</span>
      </label>

      {/* Location */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
            {tPropertyForm("addressLabel")} <span className="text-red-500">*</span>
          </label>
          <CityAutocomplete
            id="address"
            name="address"
            required
            value={addressLine}
            onChange={(v) => {
              setAddressLine(v);
              // Until a suggestion is picked, treat typed text as city fallback
              setCity(v.split(",")[0]?.trim() || v);
            }}
            onPlaceSelect={(place) => {
              skipGeocodeRef.current = true;
              setAddressLine(place.address);
              setCity(place.city);
              setCountry(place.country);
              setPosition([place.latitude, place.longitude]);
            }}
            inputClassName={inputClass}
            placeholder={tPropertyForm("addressPlaceholder")}
          />
          <input type="hidden" name="city" value={city} />
          <p className="mt-1 text-xs text-gray-500">
            {tPropertyForm("cityAutocompleteHint")}
          </p>
        </div>
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
            {tFilters("country")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="country"
            name="country"
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={inputClass}
            placeholder={tFilters("countryPlaceholder")}
          />
        </div>
      </div>

      {/* Interactive Location Picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {tPropertyForm("locationOnMapLabel")}
        </label>
        {isGeocoding && (
          <div className="mb-2 text-sm text-blue-600 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            {tPropertyForm("findingLocationText")}
          </div>
        )}
        <LocationPickerMap position={position} onChange={handlePositionChange} />
        <p className="mt-2 text-xs text-gray-500">
          {tPropertyForm("locationHelpText")}
        </p>
      </div>

      {/* Show on Map Privacy Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showOnMap"
          name="showOnMap"
          checked={showOnMap}
          onChange={(e) => setShowOnMap(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="showOnMap" className="text-sm text-gray-700 cursor-pointer">
          {tPropertyForm("showExactLocationPublicMapLabel")}
        </label>
      </div>
      
      {/* Hidden inputs for coordinates (for form submission) */}
      {position && (
        <>
          <input type="hidden" name="latitude" value={position[0]} />
          <input type="hidden" name="longitude" value={position[1]} />
        </>
      )}

      {/* Image Upload Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {tPropertyForm("propertyImagesLabel")}
        </label>
        <ImageUploader
          value={uploadedImages}
          onChange={setUploadedImages}
          propertyId={propertyId}
          initialImages={initialImages}
        />
        {/* Hidden input to pass images array to form submission */}
        {uploadedImages.map((url, index) => (
          <input
            key={`${url}-${index}`}
            type="hidden"
            name={`images[${index}]`}
            value={url}
          />
        ))}
      </div>

      {/* Property Details */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="bedrooms" className="block text-sm font-medium text-gray-700 mb-1">
            {tProperties("bedrooms")} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="bedrooms"
            name="bedrooms"
            required
            min="0"
            defaultValue={initialData?.bedrooms}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="bathrooms" className="block text-sm font-medium text-gray-700 mb-1">
            {tProperties("bathrooms")} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="bathrooms"
            name="bathrooms"
            required
            min="0"
            defaultValue={initialData?.bathrooms}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="areaSqm" className="block text-sm font-medium text-gray-700 mb-1">
            {tProperties("area")} (m²) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="areaSqm"
            name="areaSqm"
            required
            min="0"
            defaultValue={initialData?.areaSqm}
            className={inputClass}
          />
        </div>
      </div>

      {/* Property Type */}
      <div>
        <label htmlFor="propertyType" className="block text-sm font-medium text-gray-700 mb-1">
          {tFilters("propertyType")} <span className="text-red-500">*</span>
        </label>
        <select
          id="propertyType"
          name="propertyType"
          required
          defaultValue={initialData?.propertyType || PropertyType.APARTMENT}
          className={inputClass}
        >
          <option value={PropertyType.HOUSE}>{tPropertyTypes("HOUSE")}</option>
          <option value={PropertyType.APARTMENT}>{tPropertyTypes("APARTMENT")}</option>
          <option value={PropertyType.LAND}>{tPropertyTypes("LAND")}</option>
          <option value={PropertyType.COMMERCIAL}>{tPropertyTypes("COMMERCIAL")}</option>
        </select>
      </div>

      {/* Submit Button */}
      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? tPropertyForm("savingText") : submitLabel}
        </button>
        <Link
          href="/dashboard/properties"
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center"
        >
          {tCommon("cancel")}
        </Link>
      </div>
    </form>
  );
}
