"use client";

import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/routing";

export default function AuthButtons() {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const t = useTranslations("Auth");
  const tNav = useTranslations("Navigation");

  if (status === "loading") {
    return (
      <div className="h-11 w-48 animate-pulse rounded-lg bg-gray-100" />
    );
  }

  if (session) {
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {t("goToDashboard")}
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: `/${locale}` })}
          className="text-sm font-medium text-gray-600 hover:text-red-600"
        >
          {tNav("logout")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        {tNav("login")}
      </Link>
      <Link
        href="/register"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        {t("registerLink")}
      </Link>
    </div>
  );
}
