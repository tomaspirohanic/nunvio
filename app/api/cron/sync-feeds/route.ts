import { NextRequest, NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { syncAllEnabledFeeds } from "@/lib/feed-sync-engine.server";

export const runtime = "nodejs";
// Vercel Pro allows up to 300 s (800 s with Fluid compute). The engine stops
// on its own ~30 s before this limit and saves its progress.
export const maxDuration = 300;

/**
 * Vercel Cron (or manual): GET /api/cron/sync-feeds
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const rejected = rejectUnauthorizedCron(req);
  if (rejected) return rejected;

  try {
    const result = await syncAllEnabledFeeds({
      deadline: Date.now() + (maxDuration - 30) * 1000,
    });
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
