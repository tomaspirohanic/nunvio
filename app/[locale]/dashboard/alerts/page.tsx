import { getServerSession } from "next-auth/next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { authConfig } from "@/auth/config";
import { listSavedSearchesForUser } from "@/lib/saved-search.server";
import SavedSearchList from "@/components/alerts/SavedSearchList";

export const dynamic = "force-dynamic";

export default async function DashboardAlertsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getServerSession(authConfig);
  if (!session?.user?.email || !session.user.id) redirect(`/${locale}/login`);
  const t = await getTranslations({ locale, namespace: "SavedSearch" });
  const searches = await listSavedSearchesForUser({
    id: session.user.id,
    email: session.user.email,
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">{t("dashboardTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("dashboardSubtitle")}</p>
      </div>
      <SavedSearchList
        searches={searches.map((s) => ({
          id: s.id,
          label: s.label,
          frequency: s.frequency,
          active: s.active,
          confirmed: !!s.confirmedAt,
          query: new URLSearchParams(
            Object.entries(s.filters as Record<string, unknown>).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.join(",") : String(v),
            ])
          ).toString(),
          lastNotifiedAt: s.lastNotifiedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
