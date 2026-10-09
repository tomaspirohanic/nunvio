# Nunvio production launch — domains & Vercel (final)

Canonical site: **https://nunvio.eu**  
Also serves the same app: **https://nunvio.com**  
Redirects to `.eu`: **nunvio.sk**, **nunvio.cz** (and `www` variants)

Code already redirects those hosts in `next.config.ts`. You still must attach domains in Vercel + DNS.

---

## 1) Vercel → Domains

1. [vercel.com](https://vercel.com) → projekt **nunvio**
2. **Settings** → **Domains**
3. Add (one by one):

| Domain | Expected behaviour |
| --- | --- |
| `nunvio.eu` | Primary (Production) |
| `www.nunvio.eu` | Redirects → `nunvio.eu` (app or Vercel redirect) |
| `nunvio.com` | Same deployment as `.eu` |
| `www.nunvio.com` | Redirects → `nunvio.com` |
| `nunvio.sk` | Redirects → `nunvio.eu` |
| `www.nunvio.sk` | Redirects → `nunvio.eu` |
| `nunvio.cz` | Redirects → `nunvio.eu` |
| `www.nunvio.cz` | Redirects → `nunvio.eu` |

Vercel shows DNS records for each domain — copy them into your registrar.

---

## 2) DNS (registrár každej domény)

Typical for Vercel (confirm in Domains UI):

**Apex (`nunvio.eu`, `nunvio.com`, `nunvio.sk`, `nunvio.cz`):**
- `A` → `76.76.21.21`  
  **or** Vercel nameservers if they ask you to switch NS

**www:**
- `CNAME` → `cname.vercel-dns.com`  
  (or the exact target Vercel shows)

Wait until all show **Valid** in Vercel Domains.

---

## 3) Environment Variables (Production — FINAL values)

**Settings → Environment Variables** → Environment: **Production**  
After saving everything: **Deployments → … → Redeploy**

### URLs (must be .eu, not vercel.app, not localhost)

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://nunvio.eu` |
| `NEXTAUTH_URL` | `https://nunvio.eu` |

### Auth

| Key | Value |
| --- | --- |
| `NEXTAUTH_SECRET` | same long secret as local (keep forever) |
| `GOOGLE_CLIENT_ID` | from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud |

**Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs** (add all):
- `https://nunvio.eu/api/auth/callback/google`
- `https://nunvio.com/api/auth/callback/google`
- (optional while testing) `https://nunvio.vercel.app/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google`

**Authorized JavaScript origins:**
- `https://nunvio.eu`
- `https://nunvio.com`

### Database

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Neon (or other) Postgres URL |

### Email (Resend)

| Key | Value |
| --- | --- |
| `EMAIL_HOST` | `smtp.resend.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_USER` | `resend` |
| `EMAIL_PASS` | Resend API key |
| `EMAIL_FROM` | ideally `Nunvio <noreply@nunvio.eu>` after domain verified in Resend |

### Cloudflare R2

| Key | Value |
| --- | --- |
| `S3_REGION` | `auto` |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | R2 key |
| `S3_SECRET_ACCESS_KEY` | R2 secret |
| `S3_BUCKET_NAME` | bucket name |
| `S3_FORCE_PATH_STYLE` | `true` |
| `S3_PUBLIC_BASE_URL` | public image base (`https://pub-….r2.dev` or `https://images.nunvio.eu`) |

### Stripe (live when ready)

| Key | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_live_…` (or `sk_test_…` until go-live) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | matching `pk_live_…` / `pk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |

**Stripe Dashboard → Webhooks → endpoint:**
- URL: `https://nunvio.eu/api/webhooks/stripe`
- Event: `checkout.session.completed`

### Cron + partners

| Key | Value |
| --- | --- |
| `CRON_SECRET` | long random hex (same as local `.env`) |
| `PARTNER_CONTACT_EMAIL` | your email |

### Optional

| Key | Value |
| --- | --- |
| `DEEPL_API_KEY` | only if you want real translations |

---

## 4) After DNS is Valid — checks

1. `https://nunvio.sk` → ends on `https://nunvio.eu/…`
2. `https://nunvio.cz` → same
3. `https://nunvio.com` loads the app
4. `https://nunvio.eu/api/health`
5. Google login on `.eu`
6. Image upload
7. From SK IP (or VPN): first visit should prefer `/sk` + EUR; from CZ: `/cs` + CZK; from FR: `/fr` + EUR

---

## 5) Language & currency (already in app)

- Locales cover major EU languages (missing translation files fall back to English UI text).
- Currency switcher: EUR, CZK, PLN, HUF, RON, CHF, SEK, DKK, NOK, BGN, GBP, USD.
- First visit uses Vercel geo IP (`x-vercel-ip-country`) for language + currency; user can override in the UI (cookies remember choice).

---

## Note about `.com` vs `.eu` login

Sessions are per-host. Prefer sharing **nunvio.eu** links.  
If someone logs in only on `.com`, cookies do not automatically apply on `.eu`. Both domains stay in Google OAuth for convenience.
