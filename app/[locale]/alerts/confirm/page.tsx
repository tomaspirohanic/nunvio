import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/routing";
import { confirmSavedSearch } from "@/lib/saved-search.server";
import { listingSearchQuery, type ListingSearchParams } from "@/lib/listing-search-params";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function ConfirmAlertPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations({ locale, namespace: "SavedSearch" });
  const s = token ? await confirmSavedSearch(token) : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-950">
        {s ? t("confirmedTitle") : t("invalidLinkTitle")}
      </h1>
      <p className="mt-3 text-gray-600">{s ? t("confirmedBody") : t("invalidLinkBody")}</p>
      {s && <p className="mt-4 font-semibold text-gray-900">{s.label}</p>}
      <div className="mt-8">
        <Link
          href={s ? `/properties?${listingSearchQuery(s.filters as ListingSearchParams)}` : "/properties"}
          className="inline-flex rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
        >
          {t("openSearch")}
        </Link>
      </div>
    </div>
  );
}
