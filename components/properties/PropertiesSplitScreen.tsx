"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import PropertyCard from "@/components/properties/PropertyCard";
import PropertyMap from "@/components/properties/PropertyMap";

type Property = Parameters<typeof PropertyCard>[0]["property"];

export default function PropertiesSplitScreen({
  properties,
  locale,
}: {
  properties: Property[];
  locale: string;
}) {
  const tProperties = useTranslations("Properties");

  // Lock body scroll; left column scrolls internally.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="bg-white">
      <div className="h-[calc(100vh-80px)] overflow-hidden flex flex-col lg:flex-row">
        {/* LEFT: List */}
        <div className="w-full lg:w-[60%] xl:w-[50%] h-full overflow-y-auto p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-950 tracking-tight">
              {tProperties("resultsTitle")}
            </h1>
            <div className="mt-2 text-sm text-gray-500">
              {tProperties("resultsCount", { count: properties.length })}
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
        </div>

        {/* RIGHT: Map */}
        <div className="hidden lg:block lg:w-[40%] xl:w-[50%] h-full overflow-hidden border-l border-gray-200 bg-white relative z-0">
          <div className="h-full w-full">
            <PropertyMap properties={properties as any} />
          </div>
        </div>
      </div>
    </div>
  );
}

