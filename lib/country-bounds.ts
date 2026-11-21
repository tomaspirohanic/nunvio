// ============================================
// COUNTRY MAP VIEWS (shared, client + server)
// ============================================
// Approximate bounding boxes [south, west, north, east] used to open the
// search map on the visitor's country, or on a country they searched for.
// Mainland only where overseas parts would zoom the map far out.
// ============================================

export type Bounds = [number, number, number, number];

export const COUNTRY_BOUNDS: Record<string, Bounds> = {
  AT: [46.37, 9.53, 49.02, 17.16],
  BE: [49.5, 2.54, 51.51, 6.41],
  BG: [41.23, 22.36, 44.22, 28.61],
  CH: [45.82, 5.96, 47.81, 10.49],
  CY: [34.56, 32.27, 35.7, 34.6],
  CZ: [48.55, 12.09, 51.06, 18.86],
  DE: [47.27, 5.87, 55.06, 15.04],
  DK: [54.56, 8.07, 57.75, 12.69],
  EE: [57.51, 21.76, 59.68, 28.21],
  ES: [36.0, -9.3, 43.79, 3.33],
  FI: [59.81, 20.55, 70.09, 31.59],
  FR: [41.33, -5.14, 51.09, 9.56],
  GB: [49.96, -8.17, 58.64, 1.75],
  GR: [34.8, 19.37, 41.75, 28.25],
  HR: [42.39, 13.49, 46.55, 19.45],
  HU: [45.74, 16.11, 48.59, 22.9],
  IE: [51.42, -10.48, 55.39, -5.99],
  IT: [36.62, 6.63, 47.09, 18.52],
  LT: [53.9, 20.94, 56.45, 26.84],
  LU: [49.45, 5.73, 50.18, 6.53],
  LV: [55.67, 20.97, 58.08, 28.24],
  MT: [35.8, 14.18, 36.08, 14.58],
  NL: [50.75, 3.36, 53.55, 7.23],
  NO: [57.98, 4.99, 71.18, 31.08],
  PL: [49.0, 14.12, 54.84, 24.15],
  PT: [36.96, -9.5, 42.15, -6.19],
  RO: [43.62, 20.26, 48.27, 29.69],
  SE: [55.34, 11.11, 69.06, 24.17],
  SI: [45.42, 13.38, 46.88, 16.61],
  SK: [47.73, 16.83, 49.61, 22.57],
  UA: [44.39, 22.14, 52.38, 40.23],
};

/** Whole of Europe, when we know nothing about the visitor. */
export const EUROPE_BOUNDS: Bounds = [36, -10, 64, 32];

/** UI language → most likely home country (used when geo detection is missing). */
const LOCALE_COUNTRY: Record<string, string> = {
  sk: "SK", cs: "CZ", de: "DE", pl: "PL", hu: "HU", bg: "BG", da: "DK", el: "GR",
  es: "ES", et: "EE", fi: "FI", fr: "FR", ga: "IE", hr: "HR", it: "IT", lt: "LT",
  lv: "LV", mt: "MT", nl: "NL", pt: "PT", ro: "RO", sl: "SI", sv: "SE", uk: "UA",
};

export function countryForLocale(locale: string | null | undefined): string | null {
  return (locale && LOCALE_COUNTRY[locale.toLowerCase().split("-")[0]]) || null;
}

export function boundsForCountry(code: string | null | undefined): Bounds | null {
  return (code && COUNTRY_BOUNDS[code.toUpperCase()]) || null;
}
