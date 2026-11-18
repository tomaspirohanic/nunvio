"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/routing";
import { deleteSavedSearchAction, updateSavedSearchAction } from "@/actions/saved-searches";

type Item = {
  id: string;
  label: string;
  frequency: string;
  active: boolean;
  confirmed: boolean;
  query: string;
  lastNotifiedAt: string | null;
};

export default function SavedSearchList({ searches }: { searches: Item[] }) {
  const t = useTranslations("SavedSearch");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  if (searches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-gray-700">{t("emptyList")}</p>
        <Link
          href="/properties"
          className="mt-4 inline-flex rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
        >
          {t("startSearching")}
        </Link>
      </div>
    );
  }

  return (
    <ul className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
      {searches.map((s) => (
        <li key={s.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href={`/properties?${s.query}`} className="font-semibold text-gray-950 hover:underline">
                {s.label}
              </Link>
              <div className="mt-1 text-xs text-gray-500">
                {!s.confirmed
                  ? t("notConfirmed")
                  : !s.active
                    ? t("paused")
                    : s.lastNotifiedAt
                      ? t("lastSent", { date: new Date(s.lastNotifiedAt).toLocaleDateString(locale) })
                      : t("noneYet")}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                aria-label={t("frequencyLabel")}
                value={s.frequency}
                onChange={(e) => run(() => updateSavedSearchAction(s.id, { frequency: e.target.value }))}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="INSTANT">{t("frequency.INSTANT")}</option>
                <option value="DAILY">{t("frequency.DAILY")}</option>
                <option value="WEEKLY">{t("frequency.WEEKLY")}</option>
              </select>
              <button
                type="button"
                onClick={() => run(() => updateSavedSearchAction(s.id, { active: !s.active }))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
              >
                {s.active ? t("pause") : t("resume")}
              </button>
              <button
                type="button"
                onClick={() => run(() => deleteSavedSearchAction(s.id))}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
