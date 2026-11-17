import { NextRequest, NextResponse } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { expireOutdatedPromotions } from "@/lib/promotions.server";
import { revalidateListings } from "@/lib/revalidate-listings";
import { backfillCountryCodes } from "@/lib/country-backfill.server";
import { findDuplicateListings } from "@/lib/dedup.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron: housekeeping that used to run on EVERY page view.
 * - Demotes expired promotions (previously an UPDATE on each /properties request).
 * - Fills Property.countryCode for older listings (resumable, time-boxed).
 * - Links the same property offered by several agencies (time-boxed; what
 *   does not fit continues in the next run).
 */
export async function GET(req: NextRequest) {
  const rejected = rejectUnauthorizedCron(req);
  if (rejected) return rejected;

  const startedAt = Date.now();
  try {
    const expiredPromotions = await expireOutdatedPromotions();
    const countryCodes = await backfillCountryCodes();
    const duplicates = await findDuplicateListings({
      deadline: startedAt + (maxDuration - 12) * 1000,
    });
    if (
      expiredPromotions > 0 ||
      countryCodes.updated > 0 ||
      duplicates.linked > 0 ||
      duplicates.released > 0
    ) {
      revalidateListings();
    }
    return NextResponse.json({ ok: true, expiredPromotions, countryCodes, duplicates });
  } catch (error: unknown) {
    console.error("[cron/maintenance]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 }
    );
  }
}
