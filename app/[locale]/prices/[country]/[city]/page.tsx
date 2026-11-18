// ============================================
// PROPERTY PRICES IN A CITY (public SEO landing page)
// ============================================
// /[locale]/prices/sk/bratislava — average & median asking price per m²,
// monthly trend, counts, links into the search. Rebuilt at most once a day.
// ============================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/routing";
import { locales } from "@/i18n";
import { getCanonicalOrigin } from "@/lib/domains";
import { localizeCountryName } from "@/lib/country-display";
import { getCityStats, getCountryCities } from "@/lib/market-stats.server";
import PriceTrendChart from "@/components/market/PriceTrendChart";

export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

type Params = { locale: string; country: string; city: string };

async function load(p: Params) {
  const cc = p.country.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  try {
    return await getCityStats(cc, p.city);
  } catch (e) {
    console.error("[prices] city stats failed", e);
    return null;
  }
}

function money(v: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const s = await load(p);
  if (!s) return {};
  const t = await getTranslations({ locale: p.locale, namespace: "Prices" });
  const flats = s.segments.find((x) => x.offerType === "SALE" && x.propertyType === "APARTMENT");
  const path = `/prices/${p.country}/${p.city}`;
  const origin = getCanonicalOrigin();
  return {
    title: t("cityMetaTitle", { city: s.city, year: new Date().getFullYear() }),
    description: flats?.avgPerSqm
      ? t("cityMetaDescription", {
          city: s.city,
          price: money(flats.avgPerSqm, s.currency, p.locale),
          count: s.totalListings,
        })
      : t("cityMetaDescriptionNoPrice", { city: s.city, count: s.totalListings }),
    alternates: {
      canonical: `${origin}/${p.locale}${path}`,
      languages: Object.fromEntries(locales.map((l) => [l, `${origin}/${l}${path}`])),
    },
  };
}

export default async function CityPricesPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  setRequestLocale(p.locale);
  const s = await load(p);
  if (!s) notFound();
  const t = await getTranslations({ locale: p.locale, namespace: "Prices" });
  const country = localizeCountryName(s.countryCode, p.locale);
  const flats = s.segments.find((x) => x.offerType === "SALE" && x.propertyType === "APARTMENT");
  const others = (await getCountryCities(s.countryCode))
    .filter((c) => c.slug !== s.slug)
    .slice(0, 16);
  const searchBase = `/properties?location=${encodeURIComponent(s.city)}`;
  const segmentLink = (offer: "SALE" | "RENT", type: "APARTMENT" | "HOUSE") =>
    `${searchBase}&offer=${offer === "SALE" ? "buy" : "rent"}&type=${type}`;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <nav className="text-sm text-gray-500">
          <Link href="/prices" className="hover:underline">{t("breadcrumbPrices")}</Link>
          {" / "}
          <Link href={`/prices/${p.country}`} className="hover:underline">{country}</Link>
          {" / "}
          <span className="text-gray-700">{s.city}</span>
        </nav>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 md:text-4xl">
          {t("cityTitle", { city: s.city })}
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-gray-700">
          {flats?.avgPerSqm
            ? t("cityLead", {
                city: s.city,
                price: money(flats.avgPerSqm, s.currency, p.locale),
                median: money(flats.medianPerSqm ?? flats.avgPerSqm, s.currency, p.locale),
                count: s.totalListings,
              })
            : t("cityLeadNoPrice", { city: s.city, count: s.totalListings })}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: t("statListings"), value: s.totalListings.toLocaleString(p.locale) },
            { label: t("statForSale"), value: s.forSale.toLocaleString(p.locale) },
            { label: t("statForRent"), value: s.forRent.toLocaleString(p.locale) },
            { label: t("statReduced"), value: `${s.reducedShare} %` },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl border border-gray-200 p-4">
              <div className="text-sm text-gray-500">{x.label}</div>
              <div className="mt-1 text-2xl font-bold text-gray-950">{x.value}</div>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-semibold text-gray-950">{t("segmentsTitle")}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {s.segments.filter((seg) => seg.listings > 0).map((seg) => (
            <Link
              key={`${seg.offerType}-${seg.propertyType}`}
              href={segmentLink(seg.offerType, seg.propertyType)}
              className="block rounded-2xl border border-gray-200 p-5 transition-shadow hover:shadow-md"
            >
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {t(`segment_${seg.offerType}_${seg.propertyType}`)}
              </div>
              {seg.avgPerSqm != null ? (
                <>
                  <div className="mt-2 text-2xl font-bold text-gray-950">
                    {money(seg.avgPerSqm, s.currency, p.locale)}{" "}
                    <span className="text-base font-medium text-gray-500">/ m²</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-gray-500">{t("medianPerSqm")}</dt>
                    <dd className="text-right font-medium text-gray-900">{money(seg.medianPerSqm!, s.currency, p.locale)}</dd>
                    <dt className="text-gray-500">{seg.offerType === "RENT" ? t("typicalRent") : t("typicalPrice")}</dt>
                    <dd className="text-right font-medium text-gray-900">{money(seg.medianPrice!, s.currency, p.locale)}</dd>
                    <dt className="text-gray-500">{t("typicalArea")}</dt>
                    <dd className="text-right font-medium text-gray-900">{seg.medianArea} m²</dd>
                  </dl>
                </>
              ) : (
                <div className="mt-2 text-sm text-gray-500">{t("tooFew")}</div>
              )}
              <div className="mt-3 text-sm font-semibold text-red-600">
                {t("showListings", { count: seg.listings })}
              </div>
            </Link>
          ))}
        </div>

        {s.trend.length >= 2 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-gray-950">{t("trendTitle")}</h2>
            <p className="mt-1 text-sm text-gray-500">{t("trendHint")}</p>
            <PriceTrendChart
              points={s.trend}
              locale={p.locale}
              currency={s.currency}
              caption={t("trendTitle")}
              tableLabels={{ month: t("tableMonth"), perSqm: t("tablePerSqm"), listings: t("tableListings") }}
            />
          </section>
        )}

        <p className="mt-10 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">{t("disclaimer")}</p>

        {others.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-gray-950">{t("otherCities", { country })}</h2>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {others.map((c) => (
                <li key={c.slug}>
                  <Link href={`/prices/${p.country}/${c.slug}`} className="text-gray-800 hover:text-red-600 hover:underline">
                    {c.city}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
