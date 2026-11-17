"use client";

// ============================================
// PROPERTY NOT FOUND PAGE
// ============================================
// 404 page for non-existent properties
// ============================================

// Client component: a not-found boundary gets no route params, so on the
// server next-intl would read request headers and break ISR for the page.
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/routing";

export default function PropertyNotFound() {
  const t = useTranslations("NotFound");
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        {t("propertyTitle")}
      </h1>
      <p className="text-gray-600 mb-8">{t("propertyBody")}</p>
      <Link
        href="/properties"
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        {t("browseAll")}
      </Link>
    </div>
  );
}
