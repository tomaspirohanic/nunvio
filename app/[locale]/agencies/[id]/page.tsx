// ============================================
// PUBLIC AGENCY PROFILE PAGE
// ============================================
// Sreality / Zillow-style agency page: logo, contact, all listings
// ============================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/routing";
import {
  getPublicAgencyById,
  getPublicAgencyProperties,
} from "@/lib/agency.public";
import PropertyCard from "@/components/properties/PropertyCard";
import { Building2, Globe, MapPin } from "lucide-react";

function agencyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const agency = await getPublicAgencyById(id);
  if (!agency) {
    return { title: "Agency Not Found | Nunvio" };
  }
  return {
    title: `${agency.name} | Nunvio`,
    description: `${agency.name} — ${agency.city}, ${agency.country}. Real estate listings on Nunvio.`,
  };
}

export default async function AgencyProfilePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "AgencyProfile" });

  const agency = await getPublicAgencyById(id);
  if (!agency) notFound();

  const properties = await getPublicAgencyProperties(agency.id);
  const initials = agencyInitials(agency.name);
  const websiteHref =
    agency.website && /^https?:\/\//i.test(agency.website)
      ? agency.website
      : agency.website
        ? `https://${agency.website}`
        : null;

  return (
    <div className="bg-white min-h-screen">
      {/* Hero band */}
      <div className="border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {agency.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agency.logoUrl}
                  alt={agency.name}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <span className="text-2xl font-bold text-gray-700">{initials}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("badge")}
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950 md:text-4xl">
                {agency.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {agency.address}, {agency.city}, {agency.country}
                </span>
                {websiteHref && (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    {t("website")}
                  </a>
                )}
              </div>
            </div>

            <div className="flex gap-3 sm:flex-col sm:items-end">
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-gray-950">
                  {agency._count.properties}
                </div>
                <div className="text-xs text-gray-500">{t("listingsCount")}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-gray-950">
                  {agency._count.users}
                </div>
                <div className="text-xs text-gray-500">{t("agentsCount")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-950">
              {t("listingsHeading")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("listingsSubtext", { count: properties.length })}
            </p>
          </div>
          <Link
            href="/properties"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {t("browseAll")}
          </Link>
        </div>

        {properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
            <Building2 className="h-10 w-10 text-gray-300" />
            <p className="mt-4 font-medium text-gray-700">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-gray-500">{t("emptyDesc")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property as any}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
