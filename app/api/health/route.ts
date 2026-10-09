import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const started = Date.now();
  let db: "ok" | "error" = "ok";
  let dbError: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    db = "error";
    dbError = e instanceof Error ? e.message : "unknown";
  }

  const healthy = db === "ok";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
      checks: {
        database: db,
        ...(dbError ? { databaseError: dbError } : {}),
        smtpConfigured: Boolean(
          process.env.EMAIL_SERVER ||
            (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS)
        ),
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        s3Configured: Boolean(
          process.env.S3_ENDPOINT &&
            process.env.S3_ACCESS_KEY_ID &&
            process.env.S3_SECRET_ACCESS_KEY &&
            process.env.S3_BUCKET_NAME
        ),
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
