import { PropertyStatus, PromotionLevel, Prisma } from "@prisma/client";

/** Sort weight for active promotions (higher = more prominent). */
export const PROMOTION_SORT_ORDER: Record<PromotionLevel, number> = {
  GOLD: 3,
  SILVER: 2,
  BRONZE: 1,
  NONE: 0,
};

/** Public listings: published only. */
export function publishedPropertyWhere(
  extra: Prisma.PropertyWhereInput = {}
): Prisma.PropertyWhereInput {
  return {
    status: PropertyStatus.PUBLISHED,
    ...extra,
  };
}

/** Active featured promotion filter. */
export function activeFeaturedWhere(now = new Date()): Prisma.PropertyWhereInput {
  return {
    promotionLevel: { not: PromotionLevel.NONE },
    featuredUntil: { gt: now },
  };
}

export function comparePromotionThenDate(
  a: { promotionLevel: PromotionLevel; isFeatured?: boolean; createdAt: Date | string },
  b: { promotionLevel: PromotionLevel; isFeatured?: boolean; createdAt: Date | string }
): number {
  const aFeat = a.isFeatured ? 1 : 0;
  const bFeat = b.isFeatured ? 1 : 0;
  if (aFeat !== bFeat) return bFeat - aFeat;

  const aPromo = PROMOTION_SORT_ORDER[a.promotionLevel] ?? 0;
  const bPromo = PROMOTION_SORT_ORDER[b.promotionLevel] ?? 0;
  if (aPromo !== bPromo) return bPromo - aPromo;

  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function localizedPath(locale: string, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean}`;
}
