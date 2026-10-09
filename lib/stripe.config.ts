// ============================================
// STRIPE CONFIGURATION & CONSTANTS
// ============================================
// Shared constants for Stripe integration
// - Promotion tier configuration
// - Can be imported by both server and client components
// - NO "use server" directive - this is a shared constants file
// ============================================

import { PromotionLevel } from "@prisma/client";

// Promotion tier configuration
// Prices are in cents (EUR)
export const PROMOTION_TIERS = {
  BRONZE: {
    level: PromotionLevel.BRONZE,
    price: 499, // 4.99 EUR in cents
    durationDays: 7,
    name: "Bronze",
  },
  SILVER: {
    level: PromotionLevel.SILVER,
    price: 1599, // 15.99 EUR in cents
    durationDays: 14,
    name: "Silver",
  },
  GOLD: {
    level: PromotionLevel.GOLD,
    price: 3000, // 30.00 EUR in cents
    durationDays: 30,
    name: "Gold",
  },
} as const;

// UI-specific promotion tier configuration (for client components)
// Includes display colors and descriptions
export const PROMOTION_TIERS_UI = {
  BRONZE: {
    level: PromotionLevel.BRONZE,
    price: 4.99,
    durationDays: 7,
    name: "Bronze",
    description: "Highlighted in search results",
    color: "from-amber-600 to-amber-700", // Amber/brown gradient
    features: [
      "Featured placement in search",
      "Highlighted listing badge",
      "7 days of promotion",
    ],
  },
  SILVER: {
    level: PromotionLevel.SILVER,
    price: 15.99,
    durationDays: 14,
    name: "Silver",
    description: "Top position in listings",
    color: "from-gray-400 to-slate-500", // Gray/slate gradient
    features: [
      "Top position in search results",
      "Premium badge display",
      "14 days of promotion",
      "Priority sorting",
    ],
  },
  GOLD: {
    level: PromotionLevel.GOLD,
    price: 30,
    durationDays: 30,
    name: "Gold",
    description: "Maximum visibility & exposure",
    color: "from-yellow-400 to-amber-500", // Yellow/amber gradient
    features: [
      "Highest priority in all listings",
      "Premium gold badge",
      "30 days of promotion",
      "Featured on homepage",
      "Maximum search visibility",
    ],
  },
} as const;
