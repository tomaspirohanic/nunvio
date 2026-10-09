"use client";

import { Link } from "@/src/i18n/routing";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("Footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-gray-900 hover:text-blue-600"
            >
              Nunvio
            </Link>
            <p className="mt-2 max-w-sm text-sm text-gray-500">{t("tagline")}</p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link
              href="/properties"
              className="text-gray-600 hover:text-blue-600"
            >
              {t("properties")}
            </Link>
            <Link
              href="/partners"
              className="text-gray-600 hover:text-blue-600"
            >
              {t("partners")}
            </Link>
            <Link href="/login" className="text-gray-600 hover:text-blue-600">
              {t("login")}
            </Link>
            <Link
              href="/register"
              className="text-gray-600 hover:text-blue-600"
            >
              {t("register")}
            </Link>
            <Link
              href="/legal/privacy"
              className="text-gray-600 hover:text-blue-600"
            >
              {t("privacy")}
            </Link>
            <Link
              href="/legal/terms"
              className="text-gray-600 hover:text-blue-600"
            >
              {t("terms")}
            </Link>
          </nav>
        </div>

        <p className="mt-8 text-xs text-gray-400">
          {t("copyright", { year })}
        </p>
      </div>
    </footer>
  );
}
