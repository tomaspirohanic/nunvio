import { NextRequest, NextResponse } from "next/server";

/**
 * Shared auth for /api/cron/* routes.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Returns a NextResponse when the request must be rejected, otherwise null.
 */
export function rejectUnauthorizedCron(req: NextRequest): NextResponse | null {
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
  return null;
}
