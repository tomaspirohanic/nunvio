import { NextRequest, NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { sendSearchAlerts } from "@/lib/saved-search.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron: e-mail new listings / price drops for saved searches.
 * Scheduled after sync-feeds and maintenance (duplicate finder), so alerts
 * contain each property once. On Vercel Pro run it every 15 minutes for
 * near-instant alerts (see docs/PRODUCTION-LAUNCH.md).
 */
export async function GET(req: NextRequest) {
  const rejected = rejectUnauthorizedCron(req);
  if (rejected) return rejected;
  const startedAt = Date.now();
  try {
    const result = await sendSearchAlerts({ deadline: startedAt + (maxDuration - 10) * 1000 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error("[cron/send-alerts]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
