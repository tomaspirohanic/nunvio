import { redirect } from "@/src/i18n/routing";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import XmlImportForm from "@/components/agency/XmlImportForm";
import FeedSyncSettings from "@/components/agency/FeedSyncSettings";
import { processXmlImport } from "@/lib/import.server";
import {
  updateAgencyFeedSettings,
  syncAgencyFeedNow,
} from "@/lib/feed-sync.server";
import { getTranslations } from "next-intl/server";

export default async function XmlImportPage({
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

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, agencyId: true },
  });

  if (user?.role !== UserRole.AGENCY_ADMIN) {
    redirect({ href: "/dashboard", locale });
  }

  if (!user.agencyId) {
    redirect({ href: "/dashboard/agency/setup", locale });
  }

  const agency = await prisma.agency.findUnique({
    where: { id: user.agencyId },
    select: {
      feedUrl: true,
      feedSyncEnabled: true,
      feedOffset: true,
      feedLastSyncedAt: true,
      feedLastError: true,
      feedLastResult: true,
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          {tAgency("importHeading")}
        </h1>
        <p className="text-gray-600">{tAgency("importSubtext")}</p>
      </div>

      {agency && (
        <FeedSyncSettings
          initial={{
            feedUrl: agency.feedUrl,
            feedSyncEnabled: agency.feedSyncEnabled,
            feedOffset: agency.feedOffset,
            feedLastSyncedAt: agency.feedLastSyncedAt
              ? agency.feedLastSyncedAt.toISOString()
              : null,
            feedLastError: agency.feedLastError,
            feedLastResult: agency.feedLastResult,
          }}
          updateAgencyFeedSettings={updateAgencyFeedSettings}
          syncAgencyFeedNow={syncAgencyFeedNow}
        />
      )}

      <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Manuálny XML upload
            </h2>
            <a
              href="/samples/nunvio-properties-sample.xml"
              download
              className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              Stiahnuť ukážkový XML
            </a>
          </div>

          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <pre className="overflow-x-auto text-xs text-gray-600">{`<properties>
  <property>
    <externalId>CRM-1001</externalId>
    <title>Názov inzerátu</title>
    <description>Popis...</description>
    <price>250000</price>
    <currency>EUR</currency>
    <offerType>sale</offerType>
    <city>Bratislava</city>
    <country>Slovakia</country>
    <propertyType>APARTMENT</propertyType>
    <bedrooms>3</bedrooms>
    <bathrooms>1</bathrooms>
    <areaSqm>78</areaSqm>
    <latitude>48.1486</latitude>
    <longitude>17.1077</longitude>
    <images>
      <image>https://example.com/foto1.jpg</image>
      <image>https://example.com/foto2.jpg</image>
    </images>
  </property>
</properties>`}</pre>
          </div>

          <div className="space-y-1 text-sm text-gray-600">
            <p>
              <strong>Povinné:</strong> title, description, price, city, country
            </p>
            <p>
              <strong>Odporúčané:</strong> externalId (ID z vášho CRM — pri
              opätovnom importe sa inzerát aktualizuje, nevytvorí sa duplicita)
            </p>
            <p>
              <strong>Voliteľné:</strong> currency, offerType (sale/rent),
              propertyType, bedrooms, bathrooms, areaSqm, latitude, longitude,
              images
            </p>
            <p>
              <strong>Typy:</strong> HOUSE, APARTMENT, LAND, COMMERCIAL
            </p>
            <p>
              <strong>Meny:</strong> EUR, USD, GBP, CZK ·{" "}
              <strong>Max manuálny upload:</strong> 500 inzerátov / súbor, 8
              fotiek / inzerát. Pre veľké katalógy použite automatický feed URL
              vyššie.
            </p>
            <p className="text-gray-500">
              Fotky z URL sa stiahnu do Nunvio R2. Partner špecifikácia je v
              repozitári: docs/PARTNER-FEED.md
            </p>
          </div>
        </div>

        <XmlImportForm processXmlImport={processXmlImport} />
      </div>
    </div>
  );
}
