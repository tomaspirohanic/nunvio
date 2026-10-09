// ============================================
// I18N CONFIGURATION
// ============================================
// Next-intl configuration for internationalization
// Supported locales: en (default), sk, de
// ============================================

import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";

// Global coverage — Europe-first + major world languages.
// Missing message JSON files fall back to EN via deepMerge / catch below.
export const locales = [
  "en",
  "sk",
  "cs",
  "de",
  "fr",
  "es",
  "it",
  "pl",
  "hu",
  "pt",
  "nl",
  "ro",
  "bg",
  "hr",
  "el",
  "sv",
  "da",
  "fi",
  "lt",
  "lv",
  "et",
  "uk",
  "ru",
  "zh",
  "ja",
] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Deep merge so missing keys always fall back to baseMessages
function deepMerge<TBase extends Record<string, any>, TOverride extends Record<string, any>>(
  base: TBase,
  override: TOverride
): TBase & TOverride {
  const out: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(override ?? {})) {
    if (isPlainObject(value) && isPlainObject((base as any)[key])) {
      out[key] = deepMerge((base as any)[key], value);
    } else {
      out[key] = value;
    }
  }
  return out as any;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale) locale = "en";

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    console.error(`❌ Invalid locale: ${locale}. Valid locales are: ${locales.join(", ")}`);
    notFound();
  }

  const loadMessages = async (loc: string) => {
    // Path is relative to this file (i18n.ts at repo root)
    return (await import(`./messages/${loc}.json`)).default;
  };

  // Base fallback chain:
  // - Always have EN as absolute safety net.
  // - We never want raw keys to leak; missing keys fall back to EN via deepMerge.
  const enMessages = await loadMessages("en");
  const baseMessages = enMessages;

  if (locale === "en") {
    console.log(`✅ Successfully loaded messages for locale: ${locale}`);
    return { locale, messages: enMessages };
  }

  try {
    const localeMessages = await loadMessages(locale);
    console.log(`✅ Successfully loaded messages for locale: ${locale}`);
    return { locale, messages: deepMerge(baseMessages, localeMessages) };
  } catch {
    console.warn(`⚠️ Missing messages for locale: ${locale}. Falling back to en.`);
    return { locale, messages: baseMessages };
  }
});
