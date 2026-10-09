import { countries } from "countries-list";
import {
  getCurrencyForCountry,
  isSupportedCurrency,
  type Currency,
} from "@/lib/currency";
import type { Locale } from "@/i18n";

export type Units = "metric" | "imperial";

export function getCountryCodeFromHeaders(headers: Headers): string | null {
  const code =
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    headers.get("x-country-code");
  return code ? code.toUpperCase() : null;
}

/**
 * Prefer UI currencies we support; fall back to explicit EU map.
 */
export function getCurrencyForCountryCode(countryCode: string | null): Currency {
  if (!countryCode) return "EUR";

  const entry: any = (countries as any)[countryCode.toUpperCase()];
  const list: string[] | undefined = entry?.currency;
  const first = Array.isArray(list) ? list[0] : undefined;
  if (first && isSupportedCurrency(first)) return first;

  return getCurrencyForCountry(countryCode);
}

export function getUnitsForCountryCode(countryCode: string | null): Units {
  const imperial = new Set(["US", "LR", "MM"]);
  return countryCode && imperial.has(countryCode.toUpperCase())
    ? "imperial"
    : "metric";
}

/**
 * Map visitor country → Nunvio UI locale (Europe-first).
 * Used when the user has not chosen a language yet.
 */
export function getLocaleForCountryCode(
  countryCode: string | null,
  supported: readonly Locale[],
  fallback: Locale
): Locale | null {
  if (!countryCode) return null;

  const map: Record<string, Locale> = {
    SK: "sk",
    CZ: "cs",
    DE: "de",
    AT: "de",
    CH: "de", // default; Accept-Language may override to fr/it later if preferred
    FR: "fr",
    BE: "fr",
    LU: "fr",
    ES: "es",
    IT: "it",
    PL: "pl",
    HU: "hu",
    UA: "uk",
    PT: "pt",
    NL: "nl",
    RO: "ro",
    BG: "bg",
    HR: "hr",
    GR: "el",
    SE: "sv",
    DK: "da",
    FI: "fi",
    LT: "lt",
    LV: "lv",
    EE: "et",
    IE: "en",
    GB: "en",
    MT: "en",
    CY: "el",
    SI: "en",
    RU: "ru",
  };

  const locale = map[countryCode.toUpperCase()];
  if (locale && supported.includes(locale)) return locale;
  return null;
}

export function pickSupportedLocaleFromAcceptLanguage(
  acceptLanguage: string | null,
  supported: readonly Locale[],
  fallback: Locale
): Locale {
  if (!acceptLanguage) return fallback;

  const parts = acceptLanguage
    .split(",")
    .map((p) => p.trim().split(";")[0])
    .filter(Boolean);

  for (const tag of parts) {
    const lower = tag.toLowerCase();
    const primary = lower.split("-")[0] as Locale;
    if (supported.includes(primary)) return primary;
  }

  return fallback;
}
