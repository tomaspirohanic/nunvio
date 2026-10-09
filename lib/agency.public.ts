// ============================================
// PUBLIC AGENCY QUERIES (READ-ONLY)
// ============================================

import { prisma } from "@/lib/db";
import { resolvePropertyImageUrls } from "@/lib/property-gallery";

export async function getPublicAgencyById(agencyId: string) {
  if (!agencyId || agencyId.trim().length === 0) return null;

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId.trim() },
    select: {
      id: true,
      name: true,
      companyId: true,
      address: true,
      city: true,
      country: true,
      phone: true,
      email: true,
      logoUrl: true,
      website: true,
      createdAt: true,
      _count: {
        select: {
          properties: { where: { status: "PUBLISHED" } },
          users: true,
        },
      },
    },
  });

  return agency;
}

export async function getPublicAgencyProperties(agencyId: string) {
  const properties = await prisma.property.findMany({
    where: { agencyId, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      currency: true,
      city: true,
      country: true,
      propertyType: true,
      offerType: true,
      bedrooms: true,
      bathrooms: true,
      areaSqm: true,
      images: true,
      propertyImages: {
        orderBy: { order: "asc" },
        select: { url: true, order: true },
      },
      promotionLevel: true,
      featuredUntil: true,
      createdAt: true,
    },
    orderBy: [{ promotionLevel: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return properties.map((p) => ({
    ...p,
    price: Number(p.price),
    images: resolvePropertyImageUrls(p),
    featuredUntil: p.featuredUntil ? p.featuredUntil.toISOString() : null,
  }));
}
