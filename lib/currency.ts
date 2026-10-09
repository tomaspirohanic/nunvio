// ============================================
// CURRENCY UTILITIES (display + conversion)
// ============================================
// Listing prices in DB stay on Prisma Currency (EUR/USD/GBP/CZK).
// UI can show additional European currencies via conversion.
// ============================================

export type Currency =
  | "EUR"
  | "USD"
  | "GBP"
  | "CZK"
  | "PLN"
  | "HUF"
  | "RON"
  | "CHF"
  | "SEK"
  | "DKK"
  | "NOK"
  | "BGN";

/** Currencies shown in the switcher / cookies */
export const supportedCurrencies: Currency[] = [
  "EUR",
  "CZK",
  "PLN",
  "HUF",
  "RON",
  "CHF",
  "SEK",
  "DKK",
  "NOK",
  "BGN",
  "GBP",
  "USD",
];

export function isSupportedCurrency(value: string | null | undefined): value is Currency {
  return Boolean(value && supportedCurrencies.includes(value as Currency));
}

/** Indicative rates vs EUR (not live FX). UI treats them as approximate. */
export const exchangeRates: Record<Currency, number> = {
  EUR: 1.0,
  USD: 1.08,
  GBP: 0.85,
  CZK: 25.0,
  PLN: 4.3,
  HUF: 395,
  RON: 5.0,
  CHF: 0.94,
  SEK: 11.5,
  DKK: 7.46,
  NOK: 11.7,
  BGN: 1.96,
};

export const currencyInfo: Record<Currency, { symbol: string; name: string }> = {
  EUR: { symbol: "€", name: "Euro" },
  USD: { symbol: "$", name: "US Dollar" },
  GBP: { symbol: "£", name: "British Pound" },
  CZK: { symbol: "Kč", name: "Czech Koruna" },
  PLN: { symbol: "zł", name: "Polish Złoty" },
  HUF: { symbol: "Ft", name: "Hungarian Forint" },
  RON: { symbol: "lei", name: "Romanian Leu" },
  CHF: { symbol: "CHF", name: "Swiss Franc" },
  SEK: { symbol: "kr", name: "Swedish Krona" },
  DKK: { symbol: "kr", name: "Danish Krone" },
  NOK: { symbol: "kr", name: "Norwegian Krone" },
  BGN: { symbol: "лв", name: "Bulgarian Lev" },
};

export function convertPrice(
  amount: number,
  fromCurrency: Currency | string,
  toCurrency: Currency | string
): number {
  if (fromCurrency === toCurrency) return amount;

  const from = fromCurrency as Currency;
  const to = toCurrency as Currency;

  if (!exchangeRates[from] || !exchangeRates[to]) {
    console.warn(`Invalid currency conversion: ${fromCurrency} -> ${toCurrency}`);
    return amount;
  }

  const amountInEUR = amount / exchangeRates[from];
  const convertedAmount = amountInEUR * exchangeRates[to];
  return Math.round(convertedAmount * 100) / 100;
}

export function formatPrice(
  amount: number,
  currency: Currency | string,
  locale: string = "en"
): string {
  const currencyCode = currency as Currency;

  const localeMap: Record<string, string> = {
    en: "en-GB",
    sk: "sk-SK",
    cs: "cs-CZ",
    de: "de-DE",
    fr: "fr-FR",
    es: "es-ES",
    it: "it-IT",
    pl: "pl-PL",
    hu: "hu-HU",
    pt: "pt-PT",
    nl: "nl-NL",
    ro: "ro-RO",
    bg: "bg-BG",
    hr: "hr-HR",
    el: "el-GR",
    sv: "sv-SE",
    da: "da-DK",
    fi: "fi-FI",
    lt: "lt-LT",
    lv: "lv-LV",
    et: "et-EE",
    uk: "uk-UA",
    ru: "ru-RU",
  };

  const intlLocale = localeMap[locale] || locale;

  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    const info = currencyInfo[currencyCode] || {
      symbol: currencyCode,
      name: currencyCode,
    };
    return `${info.symbol}${amount.toLocaleString(intlLocale)}`;
  }
}

/** Fallback map when countries-list has no usable currency for our UI set */
export function getCurrencyForCountry(countryCode: string | null | undefined): Currency {
  if (!countryCode) return "EUR";

  const countryToCurrency: Record<string, Currency> = {
    US: "USD",
    GB: "GBP",
    CZ: "CZK",
    PL: "PLN",
    HU: "HUF",
    RO: "RON",
    CH: "CHF",
    LI: "CHF",
    SE: "SEK",
    DK: "DKK",
    NO: "NOK",
    BG: "BGN",
    SK: "EUR",
    DE: "EUR",
    AT: "EUR",
    FR: "EUR",
    IT: "EUR",
    ES: "EUR",
    NL: "EUR",
    BE: "EUR",
    PT: "EUR",
    IE: "EUR",
    FI: "EUR",
    EE: "EUR",
    LV: "EUR",
    LT: "EUR",
    SI: "EUR",
    HR: "EUR",
    GR: "EUR",
    LU: "EUR",
    MT: "EUR",
    CY: "EUR",
  };

  return countryToCurrency[countryCode.toUpperCase()] || "EUR";
}
