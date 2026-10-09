import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/routing";
import EmailAuthForm from "@/components/auth/EmailAuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const t = await getTranslations("Auth");
  const params = await searchParams;
  const justVerified = params.verified === "1";

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
            {t("loginTitle")}
          </h1>
          <p className="mt-2 text-sm text-gray-500">{t("loginSubtitle")}</p>
        </div>

        {justVerified && (
          <p className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800">
            {t("verifiedSuccess")}
          </p>
        )}

        <div className="mt-8">
          <EmailAuthForm initialMode="login" />
        </div>
      </div>
    </main>
  );
}
