// ============================================
// EDIT PROPERTY PAGE
// ============================================
// Form for editing an existing property
// Protected by middleware - only authenticated users can access
// ============================================

import { getUserPropertyById } from "@/lib/properties.query";
import { updateProperty } from "@/lib/properties.server";
import { Currency, ListingOffer, PropertyType } from "@prisma/client";
import { notFound } from "next/navigation";
import { redirect } from "@/src/i18n/routing";
import PropertyForm from "@/components/properties/PropertyForm";
import { getTranslations } from "next-intl/server";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const tDashboard = await getTranslations("DashboardProperties");
  const property = await getUserPropertyById(id);

  if (!property) {
    notFound();
  }

  // Capture for the server action — do NOT close over the Promise `params`
  // (Next.js App Router: params must be awaited; otherwise propertyId is undefined).
  const propertyId = property.id;

  const translation = property.translations?.[0];

  const initialData = {
    title: translation?.translatedTitle || property.title,
    description: translation?.translatedDescription || property.description,
    price: Number(property.price),
    currency: property.currency as Currency,
    city: property.city,
    country: property.country,
    address: (property as any).address ?? property.city,
    latitude: property.latitude ?? undefined,
    longitude: property.longitude ?? undefined,
    showOnMap: property.showOnMap ?? true,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    areaSqm: property.areaSqm,
    propertyType: property.propertyType as PropertyType,
    offerType: property.offerType as ListingOffer,
    contactPhone: (property as any).contactPhone ?? null,
    isNewBuild: (property as any).isNewBuild ?? false,
    status: (property as any).status ?? "PUBLISHED",
  };

  async function handleSubmit(formData: FormData) {
    "use server";

    const images: string[] = [];
    let imageIndex = 0;
    while (formData.get(`images[${imageIndex}]`)) {
      const imageUrl = formData.get(`images[${imageIndex}]`) as string;
      if (imageUrl && imageUrl.trim()) images.push(imageUrl.trim());
      imageIndex++;
    }

    await updateProperty(propertyId, {
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
      bedrooms: parseInt(formData.get("bedrooms") as string) || 0,
      bathrooms: parseInt(formData.get("bathrooms") as string) || 0,
      areaSqm: parseInt(formData.get("areaSqm") as string) || 0,
      propertyType: formData.get("propertyType") as PropertyType,
      offerType: (formData.get("offerType") as ListingOffer) || ListingOffer.SALE,
      contactPhone: (formData.get("contactPhone") as string) || undefined,
      isNewBuild: formData.get("isNewBuild") === "true",
      status: (formData.get("status") as "DRAFT" | "PUBLISHED" | "ARCHIVED") || "PUBLISHED",
      images,
    });

    redirect({ href: "/dashboard/properties", locale });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        {tDashboard("editPropertyHeading")}
      </h1>
      <PropertyForm
        action={handleSubmit}
        propertyId={propertyId}
        initialImages={property.propertyImages ?? []}
        initialData={initialData}
        submitLabel={tDashboard("updatePropertyButton")}
      />
    </div>
  );
}
