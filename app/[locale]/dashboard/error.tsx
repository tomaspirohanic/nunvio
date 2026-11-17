"use client";

import { useTranslations } from "next-intl";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("Common");
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {t("somethingWrong")}
      </h2>
      <p className="text-gray-600 mb-6">
        {error.message || t("dashboardErrorFallback")}
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        {t("tryAgain")}
      </button>
    </div>
  );
}
