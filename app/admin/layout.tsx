import Link from "next/link";
import Providers from "@/app/providers";
import {
  LayoutDashboard,
  Users,
  Building2,
  Home,
  Shield,
  Rss,
} from "lucide-react";
import { requireSuperadmin } from "@/lib/admin-auth";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/agencies", label: "Agencies", icon: Building2 },
  { href: "/admin/properties", label: "Properties", icon: Home },
  { href: "/admin/feeds", label: "XML feeds", icon: Rss },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireSuperadmin();

  return (
    <Providers>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-start gap-6">
            <aside className="w-64 shrink-0">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-gray-900" />
                    <div className="font-semibold">Superadmin</div>
                  </div>
                  <div className="mt-1 truncate text-xs text-gray-500">
                    {admin.email}
                  </div>
                </div>
                <nav className="p-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="border-t border-gray-100 p-3">
                  <Link
                    href="/sk"
                    className="block rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    ← Späť na portál
                  </Link>
                </div>
              </div>
            </aside>

            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </div>
      </div>
    </Providers>
  );
}
