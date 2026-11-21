// ============================================
// MAP PREVIEW CARD
// ============================================
// GET /api/map-preview?id=<listingId>&locale=sk
// Small payload for the preview card that opens when a price pin on the
// search map is clicked: photos, price, key facts and a short excerpt.
// Uses the stored translation for the visitor's language when there is
// one (never translates on the fly).
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeLocale, pickListingText, translationWhereForLocale } from "@/lib/listing-text";
import { resolvePropertyImageUrls } from "@/lib/property-gallery";

export const runtime = "nodejs";

const MAX_PHOTOS = 12;
const EXCERPT_CHARS = 180;

function excerpt(text: string) {
  const flat = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (flat.length <= EXCERPT_CHARS) return flat;
  const cut = flat.slice(0, EXCERPT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const locale = normalizeLocale(req.nextUrl.searchParams.get("locale"));

  try {
    const p = await prisma.property.findFirst({
      where: { id, status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        previousPrice: true,
        currency: true,
        offerType: true,
        propertyType: true,
        bedrooms: true,
        bathrooms: true,
        areaSqm: true,
        city: true,
        address: true,
        images: true,
        propertyImages: { orderBy: { order: "asc" }, select: { url: true, order: true }, take: MAX_PHOTOS },
        translations: { where: translationWhereForLocale(locale), take: 1 },
      },
    });
    if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

    const text = pickListingText(p, p.translations[0]);
    const price = Number(p.price);
    const previousPrice = p.previousPrice != null ? Number(p.previousPrice) : null;
    return NextResponse.json(
      {
        id: p.id,
        title: text.title,
        excerpt: excerpt(text.description),
        price,
        previousPrice: previousPrice != null && previousPrice > price ? previousPrice : null,
        currency: p.currency,
        offerType: p.offerType,
        propertyType: p.propertyType,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        areaSqm: p.areaSqm,
        location: p.address || p.city,
        images: resolvePropertyImageUrls(p).slice(0, MAX_PHOTOS),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
    );
  } catch (err) {
    console.error("[map-preview]", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
