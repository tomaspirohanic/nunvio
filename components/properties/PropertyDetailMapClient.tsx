"use client";

// ============================================
// PROPERTY DETAIL MAP CLIENT WRAPPER
// ============================================
// Client Component wrapper for PropertyDetailMap
// Handles dynamic import with SSR disabled to prevent Next.js errors
// ============================================

import dynamic from "next/dynamic";
import type { Currency as PrismaCurrency } from "@prisma/client";

interface PropertyDetailMapClientProps {
  latitude: number;
  longitude: number;
  price: number;
  currency: PrismaCurrency;
  showOnMap: boolean;
}

// Dynamically import PropertyDetailMap with SSR disabled
const PropertyDetailMap = dynamic(
  () => import("./PropertyDetailMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] rounded-lg border border-gray-200 bg-gray-100 animate-pulse flex items-center justify-center">
        <p className="text-gray-500">Loading map...</p>
      </div>
    ),
  }
);

export default function PropertyDetailMapClient({
  latitude,
  longitude,
  price,
  currency,
  showOnMap,
}: PropertyDetailMapClientProps) {
  return (
    <PropertyDetailMap
      latitude={latitude}
      longitude={longitude}
      price={price}
      currency={currency}
      showOnMap={showOnMap}
    />
  );
}
