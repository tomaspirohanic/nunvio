// Property prices: list of countries with listings. /[locale]/prices
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/routing";
import { localizeCountryName } from "@/lib/country-display";
import { getCountriesWithListings } from "@/lib/market-stats.server";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Prices" });
  return { title: t("indexMetaTitle"), description: t("indexLead") };
}

export default async function PricesIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Prices" });
  const countries = await getCountriesWithListings().catch(() => []);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-950 md:text-4xl">{t("indexTitle")}</h1>
        <p className="mt-3 max-w-3xl text-lg text-gray-700">{t("indexLead")}</p>
        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {countries.map((c) => (
            <li key={c.countryCode}>
              <Link
                href={`/prices/${c.countryCode.toLowerCase()}`}
                className="block rounded-2xl border border-gray-200 p-5 hover:shadow-md"
              >
                <div className="text-lg font-semibold text-gray-950">{localizeCountryName(c.countryCode, locale)}</div>
                <div className="mt-1 text-sm text-gray-500">{t("listingsCount", { count: c.listings })}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
