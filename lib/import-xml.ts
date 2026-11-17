// ============================================
// XML FEED PARSER (shared — no "use server")
// ============================================
// Nunvio canonical format + common SK/CZ CRM field aliases
// so Softreal / Urbium / backOFFICE / RealSys bridges can map quickly.
// ============================================

import { XMLParser } from "fast-xml-parser";
import {
  detectFeedFormat,
  normalizeKyeroProperty,
  normalizeOpenImmoProperty,
  normalizeSrealityProperty,
} from "@/lib/feed-formats";
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
  // OpenImmo (DE/AT standard): <openimmo><anbieter><immobilie>
  "immobilie",
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
  /** Street / full address when the feed has one (display only). */
  address?: string | null;
  /** New development (novostavba / Neubau / new_build). */
  isNewBuild?: boolean;
};

/** Which export dialect a listing came in (shown to partners when validating). */
export type FeedFormat = "nunvio" | "sreality" | "openimmo" | "kyero";

export type FeedValidationResult = {
  ok: boolean;
  total: number;
  sampleOk: number;
  sampleFailed: number;
  missingExternalId: number;
  errors: string[];
  sampleTitles: string[];
  /** Detected export dialect(s) in the sample, e.g. ["sreality"]. */
  formats: FeedFormat[];
};

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function textValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    for (const v of value) {
      const t = textValue(v);
      if (t) return t;
    }
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "object" && value !== null) {
    if ("#text" in value) {
      return String((value as { "#text"?: unknown })["#text"] ?? "").trim();
    }
    // An element with only child elements / attributes has no text of its own.
    return "";
  }
  return String(value).trim();
}

export function firstText(
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

export function parseInteger(value: unknown, defaultValue = 0): number {
  const raw = textValue(value).replace(/\s/g, "").replace(",", ".");
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : defaultValue;
}

export function parseFloatValue(value: unknown): number | null {
  const raw = textValue(value).replace(/\s/g, "").replace(",", ".");
  if (!raw) return null;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseOfferType(value: unknown): ListingOffer {
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

export function parsePropertyType(value: unknown): PropertyType {
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

export function parseCurrency(value: unknown, fallback: Currency = Currency.EUR): Currency {
  const raw = textValue(value).toUpperCase() || fallback;
  if (raw === "KČ" || raw === "KC" || raw === "KČS") return Currency.CZK;
  if ((Object.values(Currency) as string[]).includes(raw)) {
    return raw as Currency;
  }
  return fallback;
}

const ISO3_COUNTRY_NAMES: Record<string, string> = {
  SVK: "Slovakia", CZE: "Czech Republic", AUT: "Austria", DEU: "Germany",
  POL: "Poland", HUN: "Hungary", HRV: "Croatia", SVN: "Slovenia",
  ITA: "Italy", ESP: "Spain", PRT: "Portugal", FRA: "France",
  BEL: "Belgium", NLD: "Netherlands", LUX: "Luxembourg", IRL: "Ireland",
  DNK: "Denmark", SWE: "Sweden", FIN: "Finland", EST: "Estonia",
  LVA: "Latvia", LTU: "Lithuania", ROU: "Romania", BGR: "Bulgaria",
  GRC: "Greece", CYP: "Cyprus", MLT: "Malta", CHE: "Switzerland",
  GBR: "United Kingdom", NOR: "Norway",
};

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

  // ISO 3166 alpha-3 (OpenImmo uses iso_land="SVK", "DEU", …)
  const iso3 = ISO3_COUNTRY_NAMES[n.toUpperCase()];
  if (iso3) return iso3;

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

export function extractImageUrls(prop: Record<string, unknown>): string[] {
  const urls: string[] = [];

  const pushUrl = (u: unknown) => {
    if (Array.isArray(u)) {
      for (const x of u) pushUrl(x);
      return;
    }
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
        "anbieter",
        "anhang",
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

  // OpenImmo: <openimmo><anbieter>…<immobilie/></anbieter>… (several providers possible)
  const openimmo = parsedData.openimmo as Record<string, unknown> | undefined;
  if (openimmo && typeof openimmo === "object") {
    const all: Record<string, unknown>[] = [];
    for (const anbieter of asArray(openimmo.anbieter)) {
      all.push(...tryExtract(anbieter));
    }
    if (all.length > 0) return all;
  }

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
    // Kyero: <root><kyero/><property/></root>
    "root",
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
    "V XML sa nenašli inzeráty. Podporované formáty: Nunvio <properties><property>, export v štruktúre Sreality (advert_*), OpenImmo (<openimmo><anbieter><immobilie>) a Kyero (<root><property>)."
  );
}

export type NormalizeOptions = {
  defaultCountry?: string;
  defaultCurrency?: Currency;
};

/**
 * Turn one raw listing node into Nunvio's shape, whatever export dialect it
 * is in (Nunvio / SK-CZ CRM aliases, Sreality-style advert_* fields,
 * OpenImmo, Kyero). Throws a readable error for an unusable listing.
 */
export function normalizeXmlProperty(
  prop: Record<string, unknown>,
  index: number,
  opts?: NormalizeOptions
): NormalizedProperty {
  switch (detectFeedFormat(prop)) {
    case "sreality":
      return normalizeSrealityProperty(prop, index, opts);
    case "openimmo":
      return normalizeOpenImmoProperty(prop, index, opts);
    case "kyero":
      return normalizeKyeroProperty(prop, index, opts);
    default:
      return normalizeNunvioProperty(prop, index, opts);
  }
}

/**
 * Normalize a whole list; bad listings are reported, not fatal, so one
 * broken record never blocks the rest of an agency's feed.
 */
export function normalizeXmlProperties(
  raw: Record<string, unknown>[],
  opts?: NormalizeOptions & { indexOffset?: number }
): {
  properties: NormalizedProperty[];
  /** Position in `raw` of each entry of `properties` */
  validRawIndexes: number[];
  errors: string[];
  failed: number;
} {
  const properties: NormalizedProperty[] = [];
  const validRawIndexes: number[] = [];
  const errors: string[] = [];
  let failed = 0;
  raw.forEach((p, i) => {
    try {
      properties.push(normalizeXmlProperty(p, (opts?.indexOffset ?? 0) + i, opts));
      validRawIndexes.push(i);
    } catch (e: unknown) {
      failed++;
      if (errors.length < 50) {
        errors.push(e instanceof Error ? e.message : "Neznáma chyba");
      }
    }
  });
  return { properties, validRawIndexes, errors, failed };
}

function parseBool(value: string): boolean {
  const n = value.trim().toLowerCase();
  return ["1", "true", "yes", "ano", "áno", "y", "ja"].includes(n);
}

function normalizeNunvioProperty(
  prop: Record<string, unknown>,
  index: number,
  opts?: NormalizeOptions
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
    address:
      firstText(prop, [
        "address",
        "adresa",
        "street",
        "ulica",
        "ulice",
        "location.street",
        "address.street",
      ]) || null,
    isNewBuild: parseBool(
      firstText(prop, ["isNewBuild", "newBuild", "new_build", "novostavba", "novostavby"])
    ),
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
  const formats = new Set<FeedFormat>();

  for (let i = 0; i < sampleSize; i++) {
    formats.add(detectFeedFormat(raw[i]));
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
    formats: Array.from(formats),
  };
}
