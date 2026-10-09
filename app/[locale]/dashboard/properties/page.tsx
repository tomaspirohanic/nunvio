// ============================================
// DASHBOARD PROPERTIES PAGE
// ============================================
// Displays list of authenticated user's properties
// Protected by middleware - only authenticated users can access
// ============================================

import { getUserProperties } from "@/lib/properties.query";
import { Link } from "@/src/i18n/routing";
import { Currency, PropertyType, PromotionLevel } from "@prisma/client";
import DeletePropertyButton from "@/components/properties/DeletePropertyButton";
import PromotePropertyButton from "@/components/properties/PromotePropertyButton";
import PropertyPrice from "@/components/properties/PropertyPrice";
import { verifyCheckoutSession } from "@/lib/stripe.server";
import { getTranslations } from "next-intl/server";

interface PropertiesPageProps {
  searchParams: Promise<{
    success?: string;
    canceled?: string;
    session_id?: string;
  }>;
}

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  const params = await searchParams;
  const showSuccess = params.success === "true";
  const showCanceled = params.canceled === "true";
  const sessionId = params.session_id;

  const tDashboard = await getTranslations("DashboardProperties");
  const tCommon = await getTranslations("Common");
  const tProperties = await getTranslations("Properties");
  const tPropertyTypes = await getTranslations("PropertyTypes");

  // Verify checkout session if success=true and session_id exists
  // This is a fallback for when webhooks are blocked (e.g., corporate firewall)
  let verificationResult: { success: boolean; message?: string } | null = null;
  if (showSuccess && sessionId) {
    try {
      verificationResult = await verifyCheckoutSession(sessionId);
      if (verificationResult.success) {
        console.log("✅ Payment verified via active session check");
      } else {
        console.error("❌ Payment verification failed:", verificationResult.message);
      }
    } catch (error) {
      console.error("❌ Error verifying checkout session:", error);
      verificationResult = { success: false, message: "Verification error" };
    }
  }

  const properties = await getUserProperties();

  return (
    <div className="space-y-6">
      {/* Success Alert */}
      {showSuccess && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                {verificationResult?.success
                  ? tDashboard("paymentVerifiedMessage")
                  : tDashboard("paymentSuccessfulMessage")}
              </p>
              {verificationResult && !verificationResult.success && (
                <p className="text-xs text-yellow-700 mt-1">
                  {tDashboard("paymentVerificationIssueNote")}
                </p>
              )}
            </div>
            <div className="ml-auto pl-3">
              <Link
                href="/dashboard/properties"
                className="text-green-700 hover:text-green-900 text-sm font-medium"
              >
                {tDashboard("dismiss")}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Canceled Alert */}
      {showCanceled && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">
                {tDashboard("paymentCanceledMessage")}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <Link
                href="/dashboard/properties"
                className="text-yellow-700 hover:text-yellow-900 text-sm font-medium"
              >
                {tDashboard("dismiss")}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{tDashboard("title")}</h1>
        <Link
          href="/dashboard/properties/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {tDashboard("createPropertyButton")}
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">{tDashboard("noPropertiesMessage")}</p>
          <Link
            href="/dashboard/properties/new"
            className="text-blue-600 hover:underline"
          >
            {tDashboard("createFirstProperty")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              tCommon={tCommon}
              tProperties={tProperties}
              tPropertyTypes={tPropertyTypes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyCard({
  property,
  tCommon,
  tProperties,
  tPropertyTypes,
}: {
  property: any;
  tCommon: (key: any) => string;
  tProperties: (key: any) => string;
  tPropertyTypes: (key: any) => string;
}) {
  // Check if promotion is active (not NONE and featuredUntil is in the future)
  // Handle both Date objects and date strings (from Server Component serialization)
  // Safely parse the date and check if it's valid and in the future
  const featuredUntilDate = property.featuredUntil 
    ? new Date(property.featuredUntil) 
    : null;
  const isPromotionActive =
    property.promotionLevel !== PromotionLevel.NONE &&
    featuredUntilDate &&
    !isNaN(featuredUntilDate.getTime()) &&
    featuredUntilDate > new Date();

  // Get promotion badge styling based on level (text-only, no emojis)
  const getPromotionBadge = () => {
    if (!isPromotionActive) return null;

    switch (property.promotionLevel) {
      case PromotionLevel.BRONZE:
        return {
          className: "bg-orange-100 text-orange-800 border border-orange-300",
          label: "BRONZE",
        };
      case PromotionLevel.SILVER:
        return {
          className: "bg-slate-200 text-slate-800 border border-slate-400",
          label: "SILVER",
        };
      case PromotionLevel.GOLD:
        return {
          className: "bg-yellow-400 text-yellow-900 shadow-md border border-yellow-500",
          label: "GOLD",
        };
      default:
        return null;
    }
  };

  const promotionBadge = getPromotionBadge();

  // Fallback image for properties without images
  const propertyImage = property.images && property.images.length > 0
    ? property.images[0]
    : "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop&q=80";

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      {/* Property Image with Badge */}
      <div className="relative w-full h-48 bg-gray-100">
        <img
          src={propertyImage}
          alt={property.title}
          className="w-full h-full object-cover"
        />
        {/* Promotion Badge - Top Left */}
        {promotionBadge && (
          <div className="absolute top-2 left-2 z-10">
            <div
              className={`px-2 py-1 text-xs font-bold uppercase rounded ${promotionBadge.className}`}
            >
              {promotionBadge.label}
            </div>
          </div>
        )}
      </div>

      <div className="p-6">

        <div className="flex justify-between items-start mb-4">
          <Link
            href={`/properties/${property.id}`}
            className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors"
          >
            {property.title}
          </Link>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {tPropertyTypes(property.propertyType)}
          </span>
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {property.description}
        </p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-500">
          <span className="font-medium">{tProperties("location")}:</span>
            <span className="ml-2">
              {property.city}, {property.country}
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <span className="font-medium">{tProperties("price")}:</span>
            <span className="ml-2">
              <PropertyPrice
                price={property.price}
                originalCurrency={property.currency}
                size="md"
              />
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>
              <span className="font-medium">{tProperties("bedrooms")}:</span> {property.bedrooms}
            </span>
            <span>
              <span className="font-medium">{tProperties("bathrooms")}:</span> {property.bathrooms}
            </span>
            <span>
              <span className="font-medium">{tProperties("area")}:</span> {property.areaSqm} m²
            </span>
          </div>
        </div>

      <div className="space-y-2 pt-4 border-t border-gray-200">
        <PromotePropertyButton
          propertyId={property.id}
          currentPromotionLevel={property.promotionLevel}
          featuredUntil={property.featuredUntil}
        />
        <div className="flex gap-2">
          <Link
            href={`/dashboard/properties/${property.id}/edit`}
            className="flex-1 text-center text-sm text-blue-600 hover:text-blue-800 py-2 rounded hover:bg-blue-50 transition-colors"
          >
            {tCommon("edit")}
          </Link>
          <DeletePropertyButton propertyId={property.id} />
        </div>
      </div>
      </div>
    </div>
  );
}
