import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/routing";
import EmailAuthForm from "@/components/auth/EmailAuthForm";

export default async function RegisterPage() {
  const t = await getTranslations("Auth");

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-gray-950"
          >
            Nunvio
          </Link>
          <h1 className="mt-6 text-xl font-semibold text-gray-900">
            {t("registerTitle")}
          </h1>
          <p className="mt-2 text-sm text-gray-500">{t("registerSubtitle")}</p>
        </div>

        <div className="mt-8">
          <EmailAuthForm initialMode="register" />
        </div>
      </div>
    </main>
  );
}
