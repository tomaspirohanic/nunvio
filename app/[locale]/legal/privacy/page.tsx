import { getTranslations } from "next-intl/server";

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");

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
            {t("controllerTitle")}
          </h2>
          <p>{t("controllerBody")}</p>
          <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-900">
            {t("companyPlaceholder")}
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("dataTitle")}
          </h2>
          <p>{t("dataBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("purposeTitle")}
          </h2>
          <p>{t("purposeBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("rightsTitle")}
          </h2>
          <p>{t("rightsBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("retentionTitle")}
          </h2>
          <p>{t("retentionBody")}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("contactTitle")}
          </h2>
          <p>{t("contactBody")}</p>
        </section>
      </div>
    </div>
  );
}
