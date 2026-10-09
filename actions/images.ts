"use server";

// ============================================
// PROPERTY IMAGE SERVER ACTIONS
// ============================================
// Thin, authenticated boundary between the client and the storage layer.
//
// Responsibilities:
// - Authenticate the caller via NextAuth (getServerSession) BEFORE issuing
//   any presigned URL or writing to the database.
// - Delegate all object-storage concerns to `lib/storage/s3.ts`.
// - Persist uploaded image metadata via Prisma after the browser confirms
//   a successful direct-to-cloud upload.
//
// Flow:
//   1) Client calls getUploadUrl() -> receives a short-lived presigned PUT URL.
//   2) Client PUTs the file directly to S3/R2 (bytes never touch our server).
//   3) Client calls savePropertyImage() with the returned public URL.
// ============================================

import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import {
  generatePresignedUrl,
  type PresignedUploadResult,
} from "@/lib/storage/s3";

// Re-export so existing consumers (e.g. lib/upload.ts) keep their import path.
export type { PresignedUploadResult };

export type SavePropertyImageResult = {
  id: string;
  url: string;
  order: number;
  propertyId: string;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the authenticated user's id from the NextAuth session.
 * Falls back to an email lookup for older sessions that predate `user.id`.
 * Throws "Unauthorized" when no valid user can be determined.
 */
async function getAuthenticatedUserId(): Promise<string> {
  const session = await getServerSession(authConfig);
  const sessionUserId = session?.user?.id;
  if (sessionUserId && sessionUserId.trim().length > 0) {
    return sessionUserId;
  }

  const email = session?.user?.email;
  if (!email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user?.id) throw new Error("Unauthorized");
  return user.id;
}

/**
 * Ensures the authenticated user is allowed to mutate images for a property.
 * A user may manage a property if they own it OR it belongs to their agency.
 * Throws "Unauthorized" / "Not found" as appropriate.
 */
async function assertCanManageProperty(
  userId: string,
  propertyId: string
): Promise<void> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { ownerId: true, agencyId: true },
  });

  if (!property) {
    throw new Error("Property not found.");
  }

  if (property.ownerId === userId) return;

  // Agency members may manage their agency's listings.
  if (property.agencyId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agencyId: true },
    });
    if (user?.agencyId && user.agencyId === property.agencyId) return;
  }

  throw new Error("Unauthorized: you cannot modify this property's images.");
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Secure Server Action: returns a presigned URL for direct client-to-cloud
 * upload. Requires an authenticated NextAuth session.
 *
 * @param fileName Original file name from the client (used to build the key).
 * @param fileType MIME type of the file (validated in the storage layer).
 */
export async function getUploadUrl(
  fileName: string,
  fileType: string
): Promise<PresignedUploadResult> {
  const userId = await getAuthenticatedUserId();
  // Scope the object key per user for tenant isolation + auditability.
  return generatePresignedUrl(fileName, fileType, { userId });
}

/**
 * Backward-compatible wrapper for existing callers that pass an object
 * (see `lib/upload.ts`). Prefer `getUploadUrl` for new code.
 */
export async function getPresignedUrl(params: {
  fileName: string;
  fileType: string;
}): Promise<PresignedUploadResult> {
  return getUploadUrl(params.fileName, params.fileType);
}

/**
 * Secure Server Action: persists an uploaded image's public URL to the DB
 * after a successful direct-to-cloud upload.
 *
 * Authorization: the caller must own the property or belong to its agency.
 *
 * @param propertyId The property to attach the image to.
 * @param url        The final public URL returned by the upload flow.
 * @param order      Optional explicit gallery position. When omitted, the
 *                   image is appended to the end of the existing gallery.
 */
export async function savePropertyImage(
  propertyId: string,
  url: string,
  order?: number
): Promise<SavePropertyImageResult> {
  // ---- Input validation -------------------------------------------------
  if (!propertyId || propertyId.trim().length === 0) {
    throw new Error("savePropertyImage: propertyId is required.");
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("savePropertyImage: a valid http(s) url is required.");
  }
  if (order !== undefined && (!Number.isInteger(order) || order < 0)) {
    throw new Error("savePropertyImage: order must be a non-negative integer.");
  }

  // ---- AuthZ ------------------------------------------------------------
  const userId = await getAuthenticatedUserId();
  await assertCanManageProperty(userId, propertyId);

  try {
    // Create the PropertyImage row AND keep the legacy `Property.images`
    // string[] in sync in a single transaction. This guarantees public pages
    // that still read `Property.images` never observe a partial state.
    const image = await prisma.$transaction(async (tx) => {
      // When no explicit order is given, append after the current last image.
      let resolvedOrder = order;
      if (resolvedOrder === undefined) {
        const last = await tx.propertyImage.findFirst({
          where: { propertyId },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        resolvedOrder = last ? last.order + 1 : 0;
      }

      const row = await tx.propertyImage.create({
        data: {
          propertyId,
          url,
          order: resolvedOrder,
        },
        select: {
          id: true,
          url: true,
          order: true,
          propertyId: true,
          createdAt: true,
        },
      });

      // Best-effort legacy sync: append the URL if it isn't already present.
      const current = await tx.property.findUnique({
        where: { id: propertyId },
        select: { images: true },
      });
      const legacyImages = Array.isArray(current?.images) ? current.images : [];
      if (!legacyImages.includes(url)) {
        await tx.property.update({
          where: { id: propertyId },
          data: { images: [...legacyImages, url] },
        });
      }

      return row;
    });

    // Refresh any cached views that render this property's gallery.
    revalidatePath(`/dashboard/properties/${propertyId}/edit`);
    revalidatePath(`/properties/${propertyId}`);

    return image;
  } catch (error) {
    console.error(
      `[images] savePropertyImage failed for property=${propertyId}:`,
      error
    );
    throw new Error("Failed to save the property image.");
  }
}
