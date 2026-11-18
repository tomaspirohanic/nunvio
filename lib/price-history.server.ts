// ============================================
// PRICE HISTORY (SERVER-ONLY)
// ============================================
// Every price change (feed sync or manual edit) is stored as a row, and the
// listing keeps its previous price for the "zlacnené" badge on cards.
// ============================================

import "server-only";
import { Currency, Prisma } from "@prisma/client";

/**
 * Extra fields for `prisma.property.update` when the price changed;
 * an empty object when it did not.
 */
export function priceChangeData(
  existing: { price: Prisma.Decimal | number; currency: Currency },
  newPrice: number,
  newCurrency: Currency
) {
  const oldPrice = Number(existing.price);
  // Currency switched: amounts are not comparable, do not record a "drop".
  if (existing.currency !== newCurrency || !Number.isFinite(newPrice)) return {};
  if (Math.abs(oldPrice - newPrice) < 0.005) return {};
  const now = new Date();
  return {
    // Badge "zlacnené" only for drops; a raise clears it (history keeps both).
    previousPrice: newPrice < oldPrice ? oldPrice : null,
    priceChangedAt: now,
    priceChanges: {
      create: { oldPrice, newPrice, currency: newCurrency, changedAt: now },
    },
  } satisfies Prisma.PropertyUpdateInput;
}
