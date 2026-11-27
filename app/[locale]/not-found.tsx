"use client";

// Localized "page not found" for every page inside a language. Client
// component: a not-found boundary gets no route params (see the property one).
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/routing";

export default function LocaleNotFound() {
  const t = useTranslations("NotFound");
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-sm font-semibold text-red-600">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-950 md:text-4xl">
        {t("pageTitle")}
      </h1>
      <p className="mt-4 text-gray-600">{t("pageBody")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/properties"
          className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
        >
          {t("browseAll")}
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
