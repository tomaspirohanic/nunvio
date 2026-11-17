// ============================================
// EXPORT DIALECTS AGENCIES ALREADY PRODUCE (shared — no "use server")
// ============================================
// Agencies should not have to build anything new for Nunvio. Their CRM
// already exports listings for the big portals; we read those exports as-is:
//
// - "sreality": the advert_* field set of the Sreality import interface
//   (numeric codebooks: advert_function, advert_type, advert_subtype, …).
//   Most CZ and many SK CRMs can write it as an XML file/URL.
// - "openimmo": OpenImmo XML, the standard in Germany and Austria.
// - "kyero":    Kyero XML v3, the de-facto feed for Spain/Portugal/Italy/
//   France/Croatia holiday and cross-border property.
// - "nunvio":   our own format + generic SK/CZ aliases (lib/import-xml.ts).
// ============================================

import {
  Currency,
  ListingOffer,
  PropertyType,
} from "@prisma/client";
import {
  asArray,
  extractImageUrls,
  firstText,
  MAX_IMAGES_PER_PROPERTY,
  normalizeCountryName,
  parseCurrency,
  parseFloatValue,
  parseInteger,
  parseOfferType,
  parsePropertyType,
  textValue,
  type FeedFormat,
  type NormalizedProperty,
  type NormalizeOptions,
} from "@/lib/import-xml";

type Raw = Record<string, unknown>;

export function detectFeedFormat(prop: Raw): FeedFormat {
  if (
    "objektkategorie" in prop ||
    "freitexte" in prop ||
    "verwaltung_techn" in prop
  ) {
    return "openimmo";
  }
  if (
    "advert_function" in prop ||
    "advert_type" in prop ||
    "advert_price" in prop ||
    "advert_rkid" in prop
  ) {
    return "sreality";
  }
  if (
    "price_freq" in prop ||
    "surface_area" in prop ||
    ("beds" in prop && "town" in prop)
  ) {
    return "kyero";
  }
  return "nunvio";
}

// ------------------------------------------------------------
// Generated titles (Sreality and Kyero exports carry no title)
// ------------------------------------------------------------

type TitleLang = "sk" | "cs" | "de" | "en";

function titleLangFor(country: string): TitleLang {
  if (country === "Slovakia") return "sk";
  if (country === "Czech Republic") return "cs";
  if (country === "Germany" || country === "Austria") return "de";
  return "en";
}

const TITLE_WORDS: Record<
  TitleLang,
  { sale: string; rent: string; types: Record<PropertyType, string>; rooms: (n: number) => string }
> = {
  sk: {
    sale: "Predaj",
    rent: "Prenájom",
    types: { APARTMENT: "bytu", HOUSE: "domu", LAND: "pozemku", COMMERCIAL: "komerčného priestoru" },
    rooms: (n) => `${n}-izb.`,
  },
  cs: {
    sale: "Prodej",
    rent: "Pronájem",
    types: { APARTMENT: "bytu", HOUSE: "domu", LAND: "pozemku", COMMERCIAL: "komerčního prostoru" },
    rooms: (n) => `${n} pok.`,
  },
  de: {
    sale: "Verkauf",
    rent: "Miete",
    types: { APARTMENT: "Wohnung", HOUSE: "Haus", LAND: "Grundstück", COMMERCIAL: "Gewerbefläche" },
    rooms: (n) => `${n} Zi.`,
  },
  en: {
    sale: "For sale",
    rent: "For rent",
    types: { APARTMENT: "apartment", HOUSE: "house", LAND: "land", COMMERCIAL: "commercial property" },
    rooms: (n) => `${n}-bed`,
  },
};

export function generateListingTitle(p: {
  offerType: ListingOffer;
  propertyType: PropertyType;
  bedrooms: number;
  areaSqm: number;
  city: string;
  country: string;
  /** e.g. "2+kk" — used verbatim instead of the room count */
  layout?: string;
}): string {
  const lang = titleLangFor(p.country);
  const w = TITLE_WORDS[lang];
  if (lang === "en") {
    // "3-bed house for sale, 180 m², Marbella"
    const rooms = p.bedrooms > 0 && p.propertyType !== PropertyType.LAND ? `${w.rooms(p.bedrooms)} ` : "";
    const area = p.areaSqm > 0 ? `, ${p.areaSqm} m²` : "";
    const offer = p.offerType === ListingOffer.RENT ? "for rent" : "for sale";
    const t = `${rooms}${w.types[p.propertyType]} ${offer}${area}, ${p.city}`;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const parts = [
    p.offerType === ListingOffer.RENT ? w.rent : w.sale,
    w.types[p.propertyType],
  ];
  if (p.layout) parts.push(p.layout);
  else if (p.bedrooms > 0 && p.propertyType !== PropertyType.LAND) parts.push(w.rooms(p.bedrooms));
  let title = parts.join(" ");
  if (p.areaSqm > 0) title += ` ${p.areaSqm} m²`;
  return `${title}, ${p.city}`;
}

function requireFields(
  index: number,
  p: { description: string; city: string; country: string; price: number | null }
) {
  const missing: string[] = [];
  if (!p.description) missing.push("popis");
  if (!p.city) missing.push("mesto");
  if (!p.country) missing.push("krajina");
  if (missing.length > 0) {
    throw new Error(`Inzerát #${index + 1}: chýbajú povinné polia (${missing.join(", ")}).`);
  }
  if (p.price == null || p.price <= 0) {
    throw new Error(`Inzerát #${index + 1}: chýba alebo je neplatná cena.`);
  }
}

// ------------------------------------------------------------
// Sreality-style export (advert_* codebooks)
// ------------------------------------------------------------

/** advert_subtype -> layout label for flats (Sreality codebook). */
const SREALITY_FLAT_LAYOUT: Record<number, { label: string; rooms: number }> = {
  2: { label: "1+kk", rooms: 1 },
  3: { label: "1+1", rooms: 1 },
  4: { label: "2+kk", rooms: 2 },
  5: { label: "2+1", rooms: 2 },
  6: { label: "3+kk", rooms: 3 },
  7: { label: "3+1", rooms: 3 },
  8: { label: "4+kk", rooms: 4 },
  9: { label: "4+1", rooms: 4 },
  10: { label: "5+kk", rooms: 5 },
  11: { label: "5+1", rooms: 5 },
  12: { label: "6+", rooms: 6 },
  47: { label: "pokoj", rooms: 1 },
};

function srealityCode(prop: Raw, key: string): number | null {
  const raw = textValue(prop[key]);
  if (!/^\d+$/.test(raw)) return null;
  return parseInt(raw, 10);
}

export function normalizeSrealityProperty(
  prop: Raw,
  index: number,
  opts?: NormalizeOptions
): NormalizedProperty {
  // Offer: 1 sale, 2 rent, 3 auction (treated as sale), 4 shares (sale)
  const fn = srealityCode(prop, "advert_function");
  const offerType =
    fn === 2
      ? ListingOffer.RENT
      : fn != null
        ? ListingOffer.SALE
        : parseOfferType(prop.advert_function);

  // Category: 1 flats, 2 houses, 3 land, 4 commercial, 5 other
  const cat = srealityCode(prop, "advert_type");
  const propertyType =
    cat === 1
      ? PropertyType.APARTMENT
      : cat === 2
        ? PropertyType.HOUSE
        : cat === 3
          ? PropertyType.LAND
          : cat === 4 || cat === 5
            ? PropertyType.COMMERCIAL
            : parsePropertyType(prop.advert_type);

  const subtype = srealityCode(prop, "advert_subtype");
  const flatLayout =
    propertyType === PropertyType.APARTMENT && subtype != null
      ? SREALITY_FLAT_LAYOUT[subtype]
      : undefined;
  // Houses: advert_room_count 1..5 (5 = 5+), 6 = atypical
  const roomCount = srealityCode(prop, "advert_room_count");
  const bedrooms =
    flatLayout?.rooms ??
    (roomCount != null && roomCount >= 1 && roomCount <= 5
      ? roomCount
      : parseInteger(firstText(prop, ["rooms", "bedrooms", "pocet_pokoju"]), 0));

  const areaSqm = parseInteger(
    firstText(prop, [
      "usable_area",
      "floor_area",
      "building_area",
      "estate_area",
      "nolive_total_area",
    ]),
    0
  );

  // Currency: 1 CZK, 2 USD, 3 EUR
  const cur = srealityCode(prop, "advert_price_currency");
  const city = firstText(prop, ["locality_city", "city", "mesto", "obec"]);
  const country = normalizeCountryName(
    firstText(prop, ["locality_country", "country", "krajina"]),
    opts?.defaultCountry || "Czech Republic"
  );
  const currency =
    cur === 1
      ? Currency.CZK
      : cur === 2
        ? Currency.USD
        : cur === 3
          ? Currency.EUR
          : parseCurrency(
              prop.advert_price_currency,
              opts?.defaultCurrency ??
                (country === "Czech Republic" ? Currency.CZK : Currency.EUR)
            );

  // Price unit: 1 per property, 2 per month, 3 per m², 4 per m²/month, …
  let price = parseFloatValue(textValue(prop.advert_price));
  const unit = srealityCode(prop, "advert_price_unit");
  if (price != null && (unit === 3 || unit === 4) && areaSqm > 0) {
    price = Math.round(price * areaSqm);
  }
  const finalOffer = unit === 2 || unit === 4 ? ListingOffer.RENT : offerType;

  const description = firstText(prop, ["description", "popis", "description_en"]);
  requireFields(index, { description, city, country, price });

  const street = firstText(prop, ["locality_street"]);
  const houseNo = firstText(prop, ["locality_co", "locality_cp"]);
  const citypart = firstText(prop, ["locality_citypart", "locality_part"]);

  const externalRaw = firstText(prop, ["advert_rkid", "advert_id", "id", "@_id"]);

  const title =
    firstText(prop, ["title", "advert_name", "nazev", "nazov", "name"]) ||
    generateListingTitle({
      offerType: finalOffer,
      propertyType,
      bedrooms,
      areaSqm,
      city: citypart ? `${city} – ${citypart}` : city,
      country,
      layout: flatLayout?.label,
    });

  const newBuildRaw = firstText(prop, ["building_condition", "novostavba"]);

  return {
    externalId: externalRaw ? externalRaw.slice(0, 120) : null,
    title: title.slice(0, 200),
    description,
    price: price as number,
    currency,
    city,
    country,
    propertyType,
    offerType: finalOffer,
    bedrooms,
    bathrooms: parseInteger(firstText(prop, ["bathrooms", "koupelny"]), 0),
    areaSqm,
    latitude: parseFloatValue(firstText(prop, ["locality_latitude", "latitude", "gps_lat"])),
    longitude: parseFloatValue(firstText(prop, ["locality_longitude", "longitude", "gps_lon"])),
    imageUrls: extractImageUrls(prop),
    address: [street && houseNo ? `${street} ${houseNo}` : street, citypart, city]
      .filter(Boolean)
      .join(", ") || null,
    // building_condition codebook: 6 = Novostavba
    isNewBuild:
      srealityCode(prop, "building_condition") === 6 ||
      /novostavb/i.test(newBuildRaw) ||
      textValue(prop.novostavba) === "1",
  };
}

// ------------------------------------------------------------
// OpenImmo (DE / AT)
// ------------------------------------------------------------

function child(node: unknown, key: string): Raw | undefined {
  if (!node || typeof node !== "object") return undefined;
  const v = (node as Raw)[key];
  const first = Array.isArray(v) ? v[0] : v;
  return first && typeof first === "object" ? (first as Raw) : undefined;
}

function attr(node: unknown, name: string): string {
  if (!node || typeof node !== "object") return "";
  return textValue((node as Raw)[`@_${name}`]);
}

function isTrueAttr(value: string): boolean {
  return value === "1" || value.toLowerCase() === "true";
}

const OPENIMMO_TYPE: Array<[string, PropertyType]> = [
  ["wohnung", PropertyType.APARTMENT],
  ["zimmer", PropertyType.APARTMENT],
  ["haus", PropertyType.HOUSE],
  ["grundstueck", PropertyType.LAND],
  ["land_und_forstwirtschaft", PropertyType.LAND],
  ["buero_praxen", PropertyType.COMMERCIAL],
  ["einzelhandel", PropertyType.COMMERCIAL],
  ["gastgewerbe", PropertyType.COMMERCIAL],
  ["hallen_lager_prod", PropertyType.COMMERCIAL],
  ["zinshaus_renditeobjekt", PropertyType.COMMERCIAL],
  ["freizeitimmobilie_gewerblich", PropertyType.COMMERCIAL],
  ["parken", PropertyType.COMMERCIAL],
  ["sonstige", PropertyType.COMMERCIAL],
];

export function normalizeOpenImmoProperty(
  prop: Raw,
  index: number,
  opts?: NormalizeOptions
): NormalizedProperty {
  const kat = child(prop, "objektkategorie");
  const vermarktung = child(kat, "vermarktungsart");
  const offerType = isTrueAttr(attr(vermarktung, "MIETE_PACHT")) && !isTrueAttr(attr(vermarktung, "KAUF"))
    ? ListingOffer.RENT
    : ListingOffer.SALE;

  const objektart = child(kat, "objektart") ?? {};
  let propertyType: PropertyType = PropertyType.HOUSE;
  for (const [key, type] of OPENIMMO_TYPE) {
    if (key in objektart) {
      propertyType = type;
      break;
    }
  }

  const geo = child(prop, "geo") ?? {};
  const city = firstText(geo, ["ort", "regionaler_zusatz"]);
  const country = normalizeCountryName(
    attr(child(geo, "land"), "iso_land"),
    opts?.defaultCountry
  );
  const coords = child(geo, "geokoordinaten");

  const preise = child(prop, "preise") ?? {};
  const price =
    offerType === ListingOffer.RENT
      ? parseFloatValue(firstText(preise, ["kaltmiete", "nettokaltmiete", "warmmiete", "pacht"]))
      : parseFloatValue(firstText(preise, ["kaufpreis", "kaufpreisnetto", "kaufpreisbrutto"]));
  const currency = parseCurrency(
    attr(child(preise, "waehrung"), "iso_waehrung"),
    opts?.defaultCurrency ?? Currency.EUR
  );

  const flaechen = child(prop, "flaechen") ?? {};
  const areaSqm = parseInteger(
    propertyType === PropertyType.LAND
      ? firstText(flaechen, ["grundstuecksflaeche", "gesamtflaeche"])
      : firstText(flaechen, ["wohnflaeche", "nutzflaeche", "gesamtflaeche", "grundstuecksflaeche"]),
    0
  );
  const rooms = parseFloatValue(firstText(flaechen, ["anzahl_zimmer"]));
  const bedrooms =
    rooms != null && rooms > 0
      ? Math.floor(rooms)
      : parseInteger(firstText(flaechen, ["anzahl_schlafzimmer"]), 0);

  const texte = child(prop, "freitexte") ?? {};
  const description = [
    firstText(texte, ["objektbeschreibung"]),
    firstText(texte, ["lage"]),
    firstText(texte, ["ausstatt_beschr"]),
  ]
    .filter(Boolean)
    .join("\n\n");
  requireFields(index, { description, city, country, price });

  const verwaltung = child(prop, "verwaltung_techn") ?? {};
  const externalRaw = firstText(verwaltung, ["objektnr_extern", "openimmo_obid", "objektnr_intern"]);

  // Photos: <anhaenge><anhang location="EXTERN" gruppe="TITELBILD|BILD|…"><daten><pfad>
  const anhaenge = asArray((child(prop, "anhaenge") ?? {}).anhang) as Raw[];
  const photos = anhaenge
    .filter((a) => !/^(DOKUMENTE|LINKS|FILM|FILMLINK|EPASS-SKALA|ANBOBJURL)$/i.test(attr(a, "gruppe")))
    .sort((a, b) => Number(attr(b, "gruppe") === "TITELBILD") - Number(attr(a, "gruppe") === "TITELBILD"))
    .map((a) => firstText(child(a, "daten") ?? {}, ["pfad"]))
    .filter((u) => /^https?:\/\//i.test(u));

  const strasse = firstText(geo, ["strasse"]);
  const hausnummer = firstText(geo, ["hausnummer"]);
  const plz = firstText(geo, ["plz"]);
  const alter = attr(child(child(prop, "zustand_angaben"), "alter"), "alter_attr");

  const title =
    firstText(texte, ["objekttitel"]) ||
    generateListingTitle({ offerType, propertyType, bedrooms, areaSqm, city, country });

  return {
    externalId: externalRaw ? externalRaw.slice(0, 120) : null,
    title: title.slice(0, 200),
    description,
    price: price as number,
    currency,
    city,
    country,
    propertyType,
    offerType,
    bedrooms,
    bathrooms: parseInteger(firstText(flaechen, ["anzahl_badezimmer"]), 0),
    areaSqm,
    latitude: parseFloatValue(attr(coords, "breitengrad")),
    longitude: parseFloatValue(attr(coords, "laengengrad")),
    imageUrls: Array.from(new Set(photos)).slice(0, MAX_IMAGES_PER_PROPERTY),
    address:
      [[strasse, hausnummer].filter(Boolean).join(" "), [plz, city].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ") || null,
    isNewBuild: alter.toUpperCase() === "NEUBAU",
  };
}

// ------------------------------------------------------------
// Kyero XML v3 (Spain, Portugal, Italy, France, Croatia, …)
// ------------------------------------------------------------

const KYERO_DESC_LANGS = ["sk", "cs", "en", "de", "es", "fr", "it", "nl", "pt"];

function kyeroPropertyType(raw: string): PropertyType {
  const t = raw.toLowerCase();
  if (/apartment|flat|penthouse|studio|duplex|piso|apartamento|ático/.test(t)) {
    return PropertyType.APARTMENT;
  }
  if (/land|plot|terreno|parcela/.test(t)) return PropertyType.LAND;
  if (/commercial|office|shop|local|hotel|restaurant|bar|warehouse|garage|business/.test(t)) {
    return PropertyType.COMMERCIAL;
  }
  return PropertyType.HOUSE; // villa, town house, bungalow, finca, country house, …
}

export function normalizeKyeroProperty(
  prop: Raw,
  index: number,
  opts?: NormalizeOptions
): NormalizedProperty {
  const freq = textValue(prop.price_freq).toLowerCase();
  const offerType =
    freq && freq !== "sale" ? ListingOffer.RENT : ListingOffer.SALE;
  const propertyType = kyeroPropertyType(textValue(prop.type));

  const city = firstText(prop, ["town", "city"]);
  const country = normalizeCountryName(
    firstText(prop, ["country"]),
    opts?.defaultCountry || "Spain"
  );
  let price = parseFloatValue(textValue(prop.price));
  if (price != null && freq === "week") price = Math.round(price * 4.33);

  const surface = child(prop, "surface_area") ?? {};
  const areaSqm = parseInteger(
    propertyType === PropertyType.LAND
      ? firstText(surface, ["plot", "built"])
      : firstText(surface, ["built", "plot"]),
    0
  );
  const bedrooms = parseInteger(textValue(prop.beds), 0);

  const descNode = prop.desc;
  let description = textValue(descNode);
  if (!description && descNode && typeof descNode === "object") {
    const d = descNode as Raw;
    for (const lang of KYERO_DESC_LANGS) {
      description = textValue(d[lang]);
      if (description) break;
    }
    if (!description) {
      for (const v of Object.values(d)) {
        description = textValue(v);
        if (description) break;
      }
    }
  }
  requireFields(index, { description, city, country, price });

  const location = child(prop, "location") ?? {};
  const imageNodes = asArray((child(prop, "images") ?? {}).image) as Raw[];
  const imageUrls = imageNodes
    .map((img) => (typeof img === "object" ? textValue(img.url) : textValue(img)))
    .filter((u) => /^https?:\/\//i.test(u));

  const externalRaw = firstText(prop, ["ref", "id"]);
  const province = textValue(prop.province);

  return {
    externalId: externalRaw ? externalRaw.slice(0, 120) : null,
    title: generateListingTitle({ offerType, propertyType, bedrooms, areaSqm, city, country }).slice(0, 200),
    description,
    price: price as number,
    currency: parseCurrency(prop.currency, opts?.defaultCurrency ?? Currency.EUR),
    city,
    country,
    propertyType,
    offerType,
    bedrooms,
    bathrooms: parseInteger(textValue(prop.baths), 0),
    areaSqm,
    latitude: parseFloatValue(textValue(location.latitude)),
    longitude: parseFloatValue(textValue(location.longitude)),
    imageUrls: Array.from(new Set(imageUrls)).slice(0, MAX_IMAGES_PER_PROPERTY),
    address: [textValue(prop.location_detail), city, province].filter(Boolean).join(", ") || null,
    isNewBuild: textValue(prop.new_build) === "1",
  };
}
