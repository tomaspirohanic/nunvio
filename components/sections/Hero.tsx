"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/routing";
import AddPropertyButton from "../common/AddPropertyButton";

export default function Hero() {
  const t = useTranslations("Hero");

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-blue-50 to-white">
      <div className="container mx-auto max-w-4xl text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          {t("title")}
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          {t("subtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <AddPropertyButton variant="primary" size="lg">
            {t("listProperty")}
          </AddPropertyButton>
          <Link
            href="/properties"
            className="px-8 py-4 text-lg font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
          >
            {t("browseProperties")}
          </Link>
        </div>
      </div>
    </section>
  );
}
