"use client";

import { useEffect, useState } from "react";
import { usePathname } from "@/src/i18n/routing";
import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";

export default function DashboardLayoutClient({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile sidebar on route changes (best-effort).
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar
        locale={locale}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex min-h-screen flex-col md:pl-64">
        <DashboardHeader
          locale={locale}
          onToggleMobileSidebar={() => setMobileSidebarOpen((v) => !v)}
        />

        <main className="flex-1 bg-gray-50 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

