"use client";

// ============================================
// PROPERTIES PAGE CONTENT (CLIENT)
// ============================================
// Client component wrapper for properties page
// Handles translations and renders the page content
// Supports List/Map view toggle
// ============================================

import { useState } from "react";
import { useTranslations } from "next-intl";
import PropertyFilters from "./PropertyFilters";
import PropertyList from "./PropertyList";
import PropertiesCTA from "./PropertiesCTA";
import PropertyMap from "./PropertyMap";

interface PropertiesPageContentProps {
  properties: any[];
  filters: Record<string, any>;
}

type ViewMode = "list" | "map";

export default function PropertiesPageContent({
  properties,
  filters,
}: PropertiesPageContentProps) {
  const t = useTranslations("Properties");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t("title")}</h1>
            <p className="text-gray-600">{t("subtitle")}</p>
          </div>
          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
                List
              </span>
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === "map"
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                Map
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1">
          <PropertyFilters initialFilters={filters} />
        </aside>

        {/* Main Content Area */}
        <main className="lg:col-span-3">
          {/* CTA Section - Only show in list view */}
          {viewMode === "list" && <PropertiesCTA />}

          <div className="mb-4">
            <p className="text-gray-600">
              {t("propertiesFound", { count: properties.length })}
            </p>
          </div>

          {/* List View */}
          {viewMode === "list" && <PropertyList properties={properties} />}

          {/* Map View */}
          {viewMode === "map" && <PropertyMap properties={properties} />}
        </main>
      </div>
    </div>
  );
}
