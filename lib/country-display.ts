import { countries } from "countries-list";

function normalize(s: string) {
  return s.trim().toLowerCase();
}

type CountryEntry = {
  name?: string;
  native?: string;
};

function findCountryCodeFromName(name: string): string | null {
  const needle = normalize(name);
  if (!needle) return null;

  for (const [code, c] of Object.entries(countries) as Array<
    [string, CountryEntry]
  >) {
    const cn = c.name ? normalize(c.name) : "";
    const nn = c.native ? normalize(c.native) : "";
    if (cn === needle || nn === needle) return code;
  }

  // Very common English variants we see in listings
  const aliases: Record<string, string> = {
    "czech republic": "CZ",
    czechia: "CZ",
    slovakia: "SK",
    "united kingdom": "GB",
    england: "GB",
    "united states": "US",
    usa: "US",
  };
  if (aliases[needle]) return aliases[needle];

  return null;
}

export function localizeCountryName(
  country: string,
  locale: string
): string {
  const input = (country ?? "").trim();
  if (!input) return input;

  // If it's already a 2-letter code, try to display it nicely.
  const maybeCode = /^[A-Za-z]{2}$/.test(input) ? input.toUpperCase() : null;
  const code = maybeCode ?? findCountryCodeFromName(input);
  if (!code) return input;

  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    return dn.of(code) ?? input;
  } catch {
    return input;
  }
}


// --------------------------------------------
// Country name -> ISO code (any supported UI language)
// --------------------------------------------

const NAME_LOCALES = [
  "en", "sk", "cs", "de", "pl", "hu", "fr", "it", "es", "pt", "nl", "ro", "bg",
  "hr", "sl", "el", "sv", "da", "fi", "et", "lv", "lt", "ga", "mt", "uk", "ru",
  "zh", "ja",
];

function fold(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

let nameIndex: Map<string, string> | null = null;

/** Lazily built index: folded country name in any of our 28 languages -> ISO code. */
function getNameIndex(): Map<string, string> {
  if (nameIndex) return nameIndex;
  const index = new Map<string, string>();
  const codes = Object.keys(countries);
  for (const loc of NAME_LOCALES) {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames([loc], { type: "region" });
    } catch {
      continue;
    }
    for (const code of codes) {
      const name = dn.of(code);
      if (name && name !== code && !index.has(fold(name))) index.set(fold(name), code);
    }
  }
  for (const [code, c] of Object.entries(countries) as Array<[string, CountryEntry]>) {
    if (c.name && !index.has(fold(c.name))) index.set(fold(c.name), code);
    if (c.native && !index.has(fold(c.native))) index.set(fold(c.native), code);
  }
  const aliases: Record<string, string> = {
    "czech republic": "CZ",
    "ceska republika": "CZ",
    "slovak republic": "SK",
    "slovenska republika": "SK",
    england: "GB",
    "great britain": "GB",
    usa: "US",
    holland: "NL",
  };
  for (const [k, v] of Object.entries(aliases)) index.set(k, v);
  nameIndex = index;
  return index;
}

/**
 * ISO 3166-1 alpha-2 code for a country name or code, in any of the 28 UI
 * languages ("Slovensko", "Slovakia", "Slowakei", "SK" -> "SK").
 * Returns null when the text is not a country (e.g. a city name).
 */
export function countryCodeFor(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const code = raw.toUpperCase();
    return code in countries ? code : null;
  }
  return getNameIndex().get(fold(raw)) ?? null;
}
