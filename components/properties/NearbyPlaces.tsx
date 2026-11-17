"use client";

// "What's nearby" on the listing page: loaded after the page (does not slow
// it down), hidden when there is no data.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bus, GraduationCap, HeartPulse, ShoppingBasket, Trees } from "lucide-react";

type Row = {
  category: "school" | "transport" | "shop" | "health" | "park";
  count: number;
  nearest: Array<{ name: string | null; meters: number; walkMinutes: number }>;
};

const ICONS = {
  transport: Bus,
  school: GraduationCap,
  shop: ShoppingBasket,
  health: HeartPulse,
  park: Trees,
} as const;

export default function NearbyPlaces({ propertyId }: { propertyId: string }) {
  const t = useTranslations("Nearby");
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/nearby?id=${encodeURIComponent(propertyId)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRows(d?.nearby ?? null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [propertyId]);

  if (!rows || rows.every((r) => r.count === 0)) return null;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-gray-950">{t("title")}</h2>
      <ul className="mt-4 divide-y divide-gray-100">
        {rows.map((r) => {
          const Icon = ICONS[r.category];
          const first = r.nearest[0];
          return (
            <li key={r.category} className="flex items-start gap-3 py-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-gray-900">{t(`cat_${r.category}`)}</span>
                  <span className="shrink-0 text-sm text-gray-500">{t("within1km", { count: r.count })}</span>
                </div>
                {first ? (
                  <div className="mt-0.5 truncate text-sm text-gray-600">
                    {t("nearest", {
                      name: first.name ?? t(`unnamed_${r.category}`),
                      minutes: first.walkMinutes,
                      meters: first.meters,
                    })}
                  </div>
                ) : (
                  <div className="mt-0.5 text-sm text-gray-400">{t("noneNearby")}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-gray-400">{t("source")}</p>
    </div>
  );
}
