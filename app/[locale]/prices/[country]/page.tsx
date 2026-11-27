// Property prices by city in one country: /[locale]/prices/sk
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/routing";
import { locales } from "@/i18n";
import { getCanonicalOrigin } from "@/lib/domains";
import { countryCodeFor, localizeCountryName } from "@/lib/country-display";
import { getCountryCities, statsCurrency } from "@/lib/market-stats.server";

export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

type Params = { locale: string; country: string };

async function load(country: string) {
  const cc = country.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  try {
    // A real country with too few listings still gets its page (with a short
    // note) instead of a "page not found" error.
    if (!countryCodeFor(cc)) return null;
    const cities = await getCountryCities(cc);
    return { cc, cities };
  } catch (e) {
    console.error("[prices] country failed", e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const t = await getTranslations({ locale: p.locale, namespace: "Prices" });
  const country = localizeCountryName(p.country.toUpperCase(), p.locale);
  const origin = getCanonicalOrigin();
  const path = `/prices/${p.country}`;
  const data = await load(p.country);
  return {
    // Thin pages (no city with enough listings yet) stay out of Google.
    ...(data && data.cities.length === 0 ? { robots: { index: false, follow: true } } : {}),
    title: t("countryMetaTitle", { country, year: new Date().getFullYear() }),
    description: t("countryMetaDescription", { country }),
    alternates: {
      canonical: `${origin}/${p.locale}${path}`,
      languages: Object.fromEntries(locales.map((l) => [l, `${origin}/${l}${path}`])),
    },
  };
}

export default async function CountryPricesPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  setRequestLocale(p.locale);
  const data = await load(p.country);
  if (!data) notFound();
  const t = await getTranslations({ locale: p.locale, namespace: "Prices" });
  const country = localizeCountryName(data.cc, p.locale);
  const currency = statsCurrency(data.cc);
  const money = (v: number) =>
    new Intl.NumberFormat(p.locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <nav className="text-sm text-gray-500">
          <Link href="/prices" className="hover:underline">{t("breadcrumbPrices")}</Link>
          {" / "}
          <span className="text-gray-700">{country}</span>
        </nav>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 md:text-4xl">
          {t("countryTitle", { country })}
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-gray-700">{t("countryLead", { country })}</p>

        {data.cities.length === 0 ? (
          <p className="mt-8 rounded-xl border border-gray-200 p-6 text-gray-700">{t("tooFew")}</p>
        ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("colCity")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("colFlatPerSqm")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("colListings")}</th>
              </tr>
            </thead>
            <tbody>
              {data.cities.map((c) => (
                <tr key={c.slug} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <Link href={`/prices/${p.country}/${c.slug}`} className="font-medium text-gray-900 hover:text-red-600 hover:underline">
                      {c.city}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {c.flatSalePerSqm != null ? money(c.flatSalePerSqm) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{c.listings.toLocaleString(p.locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        <p className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
