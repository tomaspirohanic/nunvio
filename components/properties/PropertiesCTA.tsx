"use client";

// ============================================
// PROPERTIES PAGE CTA SECTION
// ============================================
// CTA section for property listing page
// Encourages users to list their properties
// ============================================

import { useTranslations } from "next-intl";
import AddPropertyButton from "../common/AddPropertyButton";

export default function PropertiesCTA() {
  const t = useTranslations("CTA");

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 md:p-12 text-white mb-8">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          {t("title")}
        </h2>
        <p className="text-blue-100 text-lg mb-6 max-w-2xl mx-auto">
          {t("description")}
        </p>
        <AddPropertyButton variant="secondary" size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
          {t("addProperty")}
        </AddPropertyButton>
      </div>
    </div>
  );
}
