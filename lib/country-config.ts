// ============================================
// PER-COUNTRY SETTINGS (shared)
// ============================================
// One place for what differs per market. Launching a new country starts
// here: currency, typical mortgage terms for the calculator, and later the
// launch switch + feeds (see docs/PRODUCTION-LAUNCH.md).
// Mortgage defaults are typical market values, shown as editable starting
// points — never as an offer.
// ============================================

export type CountryConfig = {
  currency: "EUR" | "CZK";
  mortgage: {
    /** Typical fixed rate, % per year */
    rate: number;
    /** Usual minimum down payment, % of the price */
    downPayment: number;
    /** Usual maximum length, years */
    years: number;
  };
};

const EUR_DEFAULT: CountryConfig = {
  currency: "EUR",
  mortgage: { rate: 3.8, downPayment: 20, years: 30 },
};

export const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  SK: { currency: "EUR", mortgage: { rate: 3.9, downPayment: 20, years: 30 } },
  CZ: { currency: "CZK", mortgage: { rate: 4.7, downPayment: 20, years: 30 } },
  AT: { currency: "EUR", mortgage: { rate: 3.6, downPayment: 20, years: 30 } },
  DE: { currency: "EUR", mortgage: { rate: 3.6, downPayment: 20, years: 30 } },
  PL: { currency: "EUR", mortgage: { rate: 7.0, downPayment: 20, years: 30 } },
  HU: { currency: "EUR", mortgage: { rate: 6.5, downPayment: 20, years: 25 } },
  ES: { currency: "EUR", mortgage: { rate: 3.2, downPayment: 30, years: 25 } },
  HR: { currency: "EUR", mortgage: { rate: 4.0, downPayment: 20, years: 30 } },
};

export function countryConfig(countryCode: string | null | undefined): CountryConfig {
  return (countryCode && COUNTRY_CONFIG[countryCode.toUpperCase()]) || EUR_DEFAULT;
}

/** Monthly annuity payment. rate in % per year. */
export function monthlyPayment(loan: number, ratePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (loan <= 0 || n <= 0) return 0;
  const r = ratePct / 100 / 12;
  if (r === 0) return loan / n;
  return (loan * r) / (1 - Math.pow(1 + r, -n));
}
