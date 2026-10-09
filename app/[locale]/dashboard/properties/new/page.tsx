// ============================================
// CREATE PROPERTY PAGE
// ============================================
// Form for creating a new property
// Protected by middleware - only authenticated users can access
// ============================================

import { createProperty } from "@/lib/properties.server";
import { Currency, ListingOffer, PropertyType } from "@prisma/client";
import { redirect } from "@/src/i18n/routing";
import PropertyForm from "@/components/properties/PropertyForm";
import { getTranslations } from "next-intl/server";

export default async function NewPropertyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tDashboard = await getTranslations("DashboardProperties");

  async function handleSubmit(formData: FormData) {
    "use server";

    try {
      // Extract images array from form data
      const images: string[] = [];
      let imageIndex = 0;
      while (formData.get(`images[${imageIndex}]`)) {
        const imageUrl = formData.get(`images[${imageIndex}]`) as string;
        if (imageUrl && imageUrl.trim()) {
          images.push(imageUrl.trim());
        }
        imageIndex++;
      }

      const property = await createProperty({
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        price: parseFloat(formData.get("price") as string),
        currency: formData.get("currency") as Currency,
        city: formData.get("city") as string,
        country: formData.get("country") as string,
        address: (formData.get("address") as string) || undefined,
        latitude: formData.get("latitude")
          ? parseFloat(formData.get("latitude") as string)
          : undefined,
        longitude: formData.get("longitude")
          ? parseFloat(formData.get("longitude") as string)
          : undefined,
        showOnMap: formData.get("showOnMap") === "true",
        bedrooms: parseInt(formData.get("bedrooms") as string),
        bathrooms: parseInt(formData.get("bathrooms") as string),
        areaSqm: parseInt(formData.get("areaSqm") as string),
        propertyType: formData.get("propertyType") as PropertyType,
        offerType: (formData.get("offerType") as ListingOffer) || ListingOffer.SALE,
        contactPhone: (formData.get("contactPhone") as string) || undefined,
        isNewBuild: formData.get("isNewBuild") === "true",
        status: (formData.get("status") as "DRAFT" | "PUBLISHED" | "ARCHIVED") || "PUBLISHED",
        images: images, // Pass array (empty or with URLs)
      });

      redirect({ href: "/dashboard/properties", locale });
    } catch (error) {
      console.error("Error creating property:", error);
      throw error;
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        {tDashboard("createNewPropertyHeading")}
      </h1>
      <PropertyForm action={handleSubmit} submitLabel={tDashboard("createPropertyButton")} />
    </div>
  );
}
