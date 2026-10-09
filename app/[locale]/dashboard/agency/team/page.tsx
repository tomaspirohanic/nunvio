// ============================================
// AGENCY TEAM MANAGEMENT PAGE
// ============================================
// Protected route: Only AGENCY_ADMIN can access
// Displays list of agents and allows adding new agents
// ============================================

import { redirect } from "@/src/i18n/routing";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { getAgencyAgents, addAgent } from "@/lib/agency.server";
import TeamManagement from "@/components/agency/TeamManagement";
import { getTranslations } from "next-intl/server";

export default async function AgencyTeamPage({
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

  // Check user role and agency membership
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, agencyId: true },
  });

  // Only AGENCY_ADMIN can access this page
  if (user?.role !== UserRole.AGENCY_ADMIN) {
    redirect({ href: "/dashboard", locale });
  }

  if (!user.agencyId) {
    redirect({ href: "/dashboard/agency/setup", locale });
  }

  // Fetch agency and agents
  const agents = await getAgencyAgents();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {tAgency("teamHeading")}
        </h1>
        <p className="text-gray-600">
          {tAgency("teamSubtext")}
        </p>
      </div>

      <TeamManagement agents={agents} addAgent={addAgent} />
    </div>
  );
}
