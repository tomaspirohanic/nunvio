"use client";

// ============================================
// PROPERTY MAP WRAPPER (DYNAMIC IMPORT)
// ============================================

import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => <MapLoadingSkeleton />,
});

interface Property {
  id: string;
  title: string;
  price: number;
  currency: any;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  propertyType: string;
  translations?: Array<{
    translatedTitle: string;
    translatedDescription: string;
  }>;
}

interface PropertyMapProps {
  properties: Property[];
}

function MapLoadingSkeleton() {
  return (
    <div className="relative z-0 flex h-[600px] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-lg lg:h-full">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-600">Loading map...</p>
      </div>
    </div>
  );
}

export default function PropertyMap({ properties }: PropertyMapProps) {
  return <MapComponent properties={properties} />;
}
