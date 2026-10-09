# Nunvio

European real-estate marketplace (Next.js + Prisma/PostgreSQL + NextAuth + Cloudflare R2 + Stripe).

## Quick start (local)

```bash
npm install
cp .env.example .env
# fill .env values
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3000

## What you (operator) must configure

These cannot be finished in code — you set them in external dashboards and `.env`:

1. **PostgreSQL** — `DATABASE_URL` (e.g. Neon). Then `npm run db:push` or `npm run db:migrate`.
2. **NextAuth** — `NEXTAUTH_SECRET`, `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` (production HTTPS URL).
3. **Google OAuth** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`  
   Redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google`
4. **SMTP email** — `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`  
   Needed for signup confirmation, password reset, and lead inquiries. Without SMTP, links are logged to the server console.
5. **Cloudflare R2** — all `S3_*` vars (see `docs/R2-SETUP.md`)
6. **Stripe** — `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`  
   Webhook endpoint: `https://YOUR_DOMAIN/api/webhooks/stripe` (event `checkout.session.completed`)  
   See `STRIPE_SETUP.md`
7. **Domain / hosting** — deploy (Vercel or similar), DNS, TLS. Optional custom image domain for R2.
8. **Automatic CRM feeds** — set `CRON_SECRET` (same value locally + Vercel). Cron hits `/api/cron/sync-feeds` every 15 minutes (`vercel.json`). Agencies enable a HTTPS XML URL in Dashboard → XML import. Spec: `docs/PARTNER-FEED.md`. Outreach emails: `docs/PARTNER-OUTREACH.md`. Public page: `/partners`. Validate API: `POST /api/partners/validate-feed`.  
   Note: Vercel Hobby only allows 1 cron/day; use Pro for `*/15`.
9. **Partner contact** — `PARTNER_CONTACT_EMAIL` (shown on `/partners`).
10. **Legal** — replace placeholder text on `/legal/privacy` and `/legal/terms` with your company details (IČO, address, DPO).
11. **Optional** — `DEEPL_API_KEY` for real listing translations (otherwise mock/fallback).

After first Google login as `tomas.pirohanic@gmail.com`, run `npm run db:seed` (sets SUPERADMIN + demo agency/listing). Then **sign out and sign in** so the session picks up the role. Admin UI: `/admin`.

## Product surface (done)

- Public search + map, property detail, agency profile
- Google + email/password signup with localized verification + password reset
- Dashboard CRUD, R2 image uploads, XML import, agency team
- Automatic XML feed sync (chunked) for large partner catalogs
- Partner page `/partners` + feed validation API + CRM outreach templates
- Stripe promotions (Bronze/Silver/Gold) with expiry cleanup
- Lead inquiries emailed to agency/owner
- Draft / Published / Archived listing status
- Pagination on search (DB count/skip — safe for large catalogs)
- Footer + privacy/terms placeholders
- Health check: `/api/health`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run db:push` | Sync Prisma schema to DB |
| `npm run db:migrate` | Apply migrations (prod) |
| `npm run db:seed` | SUPERADMIN + demo data |
