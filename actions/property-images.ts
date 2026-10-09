"use server";

import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

export type SavedPropertyImage = {
  id: string;
  propertyId: string;
  url: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

function assertNonEmptyString(name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${name}`);
  }
  return value.trim();
}

function assertOrder(order: unknown): number {
  const n = typeof order === "number" ? order : Number(order);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid order");
  return Math.floor(n);
}

function assertUrl(url: string): void {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("URL must be http(s)");
    }
  } catch {
    throw new Error("Invalid cloudUrl");
  }
}

type SessionUser = {
  id?: string;
  email?: string | null;
  role?: string;
  agencyId?: string | null;
};

async function getAuthenticatedUserForAcl(): Promise<{
  id: string;
  role: UserRole;
  agencyId: string | null;
}> {
  const session = await getServerSession(authConfig);
  const su = (session?.user ?? {}) as SessionUser;

  if (!session) throw new Error("Unauthorized");

  const id = su.id?.trim();
  const email = su.email?.trim() || null;
  const role = su.role as UserRole | undefined;
  const agencyId = su.agencyId ?? null;

  if (id && role) return { id, role, agencyId };

  // Fallback for older sessions: resolve from DB by email.
  if (!email) throw new Error("Unauthorized");
  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, agencyId: true },
  });
  if (!dbUser) throw new Error("Unauthorized");
  return { id: dbUser.id, role: dbUser.role, agencyId: dbUser.agencyId };
}

/**
 * Saves an already-uploaded cloud image URL to DB and links it to a property.
 *
 * Permission rules:
 * - SUPERADMIN: can edit any property
 * - Owner: can edit their own properties
 * - AGENCY_ADMIN: can edit properties belonging to their agency
 */
export async function addPropertyImageToDb(
  propertyId: string,
  cloudUrl: string,
  order: number
): Promise<SavedPropertyImage> {
  const pid = assertNonEmptyString("propertyId", propertyId);
  const url = assertNonEmptyString("cloudUrl", cloudUrl);
  assertUrl(url);
  const ord = assertOrder(order);

  const actor = await getAuthenticatedUserForAcl();

  const property = await prisma.property.findUnique({
    where: { id: pid },
    select: { id: true, ownerId: true, agencyId: true },
  });
  if (!property) throw new Error("Property not found");

  const allowed =
    actor.role === UserRole.SUPERADMIN ||
    property.ownerId === actor.id ||
    (actor.role === UserRole.AGENCY_ADMIN &&
      actor.agencyId !== null &&
      property.agencyId === actor.agencyId);

  if (!allowed) {
    throw new Error("Forbidden");
  }

  // Transaction makes it safe to extend later (e.g., reorder shifts).
  // We also keep legacy `Property.images` in sync for pages still reading from it.
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.propertyImage.create({
      data: {
        propertyId: pid,
        url,
        order: ord,
      },
      select: {
        id: true,
        propertyId: true,
        url: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Best-effort sync: append if missing.
    const existing = await tx.property.findUnique({
      where: { id: pid },
      select: { images: true },
    });
    const legacy = Array.isArray(existing?.images) ? existing!.images : [];
    if (!legacy.includes(url)) {
      await tx.property.update({
        where: { id: pid },
        data: { images: [...legacy, url] },
      });
    }

    return row;
  });

  return created;
}

/**
 * Deletes a PropertyImage record from DB (does not delete the cloud object yet).
 * Permission rules:
 * - SUPERADMIN: can edit any property
 * - Owner: can edit their own properties
 * - AGENCY_ADMIN: can edit properties belonging to their agency
 */
export async function deletePropertyImage(
  imageId: string,
  propertyId: string
): Promise<{ success: true }> {
  const iid = assertNonEmptyString("imageId", imageId);
  const pid = assertNonEmptyString("propertyId", propertyId);

  const actor = await getAuthenticatedUserForAcl();

  const property = await prisma.property.findUnique({
    where: { id: pid },
    select: { id: true, ownerId: true, agencyId: true },
  });
  if (!property) throw new Error("Property not found");

  const allowed =
    actor.role === UserRole.SUPERADMIN ||
    property.ownerId === actor.id ||
    (actor.role === UserRole.AGENCY_ADMIN &&
      actor.agencyId !== null &&
      property.agencyId === actor.agencyId);
  if (!allowed) throw new Error("Forbidden");

  await prisma.$transaction(async (tx) => {
    const existing = await tx.propertyImage.findFirst({
      where: { id: iid, propertyId: pid },
      select: { id: true, url: true },
    });
    if (!existing) throw new Error("Image not found");

    await tx.propertyImage.delete({
      where: { id: iid },
    });

    // Keep legacy string[] in sync for now.
    const p = await tx.property.findUnique({
      where: { id: pid },
      select: { images: true },
    });
    const legacy = Array.isArray(p?.images) ? p!.images : [];
    if (legacy.includes(existing.url)) {
      await tx.property.update({
        where: { id: pid },
        data: { images: legacy.filter((u) => u !== existing.url) },
      });
    }
  });

  return { success: true };
}

/**
 * Persists a new ordering of PropertyImage rows for a property.
 * Permission rules:
 * - SUPERADMIN: can edit any property
 * - Owner: can edit their own properties
 * - AGENCY_ADMIN: can edit properties belonging to their agency
 */
export async function updateImageOrder(
  propertyId: string,
  orderedImageIds: string[]
): Promise<{ success: true }> {
  const pid = assertNonEmptyString("propertyId", propertyId);
  if (!Array.isArray(orderedImageIds) || orderedImageIds.length === 0) {
    throw new Error("Invalid orderedImageIds");
  }

  const ids = orderedImageIds.map((id) => assertNonEmptyString("imageId", id));
  // Prevent duplicates (would cause inconsistent ordering)
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error("Duplicate image IDs in ordering");
  }

  const actor = await getAuthenticatedUserForAcl();

  const property = await prisma.property.findUnique({
    where: { id: pid },
    select: { id: true, ownerId: true, agencyId: true },
  });
  if (!property) throw new Error("Property not found");

  const allowed =
    actor.role === UserRole.SUPERADMIN ||
    property.ownerId === actor.id ||
    (actor.role === UserRole.AGENCY_ADMIN &&
      actor.agencyId !== null &&
      property.agencyId === actor.agencyId);
  if (!allowed) throw new Error("Forbidden");

  await prisma.$transaction(async (tx) => {
    // Only reorder IDs that actually belong to this property (ignore stale/orphan IDs).
    const rows = await tx.propertyImage.findMany({
      where: { propertyId: pid, id: { in: ids } },
      select: { id: true, url: true },
    });

    const known = new Set(rows.map((r) => r.id));
    const validIds = ids.filter((id) => known.has(id));
    if (validIds.length === 0) {
      return;
    }

    for (let i = 0; i < validIds.length; i++) {
      await tx.propertyImage.update({
        where: { id: validIds[i] },
        data: { order: i },
      });
    }

    // Keep legacy `Property.images` in sync with the new order.
    const urlById = new Map(rows.map((r) => [r.id, r.url]));
    const orderedUrls = validIds
      .map((id) => urlById.get(id))
      .filter(Boolean) as string[];
    await tx.property.update({
      where: { id: pid },
      data: { images: orderedUrls },
    });
  });

  return { success: true };
}

