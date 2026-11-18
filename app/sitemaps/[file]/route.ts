import {
  listingsSitemapXml,
  pricesSitemapXml,
  staticSitemapXml,
  SITEMAP_HEADERS,
} from "@/lib/sitemap.server";

export const runtime = "nodejs";
// Built per request (CDN-cached 24 h via headers), never frozen at build time.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  if (file === "static.xml") {
    return new Response(staticSitemapXml(), { headers: SITEMAP_HEADERS });
  }
  if (file === "prices.xml") {
    return new Response(await pricesSitemapXml(), { headers: SITEMAP_HEADERS });
  }
  const m = /^listings-(\d+)\.xml$/.exec(file);
  const xml = m ? await listingsSitemapXml(Number(m[1])) : null;
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: SITEMAP_HEADERS });
}
