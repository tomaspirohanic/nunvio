"use client";

import { Link, usePathname } from "@/src/i18n/routing";
import { useSession } from "next-auth/react";
import {
  Home,
  LayoutDashboard,
  PlusCircle,
  Settings,
  Building2,
  Users,
  FileUp,
  X,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const mainNavItems: NavItem[] = [
  { href: "/dashboard", label: "Prehľad", icon: LayoutDashboard },
  { href: "/dashboard/properties", label: "Moje inzeráty", icon: Home },
  { href: "/dashboard/properties/new", label: "Pridať inzerát", icon: PlusCircle },
  { href: "/dashboard/settings", label: "Nastavenia", icon: Settings },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, locale: string, href: string) {
  const normalized = pathname || "";
  const withLocale = `/${locale}${href}`;
  // Avoid marking /dashboard/properties as active for /dashboard/properties/new
  if (href === "/dashboard") {
    return (
      normalized === "/dashboard" ||
      normalized === withLocale ||
      normalized === `/${locale}/dashboard`
    );
  }
  return (
    normalized === href ||
    normalized === withLocale ||
    normalized.startsWith(`${href}/`) ||
    normalized.startsWith(`${withLocale}/`)
  );
}

function NavLink({
  item,
  locale,
  onNavigate,
}: {
  item: NavItem;
  locale: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, locale, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      locale={locale}
      onClick={onNavigate}
      className={cx(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-blue-50 text-blue-700"
          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <Icon
        className={cx(
          "h-5 w-5 transition-colors",
          active ? "text-blue-700" : "text-gray-500 group-hover:text-gray-900"
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SidebarContent({
  locale,
  onNavigate,
  onCloseButton,
}: {
  locale: string;
  onNavigate?: () => void;
  onCloseButton?: () => void;
}) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const agencyId = session?.user?.agencyId;
  const hasAgency = Boolean(agencyId);
  const isAgencyAdmin = role === "AGENCY_ADMIN";

  return (
    <div className="h-full flex flex-col">
      <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200">
        <Link
          href="/dashboard"
          locale={locale}
          className="font-semibold tracking-tight text-gray-900"
          onClick={onNavigate}
        >
          Nunvio
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            Dashboard
          </span>
        </Link>
        {onCloseButton && (
          <button
            type="button"
            onClick={onCloseButton}
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} locale={locale} onNavigate={onNavigate} />
        ))}

        {isAgencyAdmin && hasAgency && (
          <div className="pt-4 mt-3 border-t border-gray-200 space-y-1">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Agentúra
            </div>
            <NavLink
              item={{ href: "/dashboard/agency/team", label: "Tím", icon: Users }}
              locale={locale}
              onNavigate={onNavigate}
            />
            <NavLink
              item={{
                href: "/dashboard/agency/import",
                label: "XML import",
                icon: FileUp,
              }}
              locale={locale}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {!hasAgency && (
          <div className="pt-4 mt-3 border-t border-gray-200 space-y-1">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Agentúra
            </div>
            <NavLink
              item={{
                href: "/dashboard/agency/setup",
                label: "Vytvoriť agentúru",
                icon: Building2,
              }}
              locale={locale}
              onNavigate={onNavigate}
            />
          </div>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-gray-200">
        <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900">Tip</div>
          <div className="mt-1 text-xs text-gray-600 leading-relaxed">
            Pridajte kvalitné fotky a presný popis. Zvýšite tak počet dopytov.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardSidebar({
  locale,
  mobileOpen,
  onClose,
}: {
  locale: string;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <aside className="w-64 bg-white border-r hidden md:flex flex-col fixed inset-y-0 z-40">
        <SidebarContent locale={locale} />
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white border-r shadow-xl">
            <SidebarContent
              locale={locale}
              onNavigate={onClose}
              onCloseButton={onClose}
            />
          </aside>
        </div>
      )}
    </>
  );
}
