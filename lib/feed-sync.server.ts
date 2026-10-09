// ============================================
// AUTOMATIC AGENCY FEED SYNC (SERVER-ONLY)
// ============================================
// Pulls partner / CRM XML feeds in chunks so large catalogs
// (tens of thousands of listings) stay within serverless time limits.
// ============================================

"use server";

import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  importXmlFromUrl,
  MAX_PROPERTIES_PER_FEED_CHUNK,
} from "@/lib/import.server";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth/config";

const MAX_AGENCIES_PER_CRON = 8;
/** Smaller chunk with images keeps Vercel cron under timeout. */
const CRON_CHUNK_WITH_IMAGES = 40;

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

  return runFeedSyncForAgency({
    agencyId: agency.id,
    ownerId: user.id,
    feedUrl: agency.feedUrl,
    offset: agency.feedOffset,
    chunkSize: MAX_PROPERTIES_PER_FEED_CHUNK,
    skipImages: false,
    defaultCountry: agency.country,
  });
}

async function runFeedSyncForAgency(opts: {
  agencyId: string;
  ownerId: string;
  feedUrl: string;
  offset: number;
  chunkSize: number;
  skipImages: boolean;
  defaultCountry?: string;
}) {
  try {
    const result = await importXmlFromUrl({
      agencyId: opts.agencyId,
      ownerId: opts.ownerId,
      feedUrl: opts.feedUrl,
      offset: opts.offset,
      chunkSize: opts.chunkSize,
      skipImages: opts.skipImages,
      defaultCountry: opts.defaultCountry,
    });

    const summary = JSON.stringify({
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      processedInChunk: result.processedInChunk,
      totalInFeed: result.total,
      nextOffset: result.nextOffset,
      feedComplete: result.feedComplete,
      imagesUploaded: result.imagesUploaded,
      at: new Date().toISOString(),
    });

    await prisma.agency.update({
      where: { id: opts.agencyId },
      data: {
        feedOffset: result.nextOffset ?? 0,
        feedLastSyncedAt: new Date(),
        feedLastError: null,
        feedLastResult: summary.slice(0, 2000),
      },
    });

    return result;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Neznáma chyba syncu";
    await prisma.agency.update({
      where: { id: opts.agencyId },
      data: {
        feedLastError: message.slice(0, 1000),
        feedLastSyncedAt: new Date(),
      },
    });
    throw error;
  }
}

/**
 * Cron entry: process enabled feeds one chunk each.
 */
export async function syncAllEnabledFeeds() {
  const agencies = await prisma.agency.findMany({
    where: {
      feedSyncEnabled: true,
      feedUrl: { not: null },
    },
    select: {
      id: true,
      feedUrl: true,
      feedOffset: true,
      country: true,
      users: {
        where: { role: UserRole.AGENCY_ADMIN },
        select: { id: true },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
    take: MAX_AGENCIES_PER_CRON,
    orderBy: [{ feedLastSyncedAt: "asc" }],
  });

  const results: Array<{
    agencyId: string;
    ok: boolean;
    summary?: string;
    error?: string;
  }> = [];

  for (const agency of agencies) {
    const ownerId = agency.users[0]?.id;
    if (!ownerId || !agency.feedUrl) {
      results.push({
        agencyId: agency.id,
        ok: false,
        error: "Chýba AGENCY_ADMIN vlastník",
      });
      continue;
    }

    try {
      const result = await runFeedSyncForAgency({
        agencyId: agency.id,
        ownerId,
        feedUrl: agency.feedUrl,
        offset: agency.feedOffset,
        chunkSize: CRON_CHUNK_WITH_IMAGES,
        skipImages: false,
        defaultCountry: agency.country,
      });
      results.push({
        agencyId: agency.id,
        ok: true,
        summary: `+${result.created}/~${result.updated} of ${result.total} (offset→${result.nextOffset})`,
      });
    } catch (error: unknown) {
      results.push({
        agencyId: agency.id,
        ok: false,
        error: error instanceof Error ? error.message : "sync failed",
      });
    }
  }

  return {
    processed: results.length,
    results,
  };
}
