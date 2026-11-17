// ============================================
// AUTOMATIC AGENCY FEED SYNC ENGINE (SERVER-ONLY)
// ============================================
// Called by /api/cron/sync-feeds and by the dashboard "sync now" action.
//
// - Time-budgeted: keeps processing agencies until the deadline, then stops
//   cleanly and saves progress (offset), so a run never dies mid-way.
// - Lease lock per agency (feedLockedUntil): overlapping runs never process
//   the same agency twice.
// - After a full pass through a feed, listings that were not in the feed
//   anymore are ARCHIVED (with a safety guard against broken/empty feeds).
// ============================================

import "server-only";

import { prisma } from "@/lib/db";
import { PropertyStatus, UserRole } from "@prisma/client";
import {
  importXmlFromUrl,
  MAX_PROPERTIES_PER_FEED_CHUNK,
  type XmlImportResult,
} from "@/lib/feed-import.server";
import { revalidateListings } from "@/lib/revalidate-listings";

/** Lease length; must be >= the longest function duration. */
const LOCK_MS = 6 * 60 * 1000;
/** Max time one agency may use per cron run, so others are not starved. */
const AGENCY_SLICE_MS = 120_000;
/** Leave this much time for the final DB writes before the deadline. */
const SAFETY_MS = 15_000;
/**
 * Do not archive when the feed suddenly lists far fewer listings than we
 * have published (typical for a broken / truncated export).
 */
const MIN_FEED_RATIO_FOR_ARCHIVE = 0.5;

async function claimAgency(agencyId: string): Promise<boolean> {
  const now = new Date();
  const res = await prisma.agency.updateMany({
    where: {
      id: agencyId,
      OR: [{ feedLockedUntil: null }, { feedLockedUntil: { lt: now } }],
    },
    data: { feedLockedUntil: new Date(now.getTime() + LOCK_MS) },
  });
  return res.count === 1;
}

async function archiveListingsMissingFromFeed(
  agencyId: string,
  passStartedAt: Date,
  totalInFeed: number
): Promise<number> {
  const missingWhere = {
    agencyId,
    externalId: { not: null },
    status: PropertyStatus.PUBLISHED,
    OR: [
      { lastSeenInFeedAt: null },
      { lastSeenInFeedAt: { lt: passStartedAt } },
    ],
  };
  const [published, missing] = await Promise.all([
    prisma.property.count({
      where: { agencyId, externalId: { not: null }, status: PropertyStatus.PUBLISHED },
    }),
    prisma.property.count({ where: missingWhere }),
  ]);
  if (missing === 0) return 0;
  if (totalInFeed === 0 || totalInFeed < published * MIN_FEED_RATIO_FOR_ARCHIVE) {
    console.warn(
      `[feed-sync] agency=${agencyId}: feed has ${totalInFeed} listings but ${published} are published; skipping archive of ${missing} as a safety measure`
    );
    return 0;
  }
  const res = await prisma.property.updateMany({
    where: missingWhere,
    data: { status: PropertyStatus.ARCHIVED },
  });
  return res.count;
}

/**
 * Process as much of one agency's feed as fits before `deadline`.
 * Returns null when another run currently holds the agency's lock.
 */
export async function runFeedSyncForAgency(opts: {
  agencyId: string;
  ownerId: string;
  feedUrl: string;
  offset: number;
  defaultCountry?: string;
  deadline: number;
}): Promise<(XmlImportResult & { archived: number }) | null> {
  if (!(await claimAgency(opts.agencyId))) return null;

  const runStartedAt = new Date();
  try {
    const result = await importXmlFromUrl({
      agencyId: opts.agencyId,
      ownerId: opts.ownerId,
      feedUrl: opts.feedUrl,
      offset: opts.offset,
      chunkSize: MAX_PROPERTIES_PER_FEED_CHUNK,
      skipImages: false,
      defaultCountry: opts.defaultCountry,
      deadline: opts.deadline - SAFETY_MS,
    });

    // New pass through the feed started in this run.
    if (result.startedAtOffset === 0) {
      await prisma.agency.update({
        where: { id: opts.agencyId },
        data: { feedPassStartedAt: runStartedAt },
      });
    }

    let archived = 0;
    if (result.feedComplete) {
      const agency = await prisma.agency.findUnique({
        where: { id: opts.agencyId },
        select: { feedPassStartedAt: true },
      });
      if (agency?.feedPassStartedAt) {
        archived = await archiveListingsMissingFromFeed(
          opts.agencyId,
          agency.feedPassStartedAt,
          result.total
        );
        if (archived > 0) revalidateListings();
      }
    }

    const summary = JSON.stringify({
      created: result.created,
      updated: result.updated,
      unchanged: result.unchanged,
      archived,
      errors: result.errors,
      processedInChunk: result.processedInChunk,
      totalInFeed: result.total,
      nextOffset: result.nextOffset,
      feedComplete: result.feedComplete,
      imagesUploaded: result.imagesUploaded,
      imagesFailed: result.imagesFailed,
      at: new Date().toISOString(),
    });

    await prisma.agency.update({
      where: { id: opts.agencyId },
      data: {
        feedOffset: result.nextOffset ?? 0,
        feedLastSyncedAt: new Date(),
        feedLastError: null,
        feedLastResult: summary.slice(0, 2000),
        feedLockedUntil: null,
      },
    });

    return { ...result, archived };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Neznáma chyba syncu";
    await prisma.agency.update({
      where: { id: opts.agencyId },
      data: {
        feedLastError: message.slice(0, 1000),
        feedLastSyncedAt: new Date(),
        feedLockedUntil: null,
      },
    });
    throw error;
  }
}

/**
 * Cron entry: go through agencies (least recently synced first) until the
 * time budget is used up. Each agency at most once per run.
 */
export async function syncAllEnabledFeeds(opts: { deadline: number }) {
  const results: Array<{
    agencyId: string;
    ok: boolean;
    summary?: string;
    error?: string;
  }> = [];
  const attempted = new Set<string>();

  while (Date.now() < opts.deadline - SAFETY_MS * 2) {
    const agency = await prisma.agency.findFirst({
      where: {
        feedSyncEnabled: true,
        feedUrl: { not: null },
        id: { notIn: Array.from(attempted) },
        OR: [{ feedLockedUntil: null }, { feedLockedUntil: { lt: new Date() } }],
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
      orderBy: [{ feedLastSyncedAt: { sort: "asc", nulls: "first" } }],
    });
    if (!agency) break;
    attempted.add(agency.id);

    const ownerId = agency.users[0]?.id;
    if (!ownerId || !agency.feedUrl) {
      results.push({ agencyId: agency.id, ok: false, error: "Chýba AGENCY_ADMIN vlastník" });
      continue;
    }

    try {
      const result = await runFeedSyncForAgency({
        agencyId: agency.id,
        ownerId,
        feedUrl: agency.feedUrl,
        offset: agency.feedOffset,
        defaultCountry: agency.country,
        deadline: Math.min(opts.deadline, Date.now() + AGENCY_SLICE_MS),
      });
      if (!result) continue; // locked by a parallel run
      results.push({
        agencyId: agency.id,
        ok: true,
        summary: `+${result.created} ~${result.updated} =${result.unchanged} -${result.archived} of ${result.total} (offset→${result.nextOffset})`,
      });
    } catch (error: unknown) {
      results.push({
        agencyId: agency.id,
        ok: false,
        error: error instanceof Error ? error.message : "sync failed",
      });
    }
  }

  return { processed: results.length, results };
}
