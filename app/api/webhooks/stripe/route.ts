// ============================================
// STRIPE WEBHOOK ENDPOINT
// ============================================
// Receives Stripe webhook events for payment confirmation
// - Verifies webhook signature
// - Processes checkout.session.completed events
// - Updates property promotion status
// ============================================

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { handleStripeWebhook } from "@/lib/stripe.server";

// Initialize Stripe for webhook verification
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    if (!stripe || !webhookSecret) {
      return NextResponse.json(
        { error: "Stripe webhook is not configured" },
        { status: 500 }
      );
    }

    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "No signature provided" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const error = err as Error;
      console.error("Webhook signature verification failed:", error.message);
      return NextResponse.json(
        { error: `Webhook Error: ${error.message}` },
        { status: 400 }
      );
    }

    // Handle the event
    const result = await handleStripeWebhook(event);

    // Clear Next.js cache on successful webhook processing
    // This ensures the dashboard and public lists immediately reflect the new promotion status
    if (result.success) {
      revalidatePath("/", "layout");
      revalidatePath("/dashboard/properties");
      revalidatePath("/properties");
    }

    // Always return 200 OK to Stripe (unless signature verification failed)
    // This prevents Stripe from retrying the webhook
    // Errors are logged but we acknowledge receipt
    if (result.success) {
      return NextResponse.json({ received: true, message: result.message });
    } else {
      // Log the error but return 200 OK so Stripe doesn't retry
      console.error("Webhook processing failed:", result.message);
      return NextResponse.json({ 
        received: true, 
        error: result.message || "Webhook processing failed" 
      });
    }
  } catch (error) {
    // Log the error but return 200 OK (unless it's a critical signature error)
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { received: true, error: "Internal server error" }
    );
  }
}
