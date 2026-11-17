// ============================================
// DEEPL CLIENT (SERVER-ONLY, BACKGROUND USE)
// ============================================
// Used ONLY by the background job in lib/listing-translation.server.ts.
// Never call this while rendering a page: it is slow and costs money
// per character. There is intentionally no "mock" fallback — a missing
// translation simply means the original text is shown.
// ============================================

import "server-only";

/** Site locale -> DeepL target code. Locales not listed are not machine-translated. */
const DEEPL_TARGETS: Record<string, string> = {
  bg: "BG",
  cs: "CS",
  da: "DA",
  de: "DE",
  el: "EL",
  en: "EN-GB",
  es: "ES",
  et: "ET",
  fi: "FI",
  fr: "FR",
  hu: "HU",
  it: "IT",
  lt: "LT",
  lv: "LV",
  nl: "NL",
  pl: "PL",
  pt: "PT-PT",
  ro: "RO",
  sk: "SK",
  sl: "SL",
  sv: "SV",
  uk: "UK",
};

export function isDeepLConfigured(): boolean {
  return Boolean(process.env.DEEPL_API_KEY);
}

export function deeplTargetFor(locale: string): string | null {
  const primary = (locale || "").toLowerCase().split("-")[0];
  return DEEPL_TARGETS[primary] ?? null;
}

export type DeepLResult = { text: string; detectedSourceLanguage: string };

/**
 * Translate up to 50 texts in ONE request (DeepL limit). Source language is
 * auto-detected, so feeds in SK, CZ, DE… all work.
 */
export async function deeplTranslateBatch(
  texts: string[],
  locale: string
): Promise<DeepLResult[]> {
  const target = deeplTargetFor(locale);
  if (!target) throw new Error(`DeepL does not support locale "${locale}"`);
  if (!process.env.DEEPL_API_KEY) throw new Error("DEEPL_API_KEY is not set");
  if (texts.length === 0) return [];
  if (texts.length > 50) throw new Error("DeepL batch limit is 50 texts");

  const endpoint =
    process.env.DEEPL_API_URL || "https://api-free.deepl.com/v2/translate";
  const body = new URLSearchParams();
  for (const t of texts) body.append("text", t);
  body.set("target_lang", target);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`DeepL translate failed (${res.status}): ${txt.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    translations?: Array<{ text?: string; detected_source_language?: string }>;
  };
  const out = json.translations ?? [];
  if (out.length !== texts.length) {
    throw new Error("DeepL returned an unexpected number of translations");
  }
  return out.map((t) => ({
    text: t.text ?? "",
    detectedSourceLanguage: (t.detected_source_language ?? "").toLowerCase(),
  }));
}
