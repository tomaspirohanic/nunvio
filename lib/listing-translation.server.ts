// ============================================
// BACKGROUND LISTING TRANSLATION (CRON)
// ============================================
// - Runs from /api/cron/translate-listings, never during page render.
// - Only for locales listed in LISTING_TRANSLATION_LOCALES (default: sk,cs,en)
//   so cost stays predictable. Add locales as you launch new countries.
// - Hard per-run character budget (LISTING_TRANSLATION_MAX_CHARS_PER_RUN).
// - When a listing's text changes, its translations are deleted (importer /
//   edit action) and this job re-creates them.
// ============================================

import "server-only";

import { prisma } from "@/lib/db";
import { Language, PropertyStatus } from "@prisma/client";
import {
  deeplTargetFor,
  deeplTranslateBatch,
  isDeepLConfigured,
} from "@/lib/translate";
import { revalidateListings } from "@/lib/revalidate-listings";

const DEFAULT_LOCALES = "sk,cs,en";
const LISTINGS_PER_BATCH = 25; // 25 listings = 50 texts = one DeepL request

export function getListingTranslationLocales(): string[] {
  return (process.env.LISTING_TRANSLATION_LOCALES || DEFAULT_LOCALES)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && deeplTargetFor(s) !== null);
}

function legacyLanguageFor(locale: string): Language | null {
  if (locale === "en") return Language.EN;
  if (locale === "de") return Language.DE;
  if (locale === "es") return Language.ES;
  return null;
}

/** Upsert the translation row for (property, locale). */
export async function persistPropertyTranslation(params: {
  propertyId: string;
  locale: string;
  title: string;
  description: string;
}) {
  const loc = params.locale.toLowerCase();
  const legacy = legacyLanguageFor(loc);
  const data = {
    locale: loc,
    title: params.title,
    description: params.description,
    translatedTitle: params.title,
    translatedDescription: params.description,
    ...(legacy ? { language: legacy } : {}),
  };

  const existing = await prisma.propertyTranslation.findFirst({
    where: {
      propertyId: params.propertyId,
      OR: [{ locale: loc }, ...(legacy ? [{ language: legacy }] : [])],
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.propertyTranslation.update({ where: { id: existing.id }, data });
  } else {
    await prisma.propertyTranslation.create({
      data: { propertyId: params.propertyId, ...data },
    });
  }
}

export async function translatePendingListings(opts: {
  deadline: number;
  maxChars?: number;
}) {
  if (!isDeepLConfigured()) {
    return { skipped: "DEEPL_API_KEY not set", translated: 0, chars: 0 };
  }
  const maxChars =
    opts.maxChars ??
    Number(process.env.LISTING_TRANSLATION_MAX_CHARS_PER_RUN || 200_000);

  let translated = 0;
  let chars = 0;
  const touched: string[] = [];

  outer: for (const locale of getListingTranslationLocales()) {
    while (Date.now() < opts.deadline && chars < maxChars) {
      const legacy = legacyLanguageFor(locale);
      const pending = await prisma.property.findMany({
        where: {
          status: PropertyStatus.PUBLISHED,
          translations: {
            none: {
              OR: [{ locale }, ...(legacy ? [{ language: legacy }] : [])],
            },
          },
        },
        select: { id: true, title: true, description: true },
        orderBy: { createdAt: "desc" }, // newest listings first
        take: LISTINGS_PER_BATCH,
      });
      if (pending.length === 0) break;

      const texts = pending.flatMap((p) => [p.title, p.description]);
      const results = await deeplTranslateBatch(texts, locale);
      chars += texts.reduce((n, t) => n + t.length, 0);

      for (let i = 0; i < pending.length; i++) {
        const p = pending[i];
        const tTitle = results[i * 2];
        const tDesc = results[i * 2 + 1];
        // Text already in the target language: store the original as-is.
        const sameLang =
          tDesc.detectedSourceLanguage &&
          locale.startsWith(tDesc.detectedSourceLanguage);
        await persistPropertyTranslation({
          propertyId: p.id,
          locale,
          title: sameLang ? p.title : tTitle.text || p.title,
          description: sameLang ? p.description : tDesc.text || p.description,
        });
        translated++;
        touched.push(p.id);
      }
      if (chars >= maxChars) break outer;
    }
  }

  if (touched.length > 0) revalidateListings(touched);
  return { translated, chars };
}
