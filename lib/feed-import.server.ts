// ============================================
// FEED / XML IMPORT ENGINE (SERVER-ONLY, NOT A SERVER ACTION)
// ============================================
// Shared by the manual XML upload (lib/import.server.ts) and the automatic
// feed sync (lib/feed-sync.server.ts). Deliberately NOT a "use server" file:
// these functions trust their agencyId / ownerId arguments, so they must
// never be callable from the browser.
//
// Designed for large catalogs (tens of thousands of listings per agency):
// - Unchanged listings (same content hash) cost one batched UPDATE, not a
//   full write + image re-upload.
// - Photos are downloaded only when the feed's photo URLs change; replaced
//   photos are deleted from R2.
// - A deadline lets callers stop safely before the serverless time limit;
//   the returned `processed` count tells them where to resume.
// ============================================

import { countryCodeFor } from "@/lib/country-display";
import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { PropertyStatus } from "@prisma/client";
import {
  deleteStoredImagesByUrl,
  uploadImageFromUrl,
} from "@/lib/storage/s3";
import {
  MAX_FEED_XML_BYTES,
  type NormalizedProperty,
  normalizeXmlProperty,
  parseXmlProperties,
} from "@/lib/import-xml";
import { revalidateListings } from "@/lib/revalidate-listings";

/** Upper bound per run; in practice the deadline decides where a run stops. */
export const MAX_PROPERTIES_PER_FEED_CHUNK = 5000;
const IMAGE_UPLOAD_CONCURRENCY = 4;

export type XmlImportResult = {
  success: true;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  total: number;
  imagesUploaded: number;
  imagesFailed: number;
  errorMessages: string[];
  /** How many of the given properties were handled before the deadline. */
  processed: number;
  processedInChunk?: number;
  /** Offset this chunk actually started at (0 = a new pass through the feed). */
  startedAtOffset?: number;
  nextOffset?: number;
  feedComplete?: boolean;
};

function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

function contentHash(p: NormalizedProperty): string {
  return sha1(
    JSON.stringify([
      p.title,
      p.description,
      p.price,
      p.currency,
      p.city,
      p.country,
      p.latitude,
      p.longitude,
      p.bedrooms,
      p.bathrooms,
      p.areaSqm,
      p.propertyType,
      p.offerType,
    ])
  );
}

function imageHash(urls: string[]): string {
  return sha1(urls.join("\n"));
}

/** Run async work over items with bounded parallelism, preserving order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Replace a listing's photos with the feed's photos.
 * Returns ok=true only if every photo was stored (otherwise the image hash is
 * not saved and the next sync retries).
 */
async function replacePropertyImages(
  propertyId: string,
  remoteUrls: string[]
): Promise<{ uploaded: number; failed: number }> {
  const uploads = await mapWithConcurrency(
    remoteUrls,
    IMAGE_UPLOAD_CONCURRENCY,
    async (url) => {
      try {
        return (await uploadImageFromUrl(url, propertyId)).publicUrl;
      } catch (err) {
        console.warn(
          `[import] image upload failed for property=${propertyId} url=${url}`,
          err
        );
        return null;
      }
    }
  );
  const stored = uploads.filter((u): u is string => Boolean(u));
  const failed = uploads.length - stored.length;
  if (stored.length === 0) return { uploaded: 0, failed };

  const previous = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { images: true, propertyImages: { select: { url: true } } },
  });

  await prisma.$transaction([
    prisma.propertyImage.deleteMany({ where: { propertyId } }),
    prisma.propertyImage.createMany({
      data: stored.map((url, order) => ({ propertyId, url, order })),
    }),
    prisma.property.update({
      where: { id: propertyId },
      data: { images: stored },
    }),
  ]);

  // Remove the photos we no longer reference from R2 (best-effort).
  if (previous) {
    const keep = new Set(stored);
    const old = [
      ...previous.images,
      ...previous.propertyImages.map((i) => i.url),
    ].filter((u) => !keep.has(u));
    if (old.length > 0) await deleteStoredImagesByUrl(old);
  }

  return { uploaded: stored.length, failed };
}

/**
 * Core importer used by file upload AND automatic feed sync.
 * Upserts by (agencyId, externalId).
 */
export async function importNormalizedProperties(opts: {
  agencyId: string;
  ownerId: string;
  properties: NormalizedProperty[];
  skipImages?: boolean;
  /** epoch ms; stop starting new listings after this moment */
  deadline?: number;
}): Promise<XmlImportResult> {
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let errorCount = 0;
  let imagesUploaded = 0;
  let imagesFailed = 0;
  let processed = 0;
  const errorMessages: string[] = [];
  const seenAt = new Date();
  const unchangedIds: string[] = [];
  const changedIds: string[] = [];

  // One query for all existing rows of this chunk (instead of one per listing).
  const externalIds = opts.properties
    .map((p) => p.externalId)
    .filter((id): id is string => Boolean(id));
  const existingRows =
    externalIds.length > 0
      ? await prisma.property.findMany({
          where: { agencyId: opts.agencyId, externalId: { in: externalIds } },
          select: {
            id: true,
            externalId: true,
            title: true,
            description: true,
            status: true,
            sourceHash: true,
            imageSourceHash: true,
          },
        })
      : [];
  const existingByExternalId = new Map(
    existingRows.map((r) => [r.externalId as string, r])
  );

  for (const prop of opts.properties) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    processed++;

    try {
      const hash = contentHash(prop);
      const imgHash = imageHash(prop.imageUrls);
      const existing = prop.externalId
        ? existingByExternalId.get(prop.externalId)
        : undefined;

      const data = {
        title: prop.title,
        description: prop.description,
        price: prop.price,
        currency: prop.currency,
        city: prop.city,
        country: prop.country,
        countryCode: countryCodeFor(prop.country),
        latitude: prop.latitude,
        longitude: prop.longitude,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        areaSqm: prop.areaSqm,
        propertyType: prop.propertyType,
        offerType: prop.offerType,
        ownerId: opts.ownerId,
        agencyId: opts.agencyId,
        externalId: prop.externalId,
        status: PropertyStatus.PUBLISHED,
        sourceHash: hash,
        lastSeenInFeedAt: seenAt,
      };

      let propertyId: string;
      let previousImageHash: string | null = null;

      if (existing) {
        propertyId = existing.id;
        previousImageHash = existing.imageSourceHash;
        if (
          existing.sourceHash === hash &&
          existing.status === PropertyStatus.PUBLISHED
        ) {
          unchanged++;
          unchangedIds.push(existing.id);
        } else {
          const textChanged =
            existing.title !== prop.title ||
            existing.description !== prop.description;
          await prisma.property.update({
            where: { id: existing.id },
            data: {
              ...data,
              // Stale machine translations -> background job re-translates.
              ...(textChanged ? { translations: { deleteMany: {} } } : {}),
            },
          });
          updated++;
          changedIds.push(existing.id);
        }
      } else {
        const row = await prisma.property.create({
          data,
          select: { id: true },
        });
        propertyId = row.id;
        created++;
        changedIds.push(row.id);
        if (prop.externalId) {
          // Same externalId twice in one chunk -> second one updates.
          existingByExternalId.set(prop.externalId, {
            id: row.id,
            externalId: prop.externalId,
            title: prop.title,
            description: prop.description,
            status: PropertyStatus.PUBLISHED,
            sourceHash: hash,
            imageSourceHash: null,
          });
        }
      }

      // Photos: only when the feed's photo list actually changed.
      if (
        !opts.skipImages &&
        prop.imageUrls.length > 0 &&
        imgHash !== previousImageHash
      ) {
        const img = await replacePropertyImages(propertyId, prop.imageUrls);
        imagesUploaded += img.uploaded;
        imagesFailed += img.failed;
        if (img.failed === 0) {
          await prisma.property.update({
            where: { id: propertyId },
            data: { imageSourceHash: imgHash },
          });
        }
        if (!changedIds.includes(propertyId)) changedIds.push(propertyId);
      }
    } catch (error: unknown) {
      errorCount++;
      const message = error instanceof Error ? error.message : "Neznáma chyba";
      errorMessages.push(`${prop.title}: ${message}`);
      console.error(`[import] failed for "${prop.title}":`, error);
    }
  }

  // Unchanged listings: just mark them as still present in the feed.
  if (unchangedIds.length > 0) {
    await prisma.property.updateMany({
      where: { id: { in: unchangedIds } },
      data: { lastSeenInFeedAt: seenAt },
    });
  }

  if (changedIds.length > 0) revalidateListings(changedIds);

  return {
    success: true,
    created,
    updated,
    unchanged,
    errors: errorCount,
    total: opts.properties.length,
    imagesUploaded,
    imagesFailed,
    errorMessages: errorMessages.slice(0, 50),
    processed,
  };
}

export async function fetchFeedXml(feedUrl: string): Promise<string> {
  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Nunvio-FeedSync/1.0 (+https://nunvio.eu/partners)",
      Accept: "application/xml,text/xml,*/*",
    },
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Feed URL vrátil HTTP ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_FEED_XML_BYTES) {
    throw new Error("Feed XML je príliš veľký (max 40 MB).");
  }

  const xml = await response.text();
  if (xml.length > MAX_FEED_XML_BYTES) {
    throw new Error("Feed XML je príliš veľký (max 40 MB).");
  }
  return xml;
}

/**
 * Process one slice of a remote feed starting at `offset`, until the chunk
 * is done or the deadline is reached.
 */
export async function importXmlFromUrl(opts: {
  agencyId: string;
  ownerId: string;
  feedUrl: string;
  offset?: number;
  chunkSize?: number;
  skipImages?: boolean;
  defaultCountry?: string;
  deadline?: number;
}): Promise<XmlImportResult> {
  const chunkSize = opts.chunkSize ?? MAX_PROPERTIES_PER_FEED_CHUNK;

  const xml = await fetchFeedXml(opts.feedUrl);
  const rawProperties = parseXmlProperties(xml);
  const total = rawProperties.length;
  // Feed shrank since last run -> restart from the beginning.
  const offset = Math.max(0, opts.offset ?? 0) >= total ? 0 : Math.max(0, opts.offset ?? 0);
  const slice = rawProperties.slice(offset, offset + chunkSize);

  if (slice.length === 0) {
    return {
      success: true,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
      total,
      imagesUploaded: 0,
      imagesFailed: 0,
      errorMessages: [],
      processed: 0,
      processedInChunk: 0,
      startedAtOffset: offset,
      nextOffset: 0,
      feedComplete: true,
    };
  }

  const normalized = slice.map((p, i) =>
    normalizeXmlProperty(p, offset + i, {
      defaultCountry: opts.defaultCountry,
    })
  );

  const result = await importNormalizedProperties({
    agencyId: opts.agencyId,
    ownerId: opts.ownerId,
    properties: normalized,
    skipImages: opts.skipImages,
    deadline: opts.deadline,
  });

  const nextOffset = offset + result.processed;
  const feedComplete = nextOffset >= total;

  return {
    ...result,
    total,
    processedInChunk: result.processed,
    startedAtOffset: offset,
    nextOffset: feedComplete ? 0 : nextOffset,
    feedComplete,
  };
}
