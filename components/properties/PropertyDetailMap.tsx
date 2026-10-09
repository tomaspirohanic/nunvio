"use client";

// ============================================
// PROPERTY DETAIL MAP COMPONENT
// ============================================
// Map component for property detail page
// Shows exact location with price pill if showOnMap is true
// Shows privacy circle if showOnMap is false (Airbnb-style)
// ============================================

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  convertPrice,
  formatPrice,
  isSupportedCurrency,
  type Currency,
} from "@/lib/currency";
import type { Currency as PrismaCurrency } from "@prisma/client";

// Fix for default marker icons in Next.js
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

interface PropertyDetailMapProps {
  latitude: number;
  longitude: number;
  price: number;
  currency: PrismaCurrency;
  showOnMap: boolean;
}

// Component to center map on coordinates
function MapCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView([lat, lng], 15, { animate: true });
  }, [map, lat, lng]);
  
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

export default function PropertyDetailMap({
  latitude,
  longitude,
  price,
  currency,
  showOnMap,
}: PropertyDetailMapProps) {
  const locale = useLocale();
  const [targetCurrency, setTargetCurrency] = useState<Currency>("EUR");

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
      const cookieCurrency = getCookie("NEXT_CURRENCY");
      if (isSupportedCurrency(cookieCurrency)) {
        setTargetCurrency(cookieCurrency);
      }
    };

    updateCurrency();
    const interval = setInterval(updateCurrency, 500);
    return () => clearInterval(interval);
  }, []);

  const convertedPrice = convertPrice(price, currency, targetCurrency);
  const formattedPrice = formatPrice(convertedPrice, targetCurrency, locale);

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
      `}</style>
      <div className="relative w-full h-[400px] rounded-lg overflow-hidden border border-gray-200 shadow-md">
        <MapContainer
          center={[latitude, longitude]}
          zoom={15}
          style={{ height: "100%", width: "100%", zIndex: 0 }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCenter lat={latitude} lng={longitude} />
          
          {showOnMap ? (
            // Show exact location with price pill marker
            <Marker
              position={[latitude, longitude]}
              icon={createPriceMarker(formattedPrice, targetCurrency)}
            />
          ) : (
            // Show privacy circle (Airbnb-style) - approximate location only
            <>
              <Circle
                center={[latitude, longitude]}
                radius={500} // 500 meters radius
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.2,
                  weight: 2,
                }}
              />
              <Circle
                center={[latitude, longitude]}
                radius={100} // Inner circle for better visibility
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.1,
                  weight: 1,
                }}
              />
            </>
          )}
        </MapContainer>
        {!showOnMap && (
          <div className="pointer-events-none absolute top-3 left-3 z-[500] rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-600 shadow-lg backdrop-blur-sm">
            <p className="font-medium">Approximate location</p>
            <p className="text-gray-500">Exact address hidden for privacy</p>
          </div>
        )}
      </div>
    </>
  );
}
