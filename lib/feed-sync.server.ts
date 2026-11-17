// ============================================
// AUTOMATIC AGENCY FEED SYNC (SERVER-ONLY)
// ============================================
// Server actions for the agency dashboard (feed settings + "sync now").
// The cron engine lives in lib/feed-sync-engine.server.ts (server-only).
// ============================================

"use server";

import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { runFeedSyncForAgency } from "@/lib/feed-sync-engine.server";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth/config";


function isValidHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

async function requireAgencyAdmin() {
  const session = await getServerSession(authConfig);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, agencyId: true },
  });

  if (!user || user.role !== UserRole.AGENCY_ADMIN || !user.agencyId) {
    throw new Error("Len administrátor agentúry môže nastaviť feed.");
  }

  return user;
}

/**
 * Save / update automatic feed settings for the current agency.
 */
export async function updateAgencyFeedSettings(input: {
  feedUrl: string;
  feedSyncEnabled: boolean;
}) {
  const user = await requireAgencyAdmin();
  const feedUrl = input.feedUrl.trim();

  if (feedUrl && !isValidHttpsUrl(feedUrl)) {
    throw new Error("Feed URL musí byť platná http(s) adresa.");
  }

  const existing = await prisma.agency.findUnique({
    where: { id: user.agencyId! },
    select: { feedUrl: true },
  });

  const urlChanged = (existing?.feedUrl || "") !== (feedUrl || "");

  await prisma.agency.update({
    where: { id: user.agencyId! },
    data: {
      feedUrl: feedUrl || null,
      feedSyncEnabled: Boolean(input.feedSyncEnabled && feedUrl),
      ...(urlChanged || !feedUrl
        ? { feedOffset: 0, feedLastError: null }
        : {}),
    },
  });

  revalidatePath("/dashboard/agency/import");
  return { success: true as const };
}

/**
 * Manually trigger one sync chunk for the current agency.
 */
export async function syncAgencyFeedNow() {
  const user = await requireAgencyAdmin();

  const agency = await prisma.agency.findUnique({
    where: { id: user.agencyId! },
    select: {
      id: true,
      feedUrl: true,
      feedOffset: true,
      feedSyncEnabled: true,
      country: true,
    },
  });

  if (!agency?.feedUrl) {
    throw new Error("Najprv uložte Feed URL.");
  }

  // Server actions share the page's time limit: stop well before it.
  const result = await runFeedSyncForAgency({
    agencyId: agency.id,
    ownerId: user.id,
    feedUrl: agency.feedUrl,
    offset: agency.feedOffset,
    defaultCountry: agency.country,
    deadline: Date.now() + 45_000,
  });
  if (!result) {
    throw new Error("Synchronizácia práve beží na pozadí. Skúste to o chvíľu.");
  }
  return result;
}

