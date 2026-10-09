"use client";

// ============================================
// ADVANCED FILTER MODAL
// ============================================
// Modal dialog for advanced property search filters
// Includes: New builds, Price range, Area range, Keyword search
// ============================================

import { useEffect } from "react";
import { useTranslations } from "next-intl";

interface AdvancedFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    isNewBuild: boolean;
    minPrice: string;
    maxPrice: string;
    minArea: string;
    maxArea: string;
    keyword: string;
  };
  onFilterChange: (key: string, value: string | boolean) => void;
  onClear: () => void;
  onApply: () => void;
}

export default function AdvancedFilterModal({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onClear,
  onApply,
}: AdvancedFilterModalProps) {
  const t = useTranslations("Search");

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply();
    onClose();
  };

  const handleClear = () => {
    onClear();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center p-6 border-b border-gray-200">
          <button
            onClick={onClose}
            className="absolute left-6 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label={t("close")}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-xl font-bold text-gray-900">{t("advancedFilters")}</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Only New Buildings Checkbox */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200">
            <label htmlFor="isNewBuild" className="text-base font-semibold text-gray-800">
              {t("onlyNew")}
            </label>
            <input
              type="checkbox"
              id="isNewBuild"
              checked={filters.isNewBuild}
              onChange={(e) => onFilterChange("isNewBuild", e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          {/* Price Range */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              {t("price")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <input
                  type="number"
                  id="minPrice"
                  value={filters.minPrice}
                  onChange={(e) => onFilterChange("minPrice", e.target.value)}
                  placeholder={t("priceFrom")}
                  min="0"
                  className="w-full h-12 px-4 text-gray-900 bg-white border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
              <div>
                <input
                  type="number"
                  id="maxPrice"
                  value={filters.maxPrice}
                  onChange={(e) => onFilterChange("maxPrice", e.target.value)}
                  placeholder={t("priceTo")}
                  min="0"
                  className="w-full h-12 px-4 text-gray-900 bg-white border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Area Range */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              {t("area")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <input
                  type="number"
                  id="minArea"
                  value={filters.minArea}
                  onChange={(e) => onFilterChange("minArea", e.target.value)}
                  placeholder={t("areaFrom")}
                  min="0"
                  className="w-full h-12 px-4 text-gray-900 bg-white border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
              <div>
                <input
                  type="number"
                  id="maxArea"
                  value={filters.maxArea}
                  onChange={(e) => onFilterChange("maxArea", e.target.value)}
                  placeholder={t("areaTo")}
                  min="0"
                  className="w-full h-12 px-4 text-gray-900 bg-white border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Keyword Search */}
          <div>
            <label htmlFor="keyword" className="block text-sm font-semibold text-gray-700 mb-2">
              {t("keyword")}
            </label>
            <input
              type="text"
              id="keyword"
              value={filters.keyword}
              onChange={(e) => onFilterChange("keyword", e.target.value)}
              placeholder={t("keywordPlaceholder")}
              className="w-full h-12 px-4 text-gray-900 bg-white border border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={handleClear}
            className="px-1 py-2 text-gray-700 hover:text-gray-900 transition-colors font-medium underline underline-offset-2"
          >
            {t("clear")}
          </button>
          <button
            onClick={handleApply}
            className="h-11 px-6 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-semibold flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {t("showResults")}
          </button>
        </div>
      </div>
    </div>
  );
}
