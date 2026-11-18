import { NextRequest, NextResponse } from "next/server";
import { unsubscribeSavedSearch } from "@/lib/saved-search.server";

export const runtime = "nodejs";

/**
 * RFC 8058 one-click unsubscribe (List-Unsubscribe-Post): mail apps POST here.
 * People clicking the link in the e-mail go to /[locale]/alerts/unsubscribe.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const s = await unsubscribeSavedSearch(token);
  return NextResponse.json({ ok: !!s }, { status: s ? 200 : 404 });
}
