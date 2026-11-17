import "server-only";
import { prisma } from "@/lib/db";
import { countryCodeFor } from "@/lib/country-display";

/** Stored when a listing's country text is not a recognisable country. */
export const UNKNOWN_COUNTRY_CODE = "ZZ";

/**
 * Fills Property.countryCode for listings created before the column existed
 * (or written by old code). Runs from the maintenance cron in small batches
 * within a time budget, so it is safe on millions of rows and simply resumes
 * on the next run.
 */
export async function backfillCountryCodes(
  budgetMs = 40_000,
  batchSize = 20_000
): Promise<{ updated: number; done: boolean }> {
  const deadline = Date.now() + budgetMs;
  let updated = 0;

  while (Date.now() < deadline) {
    const names = await prisma.$queryRaw<Array<{ country: string }>>`
      SELECT DISTINCT country FROM "Property" WHERE "countryCode" IS NULL LIMIT 200`;
    if (names.length === 0) return { updated, done: true };

    for (const { country } of names) {
      const code = countryCodeFor(country) ?? UNKNOWN_COUNTRY_CODE;
      // Batched so a country with a million listings doesn't hold one huge lock.
      for (;;) {
        const n = await prisma.$executeRaw`
          UPDATE "Property" SET "countryCode" = ${code}
          WHERE id IN (
            SELECT id FROM "Property"
            WHERE country = ${country} AND "countryCode" IS NULL
            LIMIT ${batchSize}
          )`;
        updated += n;
        if (n < batchSize || Date.now() >= deadline) break;
      }
      if (Date.now() >= deadline) return { updated, done: false };
    }
  }
  return { updated, done: false };
}
