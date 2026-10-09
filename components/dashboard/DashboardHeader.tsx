"use client";

import { Link } from "@/src/i18n/routing";
import { signOut, useSession } from "next-auth/react";
import { Menu, LogOut } from "lucide-react";

function initials(name?: string | null) {
  const cleaned = (name || "").trim();
  if (!cleaned) return "U";
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

export default function DashboardHeader({
  locale,
  onToggleMobileSidebar,
}: {
  locale: string;
  onToggleMobileSidebar: () => void;
}) {
  const { data: session, status } = useSession();
  const user = session?.user;

  return (
    <header className="h-16 bg-white border-b flex items-center px-4 justify-between md:justify-end sticky top-0 z-30">
      <button
        type="button"
        onClick={onToggleMobileSidebar}
        className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      <div className="flex items-center gap-3">
        {status === "loading" ? (
          <div className="h-9 w-40 bg-gray-100 rounded-lg animate-pulse" />
        ) : (
          <>
            <Link
              href="/dashboard/settings"
              locale={locale}
              className="hidden sm:block text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {user?.name || user?.email || "Dashboard"}
            </Link>

            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-semibold overflow-hidden">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user?.name || "User avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(user?.name)
              )}
            </div>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: `/${locale}/` })}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Odhlásiť</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}

