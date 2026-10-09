// ============================================
// AGENCY SETUP PAGE
// ============================================
// Allows users to register their real estate agency
// Creates Agency record and updates user to AGENCY_ADMIN
// ============================================

import { redirect } from "@/src/i18n/routing";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { createAgency } from "@/lib/agency.server";
import AgencySetupForm from "@/components/agency/AgencySetupForm";
import { getTranslations } from "next-intl/server";

export default async function AgencySetupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tAgency = await getTranslations("AgencyDashboard");
  const session = await getServerSession(authConfig);

  if (!session?.user?.email) {
    redirect({ href: "/login", locale });
  }

  // Check if user already has an agency
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { agencyId: true, role: true },
  });

  // If user already has an agency, redirect to agency dashboard
  if (user?.agencyId) {
    redirect({ href: "/dashboard/agency/team", locale });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {tAgency("registerHeading")}
        </h1>
        <p className="text-gray-600 mb-8">
          {tAgency("registerSubtext")}
        </p>

        <AgencySetupForm createAgency={createAgency} />
      </div>
    </div>
  );
}
