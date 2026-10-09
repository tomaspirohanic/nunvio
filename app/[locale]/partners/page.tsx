import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/routing";

export default async function PartnersPage() {
  const t = await getTranslations("Partners");
  const contact =
    process.env.PARTNER_CONTACT_EMAIL ||
    process.env.EMAIL_FROM?.replace(/.*<([^>]+)>.*/, "$1") ||
    "partners@nunvio.com";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://nunvio.vercel.app";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        {t("title")}
      </h1>
      <p className="mt-3 text-lg text-gray-600">{t("intro")}</p>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">{t("howTitle")}</h2>
        <ol className="list-decimal space-y-2 pl-5 text-gray-700">
          <li>{t("how1")}</li>
          <li>{t("how2")}</li>
          <li>{t("how3")}</li>
          <li>{t("how4")}</li>
        </ol>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("crmTitle")}
        </h2>
        <p className="text-gray-700">{t("crmBody")}</p>
        <ul className="list-disc space-y-1 pl-5 text-gray-700">
          <li>Slovensko: backOFFICE / ZRKS, RealSys, easyReal.NET</li>
          <li>Česko: Softreal, Urbium, REALBrána, Poski REAL</li>
        </ul>
      </section>

      <section className="mt-10 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("techTitle")}
        </h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>
            <strong>Sample XML:</strong>{" "}
            <a
              className="text-blue-700 underline"
              href="/samples/nunvio-properties-sample.xml"
            >
              /samples/nunvio-properties-sample.xml
            </a>
          </li>
          <li>
            <strong>Validate feed (API):</strong>{" "}
            <code className="rounded bg-white px-1">
              POST {appUrl}/api/partners/validate-feed
            </code>
          </li>
          <li>
            <strong>Docs:</strong> docs/PARTNER-FEED.md (v repozitári)
          </li>
          <li>
            <strong>Sync:</strong> {t("techSync")}
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">
          {t("contactTitle")}
        </h2>
        <p className="text-gray-700">
          {t("contactBody")}{" "}
          <a
            className="font-medium text-blue-700 underline"
            href={`mailto:${contact}?subject=Nunvio%20XML%20partner%20integration`}
          >
            {contact}
          </a>
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/register"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t("ctaRegister")}
          </Link>
          <a
            href="/samples/nunvio-properties-sample.xml"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            {t("ctaSample")}
          </a>
        </div>
      </section>
    </div>
  );
}
