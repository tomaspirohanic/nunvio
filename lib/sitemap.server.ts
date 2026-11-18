import "server-only";
import { prisma } from "@/lib/db";
import { locales } from "@/i18n";
import { getCanonicalOrigin } from "@/lib/domains";
import { getCountriesWithListings, getCountryCities } from "@/lib/market-stats.server";

/**
 * Listings per sitemap file. Each listing carries hreflang links for all
 * 28 languages, so 2 000 listings keep a file around 6 MB (limit is 50 MB /
 * 50 000 <url> entries). 1 million listings = 500 files in the index.
 */
export const LISTINGS_PER_SITEMAP = 2_000;

/** CDN caches sitemaps for a day; crawlers don't need fresher data. */
export const SITEMAP_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
};

const STATIC_PATHS = ["", "/properties", "/partners", "/legal/privacy", "/legal/terms"];

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlEntry(path: string, lastmod?: Date) {
  const origin = getCanonicalOrigin();
  const alternates = locales
    .map(
      (l) =>
        `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(`${origin}/${l}${path}`)}"/>`
    )
    .join("");
  const xDefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(`${origin}/en${path}`)}"/>`;
  return `<url><loc>${esc(`${origin}/en${path}`)}</loc>${
    lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ""
  }${alternates}${xDefault}</url>`;
}

function urlset(entries: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join("")}</urlset>`;
}

export async function sitemapIndexXml(): Promise<string> {
  const origin = getCanonicalOrigin();
  const published = await prisma.property.count({ where: { status: "PUBLISHED" } });
  const files = ["static.xml", "prices.xml"];
  for (let i = 0; i * LISTINGS_PER_SITEMAP < published; i++) files.push(`listings-${i}.xml`);
  const body = files
    .map((f) => `<sitemap><loc>${esc(`${origin}/sitemaps/${f}`)}</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

export function staticSitemapXml(): string {
  return urlset(STATIC_PATHS.map((p) => urlEntry(p)));
}

export async function listingsSitemapXml(chunk: number): Promise<string | null> {
  if (!Number.isInteger(chunk) || chunk < 0) return null;
  // Ordered by primary key: stable chunk boundaries, served from the PK index.
  const rows = await prisma.property.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, updatedAt: true },
    orderBy: { id: "asc" },
    skip: chunk * LISTINGS_PER_SITEMAP,
    take: LISTINGS_PER_SITEMAP,
  });
  if (rows.length === 0 && chunk > 0) return null;
  return urlset(rows.map((r) => urlEntry(`/properties/${r.id}`, r.updatedAt)));
}

/** Price pages: /prices, one per country, one per city with enough listings. */
export async function pricesSitemapXml(): Promise<string> {
  const entries = [urlEntry("/prices")];
  for (const c of await getCountriesWithListings()) {
    const cc = c.countryCode.toLowerCase();
    entries.push(urlEntry(`/prices/${cc}`));
    for (const city of await getCountryCities(c.countryCode)) {
      entries.push(urlEntry(`/prices/${cc}/${city.slug}`));
    }
  }
  return urlset(entries);
}
