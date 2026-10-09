import { convertPrice } from "@/lib/currency";

export type Units = "metric" | "imperial";

function localeAllowsImperial(locale: string | null | undefined) {
  const tag = (locale || "").toLowerCase();
  if (tag === "en" || tag.startsWith("en-us") || tag.startsWith("en-gb")) return true;
  return false;
}

export function formatArea(
  areaInSqm: number,
  unitsCookie: string | null | undefined,
  locale?: string | null
) {
  // CRITICAL RULE:
  // - Only en / en-US / en-GB can render sqft.
  // - Every other locale must render m² (even if cookies say imperial).
  const wantsImperial = unitsCookie === "imperial" && localeAllowsImperial(locale);
  const units: Units = wantsImperial ? "imperial" : "metric";
  const sqm = Number(areaInSqm);
  const safeSqm = Number.isFinite(sqm) ? sqm : 0;

  if (units === "imperial") {
    const sqft = safeSqm * 10.7639;
    const rounded = Math.round(sqft);
    return `${rounded.toLocaleString()} sqft`;
  }

  return `${safeSqm.toLocaleString()} m²`;
}

export function formatCurrency(
  amount: number,
  fromCurrency: string,
  targetCurrency: string,
  locale: string
) {
  const converted = convertPrice(amount, fromCurrency, targetCurrency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: targetCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(converted);
  } catch {
    return `${converted.toFixed(0)} ${targetCurrency}`;
  }
}

