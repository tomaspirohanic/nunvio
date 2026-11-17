import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getNearby } from "@/lib/nearby.server";

export const runtime = "nodejs";

/**
 * GET /api/nearby?id=<listingId> — schools, transport, shops… around a
 * published listing (only listings that show their position on the map).
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const p = await prisma.property.findFirst({
    where: { id, status: "PUBLISHED", showOnMap: true, latitude: { not: null }, longitude: { not: null } },
    select: { latitude: true, longitude: true },
  });
  if (!p) return NextResponse.json({ nearby: null }, { status: 404 });
  const nearby = await getNearby(p.latitude!, p.longitude!);
  return NextResponse.json(
    { nearby },
    { headers: { "Cache-Control": nearby ? "public, s-maxage=86400" : "no-store" } }
  );
}
