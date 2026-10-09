// ============================================
// XML FEED PARSER (shared — no "use server")
// ============================================
// Nunvio canonical format + common SK/CZ CRM field aliases
// so Softreal / Urbium / backOFFICE / RealSys bridges can map quickly.
// ============================================

import { XMLParser } from "fast-xml-parser";
import {
  Currency,
  ListingOffer,
  PropertyType,
} from "@prisma/client";

export const MAX_IMAGES_PER_PROPERTY = 8;
export const MAX_FEED_XML_BYTES = 40 * 1024 * 1024;

const ITEM_TAGS = [
  "property",
  "advert",
  "offer",
  "item",
  "nemovitost",
  "inzerat",
  "listing",
] as const;

export type NormalizedProperty = {
  externalId: string | null;
  title: string;
  description: string;
  price: number;
  currency: Currency;
  city: string;
  country: string;
  propertyType: PropertyType;
  offerType: ListingOffer;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[];
};

export type FeedValidationResult = {
  ok: boolean;
  total: number;
  sampleOk: number;
  sampleFailed: number;
  missingExternalId: number;
  errors: string[];
  sampleTitles: string[];
};

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function textValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "object" && value !== null && "#text" in value) {
    return String((value as { "#text"?: unknown })["#text"] ?? "").trim();
  }
  return String(value).trim();
}

function firstText(
  prop: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    if (key.includes(".")) {
      const [a, b] = key.split(".", 2);
      const nested = prop[a];
      if (nested && typeof nested === "object") {
        const v = textValue((nested as Record<string, unknown>)[b]);
        if (v) return v;
      }
      continue;
    }
    const v = textValue(prop[key]);
    if (v) return v;
  }
  return "";
}

function parseInteger(value: unknown, defaultValue = 0): number {
  const raw = textValue(value).replace(/\s/g, "").replace(",", ".");
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : defaultValue;
}

function parseFloatValue(value: unknown): number | null {
  const raw = textValue(value).replace(/\s/g, "").replace(",", ".");
  if (!raw) return null;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOfferType(value: unknown): ListingOffer {
  const raw = textValue(value).toLowerCase();
  if (
    [
      "rent",
      "prenajom",
      "prenájom",
      "pronajem",
      "pronájem",
      "lease",
      "na prenajom",
      "na prenájom",
      "na pronájem",
    ].includes(raw) ||
    raw.includes("prenáj") ||
    raw.includes("pronáj") ||
    raw.includes("rent")
  ) {
    return ListingOffer.RENT;
  }
  return ListingOffer.SALE;
}

function parsePropertyType(value: unknown): PropertyType {
  const raw = textValue(value).toUpperCase();
  if ((Object.values(PropertyType) as string[]).includes(raw)) {
    return raw as PropertyType;
  }
  const n = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  if (
    n.includes("byt") ||
    n.includes("apart") ||
    n.includes("flat") ||
    n === "apt" ||
    n.includes("garson")
  ) {
    return PropertyType.APARTMENT;
  }
  if (
    n.includes("dom") ||
    n.includes("house") ||
    n.includes("vila") ||
    n.includes("villa") ||
    n.includes("chalup") ||
    n.includes("rodin")
  ) {
    return PropertyType.HOUSE;
  }
  if (
    n.includes("pozem") ||
    n.includes("plot") ||
    n.includes("land") ||
    n.includes("parcela")
  ) {
    return PropertyType.LAND;
  }
  if (
    n.includes("komerc") ||
    n.includes("commercial") ||
    n.includes("kancel") ||
    n.includes("obchod") ||
    n.includes("sklad") ||
    n.includes("office")
  ) {
    return PropertyType.COMMERCIAL;
  }
  return PropertyType.HOUSE;
}

function parseCurrency(value: unknown, fallback: Currency = Currency.EUR): Currency {
  const raw = textValue(value).toUpperCase() || fallback;
  if (raw === "KČ" || raw === "KC" || raw === "KČS") return Currency.CZK;
  if ((Object.values(Currency) as string[]).includes(raw)) {
    return raw as Currency;
  }
  return fallback;
}

/** Normalize country names / ISO codes used in SK+CZ CRM exports. */
export function normalizeCountryName(
  value: string,
  defaultCountry?: string
): string {
  const raw = value.trim();
  if (!raw) return (defaultCountry || "").trim();

  const n = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  if (n === "sk" || n.includes("slovensk")) return "Slovakia";
  if (
    n === "cz" ||
    n === "cs" ||
    n.includes("cesk") ||
    n.includes("czech")
  ) {
    return "Czech Republic";
  }
  if (n === "at" || n.includes("rakous") || n.includes("austria")) {
    return "Austria";
  }
  if (n === "pl" || n.includes("polsk") || n.includes("poland")) {
    return "Poland";
  }
  if (n === "hu" || n.includes("madar") || n.includes("hungar")) {
    return "Hungary";
  }
  if (n === "de" || n.includes("nemec") || n.includes("german")) {
    return "Germany";
  }
  return raw;
}

function extractImageUrls(prop: Record<string, unknown>): string[] {
  const urls: string[] = [];

  const pushUrl = (u: unknown) => {
    const s = textValue(u);
    if (s && /^https?:\/\//i.test(s)) urls.push(s);
  };

  const collectFromNode = (node: unknown) => {
    if (!node) return;
    if (typeof node === "string" || typeof node === "number") {
      pushUrl(node);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    for (const key of ["image", "foto", "photo", "url", "link", "src"]) {
      for (const img of asArray(obj[key])) {
        if (typeof img === "object" && img !== null) {
          const i = img as Record<string, unknown>;
          pushUrl(i.url ?? i.src ?? i["#text"] ?? i["@_url"] ?? i["@_href"]);
        } else {
          pushUrl(img);
        }
      }
    }
  };

  collectFromNode(prop.images);
  collectFromNode(prop.photos);
  collectFromNode(prop.fotky);
  collectFromNode(prop.galerie);
  collectFromNode(prop.gallery);

  for (const img of asArray(prop.image ?? prop.foto ?? prop.photo)) {
    if (typeof img === "object" && img !== null) {
      const i = img as Record<string, unknown>;
      pushUrl(i.url ?? i.src ?? i["#text"]);
    } else {
      pushUrl(img);
    }
  }

  for (const key of ["images", "fotky", "photos"] as const) {
    const imagesText = textValue(prop[key]);
    if (imagesText.includes("http")) {
      for (const part of imagesText.split(/[\s,;]+/)) pushUrl(part);
    }
  }

  return Array.from(new Set(urls)).slice(0, MAX_IMAGES_PER_PROPERTY);
}

/**
 * Pull listing nodes from common CRM root wrappers.
 */
export function parseXmlProperties(fileContent: string): Record<string, unknown>[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
    isArray: (tagName) =>
      [
        ...ITEM_TAGS,
        "image",
        "url",
        "foto",
        "photo",
      ].includes(tagName.toLowerCase()),
  });

  let parsedData: Record<string, unknown>;
  try {
    parsedData = parser.parse(fileContent) as Record<string, unknown>;
  } catch {
    throw new Error("Neplatný XML formát. Skontrolujte súbor.");
  }

  const tryExtract = (node: unknown): Record<string, unknown>[] => {
    if (!node || typeof node !== "object") return [];
    const obj = node as Record<string, unknown>;
    for (const tag of ITEM_TAGS) {
      if (obj[tag] != null) {
        return asArray(obj[tag]) as Record<string, unknown>[];
      }
      // case variants from some exporters
      const found = Object.keys(obj).find((k) => k.toLowerCase() === tag);
      if (found) return asArray(obj[found]) as Record<string, unknown>[];
    }
    return [];
  };

  // Direct item list at root
  let raw = tryExtract(parsedData);
  if (raw.length > 0) return raw;

  // Common wrappers
  for (const wrap of [
    "properties",
    "reality",
    "realty",
    "offers",
    "adverts",
    "listings",
    "nemovitosti",
    "inzeraty",
    "items",
    "data",
    "export",
    "rss",
    "channel",
  ]) {
    const node = parsedData[wrap];
    raw = tryExtract(node);
    if (raw.length > 0) return raw;
    // nested e.g. rss.channel.item
    if (node && typeof node === "object") {
      for (const inner of Object.values(node as Record<string, unknown>)) {
        raw = tryExtract(inner);
        if (raw.length > 0) return raw;
      }
    }
  }

  throw new Error(
    "V XML sa nenašli inzeráty. Podporované korene: <properties><property>…</property></properties> (alebo reality/offers/nemovitosti + property/advert/offer/item)."
  );
}

export function normalizeXmlProperty(
  prop: Record<string, unknown>,
  index: number,
  opts?: { defaultCountry?: string; defaultCurrency?: Currency }
): NormalizedProperty {
  const title = firstText(prop, [
    "title",
    "nazov",
    "název",
    "nazev",
    "name",
    "headline",
    "nadpis",
  ]);
  const description = firstText(prop, [
    "description",
    "popis",
    "text",
    "content",
    "desc",
    "poznamka",
  ]);
  const city = firstText(prop, [
    "city",
    "mesto",
    "obec",
    "town",
    "lokalita",
    "location.city",
    "address.city",
  ]);
  const countryRaw = firstText(prop, [
    "country",
    "krajina",
    "stat",
    "stát",
    "countryCode",
    "country_code",
    "location.country",
    "address.country",
  ]);
  const country = normalizeCountryName(
    countryRaw,
    opts?.defaultCountry
  );

  if (!title || !description || !city || !country) {
    throw new Error(
      `Inzerát #${index + 1}: chýbajú povinné polia (title/nazov, description/popis, city/mesto, country/krajina).`
    );
  }

  const priceRaw =
    firstText(prop, [
      "price",
      "cena",
      "price_value",
      "priceValue",
      "castka",
      "částka",
    ]) || textValue(prop.price);
  const price = parseFloatValue(priceRaw);
  if (price == null || price <= 0) {
    throw new Error(
      `Inzerát #${index + 1}: neplatná cena "${priceRaw || textValue(prop.price)}".`
    );
  }

  const externalRaw = firstText(prop, [
    "externalId",
    "external_id",
    "id",
    "code",
    "kod",
    "kód",
    "ref",
    "reference",
    "cislo",
    "číslo",
    "zakazka",
    "zakázka",
    "@_id",
  ]);
  const externalId = externalRaw.length > 0 ? externalRaw.slice(0, 120) : null;

  const currencyHint = firstText(prop, [
    "currency",
    "mena",
    "currencyCode",
    "price_currency",
  ]);
  const defaultCurrency =
    opts?.defaultCurrency ??
    (country === "Czech Republic" ? Currency.CZK : Currency.EUR);

  const bedrooms = parseInteger(
    firstText(prop, [
      "bedrooms",
      "rooms",
      "izby",
      "pocet_izieb",
      "pocetIzieb",
      "počet_izieb",
      "dispozice",
      "dispozicia",
      "room_count",
    ]) || prop.bedrooms,
    0
  );

  const bathrooms = parseInteger(
    firstText(prop, ["bathrooms", "koupelny", "kupelne", "wc"]) ||
      prop.bathrooms,
    0
  );

  const areaSqm = parseInteger(
    firstText(prop, [
      "areaSqm",
      "area",
      "plocha",
      "vymera",
      "výmera",
      "uzitkova_plocha",
      "užitková_plocha",
      "podlahova_plocha",
      "size",
      "m2",
    ]) || prop.areaSqm,
    0
  );

  return {
    externalId,
    title,
    description,
    price,
    currency: parseCurrency(currencyHint, defaultCurrency),
    city,
    country,
    propertyType: parsePropertyType(
      firstText(prop, [
        "propertyType",
        "type",
        "typ",
        "druh",
        "category",
        "kategoria",
      ]) || prop.propertyType
    ),
    offerType: parseOfferType(
      firstText(prop, [
        "offerType",
        "offer",
        "advert_type",
        "advertType",
        "typ_obchodu",
        "transaction",
        "stav",
      ]) || prop.offerType
    ),
    bedrooms,
    bathrooms,
    areaSqm,
    latitude: parseFloatValue(
      firstText(prop, ["latitude", "lat", "gps_lat", "gpsLat"]) ||
        prop.latitude
    ),
    longitude: parseFloatValue(
      firstText(prop, [
        "longitude",
        "lon",
        "lng",
        "gps_lon",
        "gpsLon",
        "gps_lng",
      ]) || prop.longitude
    ),
    imageUrls: extractImageUrls(prop),
  };
}

/**
 * Dry-run validation for partners (no DB writes).
 */
export function validateXmlFeedContent(
  xml: string,
  opts?: { defaultCountry?: string; sampleSize?: number }
): FeedValidationResult {
  const raw = parseXmlProperties(xml);
  const sampleSize = Math.min(opts?.sampleSize ?? 25, raw.length);
  const errors: string[] = [];
  let sampleOk = 0;
  let sampleFailed = 0;
  let missingExternalId = 0;
  const sampleTitles: string[] = [];

  for (let i = 0; i < sampleSize; i++) {
    try {
      const n = normalizeXmlProperty(raw[i], i, {
        defaultCountry: opts?.defaultCountry,
      });
      sampleOk++;
      if (!n.externalId) missingExternalId++;
      if (sampleTitles.length < 5) sampleTitles.push(n.title);
    } catch (e: unknown) {
      sampleFailed++;
      if (errors.length < 15) {
        errors.push(e instanceof Error ? e.message : "Neznáma chyba");
      }
    }
  }

  return {
    ok: sampleFailed === 0 && raw.length > 0,
    total: raw.length,
    sampleOk,
    sampleFailed,
    missingExternalId,
    errors,
    sampleTitles,
  };
}
