// ============================================
// LISTING TEXT (TITLE / DESCRIPTION) PER LOCALE
// ============================================
// Listing texts are NEVER machine-translated while a page renders.
// - If a stored translation exists for the visitor's locale, show it.
// - Otherwise show the original text the agency / owner wrote.
// Translations are produced in the background (see lib/listing-translation.server.ts).
// ============================================

import { Language, Prisma } from "@prisma/client";

export function normalizeLocale(locale: string | undefined | null): string {
  return (locale || "en").toLowerCase();
}

function legacyLanguageFor(locale: string): Language | null {
  const primary = normalizeLocale(locale).split("-")[0];
  if (primary === "en") return Language.EN;
  if (primary === "de") return Language.DE;
  if (primary === "es") return Language.ES;
  return null;
}

/** Prisma `where` for the one PropertyTranslation row matching this locale. */
export function translationWhereForLocale(
  locale: string
): Prisma.PropertyTranslationWhereInput {
  const loc = normalizeLocale(locale);
  const legacy = legacyLanguageFor(loc);
  return legacy ? { OR: [{ locale: loc }, { language: legacy }] } : { locale: loc };
}

type TranslationRow = {
  title?: string | null;
  description?: string | null;
  translatedTitle?: string | null;
  translatedDescription?: string | null;
};

/** Pick stored translation if complete, else the original text. */
export function pickListingText(
  original: { title: string; description: string },
  translation?: TranslationRow | null
): { title: string; description: string } {
  const title = translation?.title || translation?.translatedTitle;
  const description = translation?.description || translation?.translatedDescription;
  if (title && description) return { title, description };
  return { title: original.title, description: original.description };
}
