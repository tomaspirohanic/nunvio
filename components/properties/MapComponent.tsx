"use client";

// ============================================
// MAP COMPONENT (LEAFLET)
// ============================================
// Client component for displaying properties on an interactive map
// Uses Leaflet with custom price pill markers (Airbnb/Zillow style)
// ============================================

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  convertPrice,
  isSupportedCurrency,
  type Currency,
} from "@/lib/currency";
import { formatArea, formatCurrency } from "@/lib/formatters";
import { localizeCountryName } from "@/lib/country-display";
import type { Currency as PrismaCurrency } from "@prisma/client";
import { Link } from "@/src/i18n/routing";
import { Bath, BedDouble, Square } from "lucide-react";

// Fix for default marker icons in Next.js
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

interface Property {
  id: string;
  title: string;
  price: number;
  currency: PrismaCurrency;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  showOnMap?: boolean;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  propertyType: string;
  images?: string[]; // Optional array of image URLs
  promotionLevel?: string; // Promotion level for badge display
  featuredUntil?: Date | string | null; // Featured until date
  translations?: Array<{
    translatedTitle: string;
    translatedDescription: string;
  }>;
}

interface MapComponentProps {
  properties: Property[];
}

// Component to dynamically update map bounds when properties change
function MapBoundsUpdater({ properties }: { properties: Property[] }) {
  const map = useMap();

  useEffect(() => {
    // Filter properties with valid coordinates (non-null, non-zero, non-NaN)
    const validProperties = properties.filter((p) => {
      const hasLat = p.latitude !== null && p.latitude !== undefined && !isNaN(p.latitude) && p.latitude !== 0;
      const hasLng = p.longitude !== null && p.longitude !== undefined && !isNaN(p.longitude) && p.longitude !== 0;
      return hasLat && hasLng;
    });

    map.invalidateSize();

    if (validProperties.length === 0) {
      // Central Europe default when search has no mappable results
      map.setView([48.669, 19.699], 7);
      return;
    }

    if (validProperties.length === 1) {
      // Single property: center on it with zoom level 13
      const prop = validProperties[0];
      map.setView([prop.latitude!, prop.longitude!], 13, { animate: true });
      return;
    }

    // Multiple properties: fit bounds with smooth animation
    const bounds = L.latLngBounds(
      validProperties.map((p) => [p.latitude!, p.longitude!] as [number, number])
    );
    
    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 14,
      animate: true,
      duration: 0.5, // Animation duration in seconds
    });
  }, [map, properties]);

  return null;
}

// Create Zillow-style custom price pill marker
function createPriceMarker(price: string, currency: Currency) {
  return L.divIcon({
    className: "custom-price-marker",
    html: `
      <div class="price-pill-marker zillow-style-pill">
        <span class="price-pill-text">${price}</span>
      </div>
    `,
    iconSize: [120, 36],
    iconAnchor: [60, 36],
    popupAnchor: [0, -36],
  });
}

// Fallback Unsplash images for properties without images
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop&q=80",
];

// Property Marker Component with Image Carousel
function PropertyMarker({ property, formattedPrice, displayTitle, units }: { 
  property: Property; 
  formattedPrice: string;
  displayTitle: string;
  units: string;
}) {
  const locale = useLocale();
  const displayCountry = localizeCountryName(property.country, locale);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  
  // Use property images if available, otherwise fallback to Unsplash
  const images = property.images && property.images.length > 0 
    ? property.images 
    : (FALLBACK_IMAGES.length > 0 ? FALLBACK_IMAGES : []);
  
  const currentImage = images[currentImageIdx];
  const hasMultipleImages = images.length > 1;

  // Check if promotion is active (not NONE and featuredUntil is in the future)
  const featuredUntilDate = property.featuredUntil 
    ? new Date(property.featuredUntil) 
    : null;
  const isPromotionActive =
    property.promotionLevel &&
    property.promotionLevel !== "NONE" &&
    featuredUntilDate &&
    !isNaN(featuredUntilDate.getTime()) &&
    featuredUntilDate > new Date();

  // Get promotion badge styling based on level (text-only, no emojis)
  const getPromotionBadge = () => {
    if (!isPromotionActive) return null;

    switch (property.promotionLevel) {
      case "BRONZE":
        return {
          className: "bg-orange-100 text-orange-800 border border-orange-300",
          label: "BRONZE",
        };
      case "SILVER":
        return {
          className: "bg-slate-200 text-slate-800 border border-slate-400",
          label: "SILVER",
        };
      case "GOLD":
        return {
          className: "bg-yellow-400 text-yellow-900 shadow-md border border-yellow-500",
          label: "GOLD",
        };
      default:
        return null;
    }
  };

  const promotionBadge = getPromotionBadge();

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentImageIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentImageIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="property-popup">
      {/* Image Carousel */}
      <div className="relative mb-3 -mx-4 -mt-4 rounded-t-lg overflow-hidden bg-gray-100">
        <img
          src={currentImage}
          alt={displayTitle}
          className="w-full h-32 object-cover"
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
        {hasMultipleImages && (
          <>
            {/* Left Arrow */}
            <button
              onClick={handlePrevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-1.5 shadow-lg transition-all z-10"
              aria-label="Previous image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {/* Right Arrow */}
            <button
              onClick={handleNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-1.5 shadow-lg transition-all z-10"
              aria-label="Next image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {/* Image Indicator Dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setCurrentImageIdx(idx);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === currentImageIdx ? "bg-white" : "bg-white/50"
                  }`}
                  aria-label={`Go to image ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Property Info */}
      <Link
        href={`/properties/${property.id}`}
        className="block hover:opacity-90 transition-opacity group"
      >
        <h3 className="font-semibold text-gray-900 mb-2 text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
          {displayTitle}
        </h3>
        <div className="text-xl font-bold text-blue-600 mb-3">
          {formattedPrice}
        </div>
        <div className="flex gap-4 text-xs text-gray-600 mb-2">
          <span className="flex items-center gap-1.5">
            <BedDouble className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-medium">{property.bedrooms}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Bath className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-medium">{property.bathrooms}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Square className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-medium">{formatArea(property.areaSqm, units, locale)}</span>
          </span>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-500">
          📍 {property.city}, {displayCountry}
        </div>
      </Link>
    </div>
  );
}

export default function MapComponent({ properties }: MapComponentProps) {
  const locale = useLocale();
  const [targetCurrency, setTargetCurrency] = useState<Currency>("EUR");
  const [units, setUnits] = useState<string>("metric");

  // Read currency from cookie
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

  // Filter properties with valid coordinates AND showOnMap enabled
  // Only include properties with both latitude and longitude defined and non-zero
  // AND where showOnMap is true (privacy setting)
  const validProperties = properties.filter((p) => {
    // Check if property should be shown on map (privacy setting)
    if (p.showOnMap === false) return false;
    
    // Check for valid coordinates
    const hasLat = p.latitude !== null && p.latitude !== undefined && !isNaN(p.latitude) && p.latitude !== 0;
    const hasLng = p.longitude !== null && p.longitude !== undefined && !isNaN(p.longitude) && p.longitude !== 0;
    return hasLat && hasLng;
  });

  // Default center (Europe)
  const defaultCenter: [number, number] = [48.669, 19.699];
  const defaultZoom = validProperties.length === 0 ? 7 : 6;

  return (
    <>
      <style jsx global>{`
        .custom-price-marker {
          background: transparent;
          border: none;
        }
        .price-pill-marker.zillow-style-pill {
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 9999px;
          padding: 6px 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1);
          font-weight: 700;
          font-size: 13px;
          color: #1e40af;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1.2;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .price-pill-marker.zillow-style-pill:hover {
          background: #3b82f6;
          color: white;
          transform: scale(1.08);
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.5), 0 2px 6px rgba(0, 0, 0, 0.15);
          border-color: #2563eb;
        }
        .price-pill-text {
          font-family: inherit;
          letter-spacing: -0.01em;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          padding: 0;
        }
        .leaflet-popup-content {
          margin: 0;
          min-width: 240px;
          max-width: 280px;
        }
        .property-popup {
          padding: 0;
        }
        .property-popup h3 {
          margin-bottom: 8px;
          padding: 0 16px;
          margin-top: 0;
        }
        .property-popup > a {
          padding: 0 16px 16px 16px;
          display: block;
        }
        .leaflet-popup-tip {
          background: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
      <div className="w-full h-[600px] lg:h-full rounded-lg overflow-hidden border border-gray-200 shadow-lg relative z-0">
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBoundsUpdater properties={validProperties} />
          {validProperties.map((property) => {
            const formattedPrice = formatCurrency(
              property.price,
              property.currency,
              targetCurrency,
              locale
            );
            const displayTitle =
              property.translations?.[0]?.translatedTitle || property.title;

            return (
              <Marker
                key={property.id}
                position={[property.latitude!, property.longitude!]}
                icon={createPriceMarker(formattedPrice, targetCurrency)}
              >
                <Popup>
                  <PropertyMarker
                    property={property}
                    formattedPrice={formattedPrice}
                    displayTitle={displayTitle}
                    units={units}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </>
  );
}
