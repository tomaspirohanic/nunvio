// ============================================
// PROPERTY QUERIES (READ-ONLY)
// ============================================
// Read-only query functions for properties
// - Can be used by both server and client components
// - No mutations, no revalidatePath
// - Safe for public pages and client components
// ============================================

import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { Language } from "@prisma/client";
import type { PublicPropertyFilters } from "./properties.types";

// Re-export types for convenience
export type { PublicPropertyFilters, CreatePropertyInput } from "./properties.types";

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
 * Get all properties for the authenticated user
 */
export async function getUserProperties() {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Unauthorized");

  const properties = await prisma.property.findMany({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      currency: true,
      city: true,
      country: true,
      latitude: true,
      longitude: true,
      showOnMap: true,
      bedrooms: true,
      bathrooms: true,
      areaSqm: true,
      propertyType: true,
      offerType: true,
      images: true, // Include images array
      status: true,
      contactPhone: true,
      isNewBuild: true,
      promotionLevel: true,
      featuredUntil: true,
      createdAt: true,
      updatedAt: true,
      translations: {
        where: {
          language: Language.EN,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Compute isFeatured for each property and serialize Decimal to number
  const now = new Date();
  const propertiesWithFeatured = properties.map((property) => ({
    ...property,
    // Convert Prisma Decimal to number for client components
    price: Number(property.price),
    isFeatured:
      property.featuredUntil !== null &&
      property.featuredUntil > now,
  }));

  return propertiesWithFeatured;
}

/**
 * Get a single property for the authenticated user (for edit)
 */
export async function getUserPropertyById(propertyId: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Unauthorized");

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      ownerId: userId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      currency: true,
      city: true,
      country: true,
      address: true,
      latitude: true,
      longitude: true,
      showOnMap: true,
      bedrooms: true,
      bathrooms: true,
      areaSqm: true,
      propertyType: true,
      offerType: true,
      images: true, // Include images array
      status: true,
      contactPhone: true,
      isNewBuild: true,
      propertyImages: {
        select: {
          id: true,
          url: true,
          order: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          order: "asc",
        },
      },
      promotionLevel: true,
      featuredUntil: true,
      createdAt: true,
      updatedAt: true,
      translations: {
        where: {
          language: Language.EN,
        },
        take: 1,
      },
    },
  });

  // Convert Prisma Decimal to number for client components
  if (property) {
    return {
      ...property,
      price: Number(property.price),
    };
  }

  return property;
}

/**
 * Get public properties with optional filters.
 * Hard-capped (default 200, max 500) so homepage/helpers stay safe at ~100k scale.
 * Prefer paginated /properties for browsing.
 */
export async function getPublicProperties(
  filters: PublicPropertyFilters = {},
  options: { take?: number } = {}
) {
  // Lazy-expire promotions so featured badges stay truthful without a cron.
  try {
    const { expireOutdatedPromotions } = await import("@/lib/promotions.server");
    await expireOutdatedPromotions();
  } catch {
    // non-fatal
  }

  const take = Math.min(Math.max(options.take ?? 200, 1), 500);

  const where: any = {
    status: "PUBLISHED",
  };

  // Location filters (case-insensitive)
  // Use mode: 'insensitive' for PostgreSQL, or filter in JavaScript for SQLite
  if (filters.city) {
    where.city = {
      contains: filters.city,
      mode: "insensitive", // Case-insensitive search
    };
  }
  if (filters.country) {
    where.country = {
      contains: filters.country,
      mode: "insensitive", // Case-insensitive search
    };
  }

  // Property type filter
  if (filters.propertyType) {
    where.propertyType = filters.propertyType;
  }

  // Price range filter
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {};
    if (filters.minPrice !== undefined) {
      where.price.gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      where.price.lte = filters.maxPrice;
    }
  }

  // Currency filter (optional - if not specified, shows all currencies)
  if (filters.currency) {
    where.currency = filters.currency;
  }

  // Note: We'll sort featured properties in JavaScript after fetching
  // because SQLite doesn't support complex nulls handling in orderBy
  const properties = await prisma.property.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      currency: true,
      city: true,
      country: true,
      latitude: true,
      longitude: true,
      showOnMap: true,
      bedrooms: true,
      bathrooms: true,
      areaSqm: true,
      propertyType: true,
      offerType: true,
      images: true, // Include images array
      promotionLevel: true,
      featuredUntil: true,
      createdAt: true,
      updatedAt: true,
      translations: {
        where: {
          language: Language.EN,
        },
        take: 1, // Only need one EN translation
      },
    },
    orderBy: [
      // First by promotion level (PLATINUM > GOLD > SILVER > NONE)
      { promotionLevel: "desc" },
      // Then by creation date (newest first)
      { createdAt: "desc" },
    ],
    take,
  });

  // Compute isFeatured based on featuredUntil > now and serialize Decimal to number
  const now = new Date();
  const propertiesWithFeatured = properties.map((property) => ({
    ...property,
    // Convert Prisma Decimal to number for client components
    price: Number(property.price),
    isFeatured:
      property.featuredUntil !== null &&
      property.featuredUntil > now,
  }));

  // Re-sort to ensure featured properties appear first
  propertiesWithFeatured.sort((a, b) => {
    // Featured properties first
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;

    // Then by promotion level
    const promotionOrder: Record<string, number> = {
      GOLD: 3,
      SILVER: 2,
      BRONZE: 1,
      NONE: 0,
    };
    const aPromo = promotionOrder[a.promotionLevel] || 0;
    const bPromo = promotionOrder[b.promotionLevel] || 0;
    if (aPromo !== bPromo) return bPromo - aPromo;

    // Then by creation date
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  return propertiesWithFeatured;
}

/**
 * Get a single public property by ID
 * - No authentication required
 * - Includes EN translation
 * - Returns null if not found (for 404 handling)
 * - Does not expose sensitive user data (no ownerId, no user email)
 * - Handles edge cases and ensures all required fields are present
 */
export async function getPublicPropertyById(id: string) {
  try {
    const property = await prisma.property.findFirst({
      where: {
        id,
        status: "PUBLISHED",
      },
      select: {
        // Public-safe fields only - no ownerId, no user data
        id: true,
        title: true,
        description: true,
        price: true,
        currency: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        showOnMap: true, // Privacy setting for map display
        bedrooms: true,
        bathrooms: true,
        areaSqm: true,
        propertyType: true,
        images: true, // Include images array
        promotionLevel: true, // For promotion badge display
        featuredUntil: true, // For promotion badge display
        createdAt: true,
        updatedAt: true,
        translations: {
          where: {
            language: Language.EN,
          },
          take: 1,
        },
      },
    });

    // Validate that required numeric fields are valid numbers
    // This prevents issues with corrupted data (NaN values)
    // Also convert Prisma Decimal to number for client components
    if (property) {
      // Convert Prisma Decimal to number and ensure all numeric fields are valid
      const bedrooms = typeof property.bedrooms === "number" && !isNaN(property.bedrooms) 
        ? property.bedrooms 
        : 0;
      const bathrooms = typeof property.bathrooms === "number" && !isNaN(property.bathrooms)
        ? property.bathrooms
        : 0;
      const areaSqm = typeof property.areaSqm === "number" && !isNaN(property.areaSqm)
        ? property.areaSqm
        : 0;

      return {
        ...property,
        price: Number(property.price), // Convert Decimal to number
        bedrooms,
        bathrooms,
        areaSqm,
      };
    }

    return property;
  } catch (error) {
    console.error("Error fetching property by ID:", error);
    // Return null instead of throwing to allow 404 handling
    return null;
  }
}
