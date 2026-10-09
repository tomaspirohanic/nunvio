import { Link } from "@/src/i18n/routing";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const tAgency = await getTranslations("AgencyDashboard");
  return (
    <div className="text-center py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        {tAgency("agencyAlreadyExistsHeading")}
      </h1>
      <p className="text-gray-600 mb-6">
        {tAgency("agencyAlreadyExistsSubtext")}
      </p>
      <Link
        href="/dashboard/agency/team"
        className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        {tAgency("agencyAlreadyExistsCta")}
      </Link>
    </div>
  );
}
