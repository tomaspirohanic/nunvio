// ============================================
// LISTING MARKET INFO (server component)
// ============================================
// Days on market and price history. Rendered on the listing detail page.
// ============================================

import { getTranslations } from "next-intl/server";
import type { Currency, ListingOffer } from "@prisma/client";

type PriceChange = {
  oldPrice: number;
  newPrice: number;
  currency: Currency;
  changedAt: Date;
};


function money(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

function dateLabel(d: Date, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export default async function ListingMarketInfo({
  locale,
  currentPrice,
  currency,
  offerType,
  listedSince,
  priceChanges,
}: {
  locale: string;
  currentPrice: number;
  currency: Currency;
  offerType: ListingOffer;
  listedSince: Date;
  priceChanges: PriceChange[];
}) {
  const t = await getTranslations({ locale, namespace: "ListingMarket" });
  const days = Math.max(
    0,
    Math.floor((new Date().getTime() - new Date(listedSince).getTime()) / 86_400_000)
  );

  const firstPrice = priceChanges.length > 0 ? priceChanges[0].oldPrice : currentPrice;
  const totalChange = firstPrice > 0 ? Math.round((currentPrice / firstPrice - 1) * 100) : 0;

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div>
          <div className="text-sm text-gray-500">{t("onMarket")}</div>
          <div className="text-lg font-semibold text-gray-950">
            {days === 0 ? t("newToday") : t("days", { count: days })}
          </div>
        </div>
        {priceChanges.length > 0 && totalChange !== 0 && (
          <div>
            <div className="text-sm text-gray-500">{t("sinceListed")}</div>
            <div
              className={`text-lg font-semibold ${totalChange < 0 ? "text-green-700" : "text-red-700"}`}
            >
              {totalChange > 0 ? "+" : ""}
              {totalChange} % ({money(currentPrice - firstPrice, currency, locale)})
            </div>
          </div>
        )}
      </div>

      {priceChanges.length > 0 && (
        <div className="mt-6">
          <h2 className="text-base font-semibold text-gray-950">{t("priceHistory")}</h2>
          <ol className="mt-3 divide-y divide-gray-100 text-sm">
            <li className="flex justify-between py-2 text-gray-600">
              <span>{dateLabel(new Date(listedSince), locale)} · {t("listed")}</span>
              <span className="font-medium text-gray-900">
                {money(firstPrice, currency, locale)}
                {offerType === "RENT" ? ` ${t("perMonth")}` : ""}
              </span>
            </li>
            {priceChanges.map((c, i) => {
              const pct = c.oldPrice > 0 ? Math.round((c.newPrice / c.oldPrice - 1) * 100) : 0;
              return (
                <li key={i} className="flex justify-between py-2 text-gray-600">
                  <span>{dateLabel(new Date(c.changedAt), locale)}</span>
                  <span className="font-medium text-gray-900">
                    {money(c.newPrice, c.currency, locale)}{" "}
                    <span className={pct < 0 ? "text-green-700" : "text-red-700"}>
                      ({pct > 0 ? "+" : ""}
                      {pct} %)
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

    </div>
  );
}
