import { Link } from "@/src/i18n/routing";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function DashboardNav() {
  const session = await getServerSession(authConfig);
  let userRole: string | null = null;
  let hasAgency = false;
  const t = await getTranslations("DashboardNav");

  // Use session data if available (includes role and agencyId from JWT)
  if (session?.user) {
    userRole = session.user.role || null;
    hasAgency = !!session.user.agencyId;

    // Fallback: If session doesn't have role/agencyId, fetch from DB
    // This can happen if the user logged in before we added these fields to the session
    if ((!userRole || !hasAgency) && session.user.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      if (user) {
        userRole = user.role || userRole;
        // Type assertion needed until Prisma client types are fully regenerated
        hasAgency = !!(user as any).agencyId || hasAgency;
      }
    }
  }

  return (
    <nav className="space-y-2">
      <Link
        href="/dashboard"
        className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
      >
        {t("dashboard")}
      </Link>
      <Link
        href="/dashboard/properties"
        className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
      >
        {t("myProperties")}
      </Link>

      {/* Agency Admin Links */}
      {userRole === "AGENCY_ADMIN" && hasAgency && (
        <>
          <div className="pt-4 mt-4 border-t border-gray-200">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t("agencySection")}
            </div>
          </div>
          <Link
            href="/dashboard/agency/team"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            {t("manageTeam")}
          </Link>
          <Link
            href="/dashboard/agency/import"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            {t("xmlImport")}
          </Link>
        </>
      )}

      {/* Private User - Upgrade Option */}
      {userRole === "PRIVATE_USER" && !hasAgency && (
        <>
          <div className="pt-4 mt-4 border-t border-gray-200">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t("upgradeSection")}
            </div>
          </div>
          <Link
            href="/dashboard/agency/setup"
            className="block px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors font-medium"
          >
            {t("upgradeToAgencyAccount")}
          </Link>
        </>
      )}

      {/* User without agency but not PRIVATE_USER - Show setup option */}
      {userRole !== "PRIVATE_USER" && !hasAgency && (
        <>
          <div className="pt-4 mt-4 border-t border-gray-200">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t("agencySetupSection")}
            </div>
          </div>
          <Link
            href="/dashboard/agency/setup"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            {t("agencySetup")}
          </Link>
        </>
      )}
    </nav>
  );
}
  