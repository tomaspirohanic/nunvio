// ============================================
// STRIPE SERVER ACTIONS (SERVER-ONLY)
// ============================================
// Stripe integration for property promotion payments
// - Creates checkout sessions for one-time payments
// - Handles webhook events for payment confirmation
// - Updates property promotion status on successful payment
// - All sensitive keys read from .env
// ============================================

"use server";

import Stripe from "stripe";
import { getServerSession } from "next-auth/next";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { authConfig } from "@/auth/config";
import { prisma } from "@/lib/db";
import { PromotionLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { PROMOTION_TIERS } from "@/lib/stripe.config";

// Initialize Stripe client (internal function)
// Keys must be in .env: STRIPE_SECRET_KEY (required)
// Note: Stripe will use the latest API version if not specified
function getStripeClient(): Stripe | null {
  return process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;
}

const getAuthenticatedUserId = async (): Promise<string | null> => {
  const session = await getServerSession(authConfig);

  if (session?.user?.id) {
    return session.user.id;
  }

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  const token = await getToken({
    req: { headers: { cookie: cookies().toString() } } as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token?.userId) {
    return token.userId as string;
  }

  if (token?.email) {
    const user = await prisma.user.findUnique({
      where: { email: token.email as string },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  return null;
};


/**
 * Create a Stripe Checkout session for property promotion
 * - Verifies user authentication
 * - Verifies property ownership
 * - Creates Stripe checkout session
 * - Returns session URL for redirect
 */
export async function createCheckoutSession(
  propertyId: string,
  promotionLevel: PromotionLevel
) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY in .env");
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Unauthorized");

  // Validate promotion level
  if (promotionLevel === PromotionLevel.NONE) {
    throw new Error("Invalid promotion level");
  }

  // Map promotion level to tier key
  const tierKey = promotionLevel as keyof typeof PROMOTION_TIERS;
  const tier = PROMOTION_TIERS[tierKey];
  if (!tier) {
    throw new Error("Invalid promotion tier");
  }

  // Convert PromotionLevel enum to lowercase string for tierId
  // e.g., PromotionLevel.BRONZE -> 'bronze'
  const tierIdString = promotionLevel.toLowerCase();

  // Verify property ownership
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      ownerId: userId,
    },
  });

  if (!property) {
    throw new Error("Property not found or unauthorized");
  }

  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;
  const locale =
    localeCookie && ["en", "sk", "cs", "de", "fr", "es", "it", "ru", "zh", "ja", "pl", "hu", "uk"].includes(localeCookie)
      ? localeCookie
      : "en";

  // Create Stripe Checkout session
  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${tier.name} Promotion - ${property.title}`,
            description: `Feature your property for ${tier.durationDays} days`,
          },
          unit_amount: tier.price,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${baseUrl}/${locale}/dashboard/properties?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/${locale}/dashboard/properties?canceled=true`,
    metadata: {
      propertyId: propertyId,
      tierId: tierIdString, // Store tierId as lowercase string ('bronze', 'silver', 'gold')
      userId: userId,
      promotionLevel: promotionLevel, // Keep for backward compatibility
      locale,
    },
    customer_email: undefined, // Will be collected during checkout
  });

  return {
    sessionId: checkoutSession.id,
    url: checkoutSession.url,
  };
}

/**
 * Handle Stripe webhook events
 * - Verifies webhook signature
 * - Processes payment success events
 * - Updates property promotion status
 * - Called by API route: /api/webhooks/stripe
 */
export async function handleStripeWebhook(
  event: Stripe.Event
): Promise<{ success: boolean; message?: string }> {
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Extract metadata
      const propertyId = session.metadata?.propertyId;
      const userId = session.metadata?.userId;
      const tierId = session.metadata?.tierId || session.metadata?.promotionLevel; // Support both tierId and promotionLevel for backward compatibility
      const promotionLevel = session.metadata?.promotionLevel as PromotionLevel;

      if (!propertyId || !userId || !tierId) {
        console.error("Missing metadata in Stripe session", session.metadata);
        return { success: false, message: "Missing metadata" };
      }

      // Verify payment was successful
      if (session.payment_status !== "paid") {
        console.error("Payment not completed", session.payment_status);
        return { success: false, message: "Payment not completed" };
      }

      // Verify property ownership (security check)
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          ownerId: userId,
        },
      });

      if (!property) {
        console.error("Property not found or unauthorized", { propertyId, userId });
        return { success: false, message: "Property not found" };
      }

      // Map tierId string to Prisma PromotionLevel enum
      // tierId comes as lowercase string ('bronze', 'silver', 'gold')
      // Strictly convert to uppercase enum keys (BRONZE, SILVER, GOLD)
      const tierIdUpper = tierId.toUpperCase() as keyof typeof PROMOTION_TIERS;
      const tier = PROMOTION_TIERS[tierIdUpper];
      
      if (!tier) {
        console.error("❌ Invalid promotion tier", { tierId, tierIdUpper });
        return { success: false, message: "Invalid promotion tier" };
      }

      // Strictly convert tierId to PromotionLevel enum
      // Ensure the enum value matches exactly
      const newPromotionLevel = tier.level as PromotionLevel;
      
      console.log("🔄 Mapping tierId to PromotionLevel:", {
        tierId,
        tierIdUpper,
        newPromotionLevel,
        tierLevel: tier.level,
      });

      // Calculate featuredUntil date
      const featuredUntil = new Date();
      featuredUntil.setDate(featuredUntil.getDate() + tier.durationDays);

      console.log("📝 Updating property with promotion:", {
        propertyId,
        promotionLevel: newPromotionLevel,
        featuredUntil: featuredUntil.toISOString(),
      });

      // Update property with promotion
      await prisma.property.update({
        where: {
          id: propertyId,
        },
        data: {
          promotionLevel: newPromotionLevel,
          featuredUntil: featuredUntil,
          isFeatured: true,
        },
      });

      console.log("✅ Database update completed successfully");

      // Revalidate pages (locale-agnostic path segments used by next-intl)
      revalidatePath("/dashboard/properties", "page");
      revalidatePath("/properties", "page");
      for (const loc of ["en", "sk", "cs", "de"]) {
        revalidatePath(`/${loc}/dashboard/properties`);
        revalidatePath(`/${loc}/properties`);
      }

      console.log("✅ WEBHOOK SUCCESS: Property promoted to", tierId, {
        propertyId,
        tierId,
        promotionLevel: newPromotionLevel,
        featuredUntil,
      });

      return { success: true };
    }

    return { success: true, message: "Event type not handled" };
  } catch (error) {
    console.error("Error handling Stripe webhook:", error);
    return { success: false, message: "Webhook processing failed" };
  }
}

/**
 * Verify checkout session and update property promotion
 * Fallback mechanism for when webhooks are blocked (e.g., corporate firewall)
 * Called when user is redirected to success page with session_id
 * 
 * @param sessionId - Stripe checkout session ID
 * @returns { success: boolean, message?: string }
 */
export async function verifyCheckoutSession(
  sessionId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify payment was successful
    if (session.payment_status !== "paid") {
      console.error("Payment not completed", {
        sessionId,
        payment_status: session.payment_status,
      });
      return { success: false, message: "Payment not completed" };
    }

    // Extract metadata
    const propertyId = session.metadata?.propertyId;
    const userId = session.metadata?.userId;
    const tierId = session.metadata?.tierId || session.metadata?.promotionLevel;

    if (!propertyId || !userId || !tierId) {
      console.error("Missing metadata in Stripe session", session.metadata);
      return { success: false, message: "Missing metadata" };
    }

    // Verify property ownership (security check)
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        ownerId: userId,
      },
    });

    if (!property) {
      console.error("Property not found or unauthorized", { propertyId, userId });
      return { success: false, message: "Property not found" };
    }

    // Map tierId string to Prisma PromotionLevel enum
    // tierId comes as lowercase string ('bronze', 'silver', 'gold')
    // Strictly convert to uppercase enum keys (BRONZE, SILVER, GOLD)
    const tierIdUpper = tierId.toUpperCase() as keyof typeof PROMOTION_TIERS;
    const tier = PROMOTION_TIERS[tierIdUpper];

    if (!tier) {
      console.error("❌ Invalid promotion tier", { tierId, tierIdUpper });
      return { success: false, message: "Invalid promotion tier" };
    }

    // Strictly convert tierId to PromotionLevel enum
    const newPromotionLevel = tier.level as PromotionLevel;

    console.log("🔄 [VERIFY] Mapping tierId to PromotionLevel:", {
      sessionId,
      tierId,
      tierIdUpper,
      newPromotionLevel,
      tierLevel: tier.level,
    });

    // Calculate featuredUntil date based on tier duration
    const featuredUntil = new Date();
    featuredUntil.setDate(featuredUntil.getDate() + tier.durationDays);

    console.log("📝 [VERIFY] Updating property with promotion:", {
      sessionId,
      propertyId,
      promotionLevel: newPromotionLevel,
      featuredUntil: featuredUntil.toISOString(),
    });

    // Update property with promotion
    await prisma.property.update({
      where: {
        id: propertyId,
      },
      data: {
        promotionLevel: newPromotionLevel,
        featuredUntil: featuredUntil,
        isFeatured: true,
      },
    });

    console.log("✅ [VERIFY] Database update completed successfully");

    // Note: revalidatePath is NOT called here because this function is called
    // during Server Component render phase, which would cause Next.js error:
    // "Route used revalidatePath during render which is unsupported"
    // The database update happens right before the page renders, so the fresh
    // data will be fetched automatically on the next render.

    console.log("✅ [VERIFY] Checkout session verified and property promoted:", {
      sessionId,
      propertyId,
      tierId,
      promotionLevel: newPromotionLevel,
      featuredUntil,
    });

    return { success: true, message: "Payment verified and property promoted" };
  } catch (error) {
    console.error("❌ [VERIFY] Error verifying checkout session:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Verification failed";
    return { success: false, message: errorMessage };
  }
}
