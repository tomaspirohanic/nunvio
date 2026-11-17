import { NextRequest, NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { translatePendingListings } from "@/lib/listing-translation.server";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Vercel Cron: translate new / changed listings in the background (DeepL). */
export async function GET(req: NextRequest) {
  const rejected = rejectUnauthorizedCron(req);
  if (rejected) return rejected;

  try {
    const result = await translatePendingListings({
      deadline: Date.now() + (maxDuration - 30) * 1000,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error("[cron/translate-listings]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
