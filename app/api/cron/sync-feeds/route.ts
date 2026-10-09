import { NextRequest, NextResponse } from "next/server";
import { syncAllEnabledFeeds } from "@/lib/feed-sync.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron (or manual): GET /api/cron/sync-feeds
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const querySecret = req.nextUrl.searchParams.get("secret");

  if (bearer !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAllEnabledFeeds();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error("[cron/sync-feeds]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "sync failed",
      },
      { status: 500 }
    );
  }
}
