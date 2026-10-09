import { cacheGet, cacheSet } from "@/lib/translate-cache";
import { prisma } from "@/lib/db";

type TranslateProvider = "deepl" | "none";

function primaryLocaleTag(locale: string) {
  return (locale || "en").toLowerCase().split("-")[0];
}

function isLegacyLanguagePrimary(primary: string) {
  return primary === "en" || primary === "de" || primary === "es";
}

function mockFallbackTranslation(params: {
  text: string;
  primary: string;
  cacheKey?: string;
}): string {
  const { text, primary, cacheKey } = params;
  const key = (cacheKey || "").toLowerCase();
  const looksLikeTitle =
    key.endsWith(":title") || key.includes(":title:") || key.includes("title");
  const looksLikeDescription =
    key.endsWith(":description") ||
    key.includes(":description:") ||
    key.includes("description");

  if (primary === "es") {
    if (looksLikeTitle) return "[es] Villa de lujo con piscina";
    if (looksLikeDescription) return "[es] Descripción traducida simulada";
    return "[es] Texto traducido simulado";
  }

  if (primary === "cs") {
    if (looksLikeTitle) return "[cs] Luxusní vila s bazénem";
    if (looksLikeDescription) return "[cs] Simulovaný přeložený popis";
    return "[cs] Simulovaný přeložený text";
  }

  return `[Translated to ${primary}] ${text.substring(0, 5)}...`;
}

function localeToLegacyLanguage(locale: string) {
  const p = primaryLocaleTag(locale);
  if (p === "de") return "DE";
  if (p === "es") return "ES";
  return "EN";
}

function pickProvider(): TranslateProvider {
  if (process.env.DEEPL_API_KEY) return "deepl";
  return "none";
}

async function translateWithDeepL({
  text,
  targetLang,
}: {
  text: string;
  targetLang: string;
}): Promise<string> {
  const lang = targetLang.toUpperCase();
  const deeplTarget =
    lang === "EN"
      ? "EN"
      : lang === "DE"
        ? "DE"
        : lang === "ES"
          ? "ES"
          : lang === "FR"
            ? "FR"
            : lang === "IT"
              ? "IT"
              : lang === "CS"
                ? "CS"
                : lang === "PL"
                  ? "PL"
                  : lang === "HU"
                    ? "HU"
                    : "EN";

  const endpoint = process.env.DEEPL_API_URL || "https://api-free.deepl.com/v2/translate";
  const body = new URLSearchParams();
  body.set("text", text);
  body.set("target_lang", deeplTarget);
  body.set("source_lang", "SK");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`DeepL translate failed (${res.status}): ${txt}`);
  }

  const json = (await res.json()) as {
    translations?: Array<{ text?: string }>;
  };
  const translated = json.translations?.[0]?.text;
  if (!translated) throw new Error("DeepL returned empty translation");
  return translated;
}

/**
 * Translates a single string to the target locale.
 * Uses in-memory cache when `cacheKey` is provided.
 */
export async function translateText(params: {
  text: string;
  targetLocale: string;
  cacheKey?: string;
}): Promise<string> {
  const { text, targetLocale, cacheKey } = params;
  const locale = (targetLocale || "en").toLowerCase();
  const primary = primaryLocaleTag(locale);

  if (!text || text.trim().length === 0) return text;

  // Source listings are typically SK — skip API for Slovak UI.
  if (primary === "sk") return text;

  if (cacheKey) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  const provider = pickProvider();
  let result: string;

  if (provider === "deepl") {
    try {
      result = await translateWithDeepL({ text, targetLang: primary });
    } catch (err) {
      console.warn("[translate] DeepL failed, using mock fallback:", err);
      result = mockFallbackTranslation({ text, primary, cacheKey });
    }
  } else {
    result = mockFallbackTranslation({ text, primary, cacheKey });
  }

  if (cacheKey) cacheSet(cacheKey, result);
  return result;
}

/** Batch-translate property title + description for list views. */
export async function translatePropertiesForLocale<
  T extends { id: string; title: string; description: string },
>(properties: T[], locale: string): Promise<T[]> {
  const localeTag = (locale || "en").toLowerCase();
  const primary = primaryLocaleTag(localeTag);
  if (primary === "sk") return properties;

  return Promise.all(
    properties.map(async (p) => {
      const title = await translateText({
        text: p.title,
        targetLocale: localeTag,
        cacheKey: `${primary}:${p.id}:title`,
      });
      const description = await translateText({
        text: p.description,
        targetLocale: localeTag,
        cacheKey: `${primary}:${p.id}:description`,
      });
      return { ...p, title, description };
    })
  );
}

export async function persistPropertyTranslation(params: {
  propertyId: string;
  locale: string;
  title: string;
  description: string;
}) {
  const loc = (params.locale || "en").toLowerCase();
  const primary = primaryLocaleTag(loc);
  const legacyLanguage = isLegacyLanguagePrimary(primary)
    ? localeToLegacyLanguage(loc)
    : null;

  const writeData = {
    locale: loc,
    title: params.title,
    description: params.description,
    translatedTitle: params.title,
    translatedDescription: params.description,
    ...(legacyLanguage ? { language: legacyLanguage as any } : {}),
  };

  const existing = await prisma.propertyTranslation.findFirst({
    where: {
      propertyId: params.propertyId,
      OR: [
        { locale: loc },
        ...(legacyLanguage ? [{ language: legacyLanguage as any }] : []),
      ],
    },
    orderBy: { id: "asc" },
  });

  if (existing) {
    await prisma.propertyTranslation.update({
      where: { id: existing.id },
      data: writeData,
    });
    return;
  }

  try {
    await prisma.propertyTranslation.create({
      data: {
        propertyId: params.propertyId,
        ...writeData,
      },
    });
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === "P2002") {
      const fallback = await prisma.propertyTranslation.findFirst({
        where: {
          propertyId: params.propertyId,
          OR: [
            { locale: loc },
            ...(legacyLanguage ? [{ language: legacyLanguage as any }] : []),
          ],
        },
      });
      if (fallback) {
        await prisma.propertyTranslation.update({
          where: { id: fallback.id },
          data: writeData,
        });
        return;
      }
    }
    throw err;
  }
}
