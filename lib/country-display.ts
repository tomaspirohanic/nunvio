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

