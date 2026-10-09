import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth/config";
import { redirect } from "@/src/i18n/routing";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await getServerSession(authConfig);

  if (!session?.user?.email) {
    redirect({ href: "/login", locale });
  }

  return <DashboardLayoutClient locale={locale}>{children}</DashboardLayoutClient>;
}
