import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import UnsubscribeButton from "@/components/alerts/UnsubscribeButton";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/**
 * Link target of "unsubscribe" in alert e-mails. Unsubscribing is a button
 * (not the page load), so link scanners in mail systems cannot trigger it.
 */
export default async function UnsubscribeAlertPage({
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
  const s =
    token && /^[a-f0-9]{48}$/.test(token)
      ? await prisma.savedSearch.findUnique({ where: { token }, select: { label: true, active: true } })
      : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-950">
        {s ? t("unsubscribeTitle") : t("invalidLinkTitle")}
      </h1>
      {s ? (
        <>
          <p className="mt-4 font-semibold text-gray-900">{s.label}</p>
          <div className="mt-8">
            <UnsubscribeButton token={token!} alreadyOff={!s.active} />
          </div>
        </>
      ) : (
        <p className="mt-3 text-gray-600">{t("invalidLinkBody")}</p>
      )}
    </div>
  );
}
