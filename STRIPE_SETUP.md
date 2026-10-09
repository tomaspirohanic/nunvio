# Stripe Integration Setup Guide

## PHASE 7 - Monetization & Featured Listings

This document outlines the manual steps required to configure Stripe for property promotion payments.

---

## Prerequisites

1. Stripe account (sign up at https://stripe.com)
2. Access to Stripe Dashboard
3. Environment variables configured in `.env`

---

## Step 1: Get Stripe API Keys

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Copy your keys:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

**Note:** Use test keys for development, live keys for production.

---

## Step 2: Configure Environment Variables

Add the following to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_...your_webhook_secret_here

# NextAuth URL (required for Stripe redirects)
NEXTAUTH_URL=http://localhost:3000
```

**Important:**
- Never commit `.env` to version control
- Use test keys (`sk_test_`) for development
- Use live keys (`sk_live_`) only in production

---

## Step 3: Set Up Stripe Webhook

### For Local Development (using Stripe CLI):

1. Install Stripe CLI:
   ```bash
   # Windows (using Scoop)
   scoop install stripe

   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. Login to Stripe CLI:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. Copy the webhook signing secret (starts with `whsec_`) and add to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...copied_secret_here
   ```

### For Production:

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your production URL:
   ```
   https://yourdomain.com/api/webhooks/stripe
   ```
4. Select events to listen for:
   - `checkout.session.completed`
5. Copy the **Signing secret** and add to production `.env`

---

## Step 4: Test the Integration

### Test Payment Flow:

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Log in to your application
3. Navigate to `/dashboard/properties`
4. Click **Promote Property** on any property
5. Select a promotion tier (Bronze, Silver, or Gold)
6. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

### Verify Webhook:

1. Check server logs for webhook events
2. Verify property promotion status updates in database
3. Check that property appears as "Featured" in listings

---

## Promotion Tiers

| Tier   | Price | Duration | Features                    |
|--------|-------|----------|-----------------------------|
| Bronze | €4.99  | 7 days   | Basic featured placement    |
| Silver | €15.99 | 14 days  | Mid-tier featured placement |
| Gold   | €30    | 30 days  | Premium featured placement  |

---

## Security Notes

- ✅ All Stripe keys are read from `.env` only
- ✅ No card data is stored in the application
- ✅ Webhook signatures are verified
- ✅ Property ownership is verified before promotion
- ✅ User authentication is required for all operations

---

## Troubleshooting

### Webhook Not Receiving Events:

1. Verify `STRIPE_WEBHOOK_SECRET` is set correctly
2. Check webhook endpoint URL is accessible
3. Verify webhook is enabled in Stripe Dashboard
4. Check server logs for errors

### Payment Not Processing:

1. Verify `STRIPE_SECRET_KEY` is set correctly
2. Check Stripe Dashboard for payment status
3. Verify test mode vs live mode matches your keys
4. Check browser console for errors

### Property Not Updating After Payment:

1. Check webhook logs for successful processing
2. Verify database connection
3. Check Prisma client is up to date
4. Verify property ownership in webhook handler

---

## Production Checklist

Before going live:

- [ ] Switch to live Stripe keys (`sk_live_` and `pk_live_`)
- [ ] Set up production webhook endpoint
- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Test complete payment flow in production
- [ ] Monitor Stripe Dashboard for transactions
- [ ] Set up error logging and monitoring

---

## Support

For Stripe-specific issues:
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com

For application issues:
- Check server logs
- Verify environment variables
- Review webhook event logs in Stripe Dashboard
