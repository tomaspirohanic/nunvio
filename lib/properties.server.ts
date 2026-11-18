// ============================================
// PROPERTY SERVER ACTIONS (SERVER-ONLY)
// ============================================
// Server-side mutation functions for property CRUD operations
// - All operations require authentication
// - Properties are automatically linked to authenticated user
// - Uses revalidatePath (server-only, cannot be imported by client components)
// ============================================

"use server";

import { priceChangeData } from "@/lib/price-history.server";
import { countryCodeFor } from "@/lib/country-display";
import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { ListingOffer, PropertyStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { revalidateListings } from "@/lib/revalidate-listings";
import type { CreatePropertyInput } from "./properties.types";

const getAuthenticatedUserId = async (): Promise<string | null> => {
  const session = await getServerSession(authConfig);

  if (session?.user?.id) {
    return session.user.id;
  }

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  const token = await getToken({
    req: { headers: { cookie: cookies().toString() } } as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token?.userId) {
    return token.userId as string;
  }

  if (token?.email) {
    const user = await prisma.user.findUnique({
      where: { email: token.email as string },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  return null;
};

/**
 * Create a new property for the authenticated user
 * Also creates default EN translation
 */
export async function createProperty(input: CreatePropertyInput) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized");

    // Get user's agencyId if they belong to an agency
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agencyId: true },
    });

    // Validate required fields
    if (!input.title || !input.description || !input.city || !input.country) {
      throw new Error("Missing required fields");
    }

    if (input.price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    // Image URLs uploaded to S3/R2 (client-side). Persist both:
    // - legacy `Property.images` string[] (backward compatibility)
    // - new `PropertyImage` rows for scalable ordering/metadata.
    const imageUrls = Array.isArray(input.images)
      ? input.images.filter((u) => typeof u === "string" && u.trim().length > 0).map((u) => u.trim())
      : [];

    // Create property with translation in a transaction
    const property = await prisma.property.create({
      data: {
        title: input.title,
        description: input.description,
        price: input.price,
        currency: input.currency,
        city: input.city,
        country: input.country,
        countryCode: countryCodeFor(input.country),
        address: input.address?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        showOnMap: input.showOnMap ?? true, // Default to true for privacy
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        areaSqm: input.areaSqm,
        propertyType: input.propertyType,
        offerType: input.offerType ?? ListingOffer.SALE,
        contactPhone: input.contactPhone?.trim() || null,
        isNewBuild: input.isNewBuild ?? false,
        status: (input.status as PropertyStatus) || PropertyStatus.PUBLISHED,
        images: imageUrls, // legacy array (keep in sync for now)
        ...(imageUrls.length > 0
          ? {
              propertyImages: {
                create: imageUrls.map((url, index) => ({
                  url,
                  order: index,
                })),
              },
            }
          : {}),
        ownerId: userId,
        agencyId: user?.agencyId || null, // Auto-link to agency if user belongs to one
        // No translation rows here: the original text is shown in every
        // locale until the background job (/api/cron/translate-listings)
        // stores real translations.
      },
      include: {
        translations: true,
      },
    });

    revalidatePath("/dashboard/properties");
    revalidateListings([property.id]);

    return property;
  } catch (error) {
    console.error("createProperty failed:", error);
    throw error;
  }
}

/**
 * Update a property (only if owned by authenticated user)
 * Also updates the default EN translation
 */
export async function updateProperty(
  propertyId: string,
  input: CreatePropertyInput
) {
  try {
    if (!propertyId || typeof propertyId !== "string" || propertyId.trim().length === 0) {
      throw new Error("Missing property id — cannot update.");
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Unauthorized");

    // Validate required fields
    if (!input.title || !input.description || !input.city || !input.country) {
      throw new Error("Missing required fields");
    }

    if (!Number.isFinite(input.price) || input.price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    const existing = await prisma.property.findFirst({
      where: {
        id: propertyId,
        ownerId: userId,
      },
    });

    if (!existing) {
      throw new Error("Property not found or unauthorized");
    }

    const textChanged =
      existing.title !== input.title || existing.description !== input.description;

    // Validate images array if provided
    const images = Array.isArray(input.images) ? input.images : undefined;

    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: {
        title: input.title,
        description: input.description,
        price: input.price,
        currency: input.currency,
        city: input.city,
        country: input.country,
        countryCode: countryCodeFor(input.country),
        address: input.address?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        showOnMap: input.showOnMap ?? true, // Default to true for privacy
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        areaSqm: input.areaSqm,
        propertyType: input.propertyType,
        offerType: input.offerType ?? ListingOffer.SALE,
        contactPhone: input.contactPhone?.trim() || null,
        isNewBuild: input.isNewBuild ?? false,
        ...priceChangeData(existing, input.price, input.currency),
        ...(input.status
          ? { status: input.status as PropertyStatus }
          : {}),
        ...(images !== undefined && { images }), // Only update images if provided
        // Text changed -> stored translations are stale; the background job
        // re-translates them.
        ...(textChanged ? { translations: { deleteMany: {} } } : {}),
      },
      include: {
        translations: true,
      },
    });

    revalidatePath("/dashboard/properties");
    revalidateListings([propertyId]);

    return updated;
  } catch (error) {
    console.error("updateProperty failed:", error);
    throw error;
  }
}

/**
 * Delete a property (only if owned by authenticated user)
 */
export async function deleteProperty(propertyId: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Unauthorized");

  // Verify ownership before deleting
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      ownerId: userId,
    },
  });

  if (!property) {
    throw new Error("Property not found or unauthorized");
  }

  // Delete property (cascade will delete translations)
  await prisma.property.delete({
    where: {
      id: propertyId,
    },
  });

  revalidatePath("/dashboard/properties");
  revalidateListings([propertyId]);

  return { success: true };
}

/**
 * Publish / unpublish / archive a listing owned by the current user.
 */
export async function setPropertyStatus(
  propertyId: string,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Unauthorized");

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId: userId },
    select: { id: true },
  });
  if (!property) throw new Error("Property not found or unauthorized");

  await prisma.property.update({
    where: { id: propertyId },
    data: { status: status as PropertyStatus },
  });

  revalidatePath("/dashboard/properties");
  revalidateListings([propertyId]);
  return { success: true };
}
