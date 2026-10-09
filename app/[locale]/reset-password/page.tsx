import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/routing";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getTranslations("Auth");
  const params = await searchParams;
  const token = params.token ?? "";

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
            {t("resetTitle")}
          </h1>
          <p className="mt-2 text-sm text-gray-500">{t("resetSubtitle")}</p>
        </div>

        <div className="mt-8">
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </main>
  );
}
