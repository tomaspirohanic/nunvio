import { getTranslations } from "next-intl/server";

export default async function TermsPage() {
  const t = await getTranslations("Terms");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-gray-950">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-gray-500">{t("lastUpdated")}</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-gray-700">
        <p>{t("intro")}</p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("serviceTitle")}
          </h2>
          <p>{t("serviceBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("accountsTitle")}
          </h2>
          <p>{t("accountsBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("listingsTitle")}
          </h2>
          <p>{t("listingsBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("liabilityTitle")}
          </h2>
          <p>{t("liabilityBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("lawTitle")}
          </h2>
          <p>{t("lawBody")}</p>
          <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-900">
            {t("companyPlaceholder")}
          </p>
        </section>
      </div>
    </div>
  );
}
