"use server";

import { prisma } from "@/lib/db";
import { PromotionLevel } from "@prisma/client";

/**
 * Demote listings whose featuredUntil has passed.
 * Safe to call frequently (idempotent).
 */
export async function expireOutdatedPromotions(): Promise<number> {
  const result = await prisma.property.updateMany({
    where: {
      OR: [
        {
          isFeatured: true,
          OR: [
            { featuredUntil: null },
            { featuredUntil: { lte: new Date() } },
          ],
        },
        {
          promotionLevel: { not: PromotionLevel.NONE },
          featuredUntil: { lte: new Date() },
        },
      ],
    },
    data: {
      isFeatured: false,
      promotionLevel: PromotionLevel.NONE,
      featuredUntil: null,
    },
  });

  return result.count;
}
