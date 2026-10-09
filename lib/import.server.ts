// ============================================
// XML IMPORT SERVER ACTIONS (SERVER-ONLY)
// ============================================
// Bulk property import for AGENCY_ADMIN users.
// - Parses Nunvio XML (+ SK/CZ CRM aliases via lib/import-xml)
// - Upserts by (agencyId, externalId)
// - Optionally fetches remote images into R2
// ============================================

"use server";

import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { Language, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { uploadImageFromUrl } from "@/lib/storage/s3";
import {
  MAX_FEED_XML_BYTES,
  type NormalizedProperty,
  normalizeXmlProperty,
  parseXmlProperties,
} from "@/lib/import-xml";

const MAX_PROPERTIES_PER_IMPORT = 500;
const MAX_PROPERTIES_PER_FEED_CHUNK = 200;

const getAuthenticatedUserId = async (): Promise<string | null> => {
  const session = await getServerSession(authConfig);

  if (session?.user?.id) return session.user.id;

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

  if (token?.userId) return token.userId as string;

  if (token?.email) {
    const user = await prisma.user.findUnique({
      where: { email: token.email as string },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  return null;
};

const getAuthenticatedUser = async () => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, agencyId: true },
  });
};

async function syncPropertyImages(
  propertyId: string,
  remoteUrls: string[],
  replaceExisting: boolean
): Promise<{ uploaded: number; failed: number }> {
  if (remoteUrls.length === 0) return { uploaded: 0, failed: 0 };

  if (replaceExisting) {
    await prisma.propertyImage.deleteMany({ where: { propertyId } });
  }

  const existingCount = await prisma.propertyImage.count({
    where: { propertyId },
  });
  let order = existingCount;
  let uploaded = 0;
  let failed = 0;
  const publicUrls: string[] = [];

  for (const remoteUrl of remoteUrls) {
    try {
      const stored = await uploadImageFromUrl(remoteUrl, propertyId);
      await prisma.propertyImage.create({
        data: {
          propertyId,
          url: stored.publicUrl,
          order: order++,
        },
      });
      publicUrls.push(stored.publicUrl);
      uploaded++;
    } catch (err) {
      failed++;
      console.warn(
        `[import] image upload failed for property=${propertyId} url=${remoteUrl}`,
        err
      );
    }
  }

  if (publicUrls.length > 0) {
    const current = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { images: true },
    });
    const legacy = Array.isArray(current?.images) ? current!.images : [];
    const merged = replaceExisting
      ? publicUrls
      : Array.from(new Set([...legacy, ...publicUrls]));
    await prisma.property.update({
      where: { id: propertyId },
      data: { images: merged },
    });
  }

  return { uploaded, failed };
}

export type XmlImportResult = {
  success: true;
  created: number;
  updated: number;
  errors: number;
  total: number;
  imagesUploaded: number;
  imagesFailed: number;
  errorMessages: string[];
  processedInChunk?: number;
  nextOffset?: number;
  feedComplete?: boolean;
};

/**
 * Core importer used by file upload AND automatic feed sync.
 */
export async function importNormalizedProperties(opts: {
  agencyId: string;
  ownerId: string;
  properties: NormalizedProperty[];
  skipImages?: boolean;
}): Promise<XmlImportResult> {
  let created = 0;
  let updated = 0;
  let errorCount = 0;
  let imagesUploaded = 0;
  let imagesFailed = 0;
  const errorMessages: string[] = [];

  for (const prop of opts.properties) {
    try {
      const data = {
        title: prop.title,
        description: prop.description,
        price: prop.price,
        currency: prop.currency,
        city: prop.city,
        country: prop.country,
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
        status: "PUBLISHED" as const,
      };

      let propertyId: string;
      let isUpdate = false;

      if (prop.externalId) {
        const existing = await prisma.property.findFirst({
          where: {
            agencyId: opts.agencyId,
            externalId: prop.externalId,
          },
          select: { id: true },
        });

        if (existing) {
          await prisma.property.update({
            where: { id: existing.id },
            data: {
              ...data,
              translations: {
                upsert: {
                  where: {
                    propertyId_language: {
                      propertyId: existing.id,
                      language: Language.EN,
                    },
                  },
                  update: {
                    locale: "en",
                    title: prop.title,
                    description: prop.description,
                    translatedTitle: prop.title,
                    translatedDescription: prop.description,
                  },
                  create: {
                    locale: "en",
                    language: Language.EN,
                    title: prop.title,
                    description: prop.description,
                    translatedTitle: prop.title,
                    translatedDescription: prop.description,
                  },
                },
              },
            },
          });
          propertyId = existing.id;
          isUpdate = true;
          updated++;
        } else {
          const createdRow = await prisma.property.create({
            data: {
              ...data,
              translations: {
                create: {
                  locale: "en",
                  language: Language.EN,
                  title: prop.title,
                  description: prop.description,
                  translatedTitle: prop.title,
                  translatedDescription: prop.description,
                },
              },
            },
            select: { id: true },
          });
          propertyId = createdRow.id;
          created++;
        }
      } else {
        const createdRow = await prisma.property.create({
          data: {
            ...data,
            translations: {
              create: {
                locale: "en",
                language: Language.EN,
                title: prop.title,
                description: prop.description,
                translatedTitle: prop.title,
                translatedDescription: prop.description,
              },
            },
          },
          select: { id: true },
        });
        propertyId = createdRow.id;
        created++;
      }

      if (!opts.skipImages && prop.imageUrls.length > 0) {
        const imgResult = await syncPropertyImages(
          propertyId,
          prop.imageUrls,
          isUpdate
        );
        imagesUploaded += imgResult.uploaded;
        imagesFailed += imgResult.failed;
      }
    } catch (error: unknown) {
      errorCount++;
      const message = error instanceof Error ? error.message : "Neznáma chyba";
      errorMessages.push(`${prop.title}: ${message}`);
      console.error(`[import] failed for "${prop.title}":`, error);
    }
  }

  revalidatePath("/dashboard/properties");
  revalidatePath("/properties");

  return {
    success: true,
    created,
    updated,
    errors: errorCount,
    total: opts.properties.length,
    imagesUploaded,
    imagesFailed,
    errorMessages: errorMessages.slice(0, 50),
  };
}

export async function processXmlImport(
  formData: FormData
): Promise<XmlImportResult> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) throw new Error("Unauthorized");
    if (user.role !== UserRole.AGENCY_ADMIN) {
      throw new Error("Len administrátor agentúry môže importovať inzeráty.");
    }
    if (!user.agencyId) {
      throw new Error("Najprv vytvorte agentúru.");
    }

    const agency = await prisma.agency.findUnique({
      where: { id: user.agencyId },
      select: { country: true },
    });

    const file = formData.get("file") as File | null;
    if (!file) throw new Error("Nebol vybraný žiadny súbor.");
    if (!file.name.toLowerCase().endsWith(".xml")) {
      throw new Error("Podporované sú len súbory .xml");
    }

    const fileContent = await file.text();
    if (!fileContent.trim()) throw new Error("XML súbor je prázdny.");

    const rawProperties = parseXmlProperties(fileContent);

    if (rawProperties.length === 0) {
      throw new Error("XML neobsahuje žiadne inzeráty.");
    }
    if (rawProperties.length > MAX_PROPERTIES_PER_IMPORT) {
      throw new Error(
        `Príliš veľa inzerátov naraz (max ${MAX_PROPERTIES_PER_IMPORT}). Použite automatický feed URL alebo rozdeľte súbor.`
      );
    }

    const normalized = rawProperties.map((p, i) =>
      normalizeXmlProperty(p, i, { defaultCountry: agency?.country })
    );

    return importNormalizedProperties({
      agencyId: user.agencyId,
      ownerId: user.id,
      properties: normalized,
    });
  } catch (error) {
    console.error("processXmlImport failed:", error);
    throw error;
  }
}

export async function importXmlFromUrl(opts: {
  agencyId: string;
  ownerId: string;
  feedUrl: string;
  offset?: number;
  chunkSize?: number;
  skipImages?: boolean;
  defaultCountry?: string;
}): Promise<XmlImportResult> {
  const offset = Math.max(0, opts.offset ?? 0);
  const chunkSize = opts.chunkSize ?? MAX_PROPERTIES_PER_FEED_CHUNK;

  const response = await fetch(opts.feedUrl, {
    headers: {
      "User-Agent": "Nunvio-FeedSync/1.0 (+https://nunvio.vercel.app/partners)",
      Accept: "application/xml,text/xml,*/*",
    },
    signal: AbortSignal.timeout(120_000),
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

  const rawProperties = parseXmlProperties(xml);
  const total = rawProperties.length;
  const slice = rawProperties.slice(offset, offset + chunkSize);

  if (slice.length === 0) {
    return {
      success: true,
      created: 0,
      updated: 0,
      errors: 0,
      total,
      imagesUploaded: 0,
      imagesFailed: 0,
      errorMessages: [],
      processedInChunk: 0,
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
  });

  const nextOffset = offset + slice.length;
  const feedComplete = nextOffset >= total;

  return {
    ...result,
    total,
    processedInChunk: slice.length,
    nextOffset: feedComplete ? 0 : nextOffset,
    feedComplete,
  };
}

export { MAX_PROPERTIES_PER_FEED_CHUNK };
