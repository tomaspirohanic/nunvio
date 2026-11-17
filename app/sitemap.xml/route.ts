import { sitemapIndexXml, SITEMAP_HEADERS } from "@/lib/sitemap.server";

export const runtime = "nodejs";
// Built per request (CDN-cached 24 h via headers), never frozen at build time.
export const dynamic = "force-dynamic";

/** Sitemap index: one static file + one file per 2 000 published listings. */
export async function GET() {
  return new Response(await sitemapIndexXml(), { headers: SITEMAP_HEADERS });
}
