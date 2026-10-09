"use client";

import { useSession, signOut } from "next-auth/react";
import { useLocale } from "next-intl";
import { Link } from "@/src/i18n/routing";

export default function DashboardSettingsPage() {
  const { data: session, status } = useSession();
  const locale = useLocale();

  if (status === "loading") {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">
          Nastavenia
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Účet a základné nastavenia pre váš dashboard.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Účet
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Meno</dt>
            <dd className="font-medium text-gray-900">{user?.name || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">E-mail</dt>
            <dd className="font-medium text-gray-900">{user?.email || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Rola</dt>
            <dd className="font-medium text-gray-900">{user?.role || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Agentúra</dt>
            <dd className="font-medium text-gray-900">
              {user?.agencyId ? "Pripojená" : "Žiadna"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Rýchle odkazy
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/properties"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Moje inzeráty
          </Link>
          {!user?.agencyId && (
            <Link
              href="/dashboard/agency/setup"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Vytvoriť agentúru
            </Link>
          )}
          {user?.agencyId && user?.role === "AGENCY_ADMIN" && (
            <>
              <Link
                href={`/agencies/${user.agencyId}`}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Verejný profil agentúry
              </Link>
              <Link
                href="/dashboard/agency/team"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Správa tímu
              </Link>
              <Link
                href="/dashboard/agency/import"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                XML import
              </Link>
            </>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: `/${locale}` })}
        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Odhlásiť sa
      </button>
    </div>
  );
}
