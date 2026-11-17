# Scaling notes (100k+ listings)

How the portal stays fast and cheap with a large catalog. Read before changing
search, feeds, translations or caching.

## Database (Neon)
- `DATABASE_URL` = **pooled** connection string (`-pooler` host). `DIRECT_URL` = direct one, used only by `prisma db push` / migrations.
- `pg_trgm` extension + GIN trigram indexes make `contains` / `ILIKE '%x%'` searches on city, country, title and description use an index.
- Default sort `(status, promotionLevel DESC, createdAt DESC)` has its own index.
- Schema changes: `npm run db:push` (with `DIRECT_URL` set).

## Caching
| Page | Strategy |
|---|---|
| Homepage `/[locale]` | ISR, 5 min |
| Listing detail `/[locale]/properties/[id]` | ISR, 10 min, refreshed immediately on edit / import / promotion |
| Search `/[locale]/properties` | Dynamic, but DB result cached 60 s per identical query (tag `listings`) |
| `/api/locations/suggest` | CDN 1 h |

Any listing change must call `revalidateListings(ids)` from `lib/revalidate-listings.ts`.

## Cron jobs (vercel.json)
| Route | Schedule | What |
|---|---|---|
| `/api/cron/sync-feeds` | every 15 min | Agency XML feeds. Time-budgeted (stops ~30 s before limit and resumes next run), per-agency lock, unchanged listings skipped by content hash, photos re-downloaded only when their URLs change, listings missing from a complete feed pass are archived (guarded against broken feeds). |
| `/api/cron/maintenance` | every 10 min | Demotes expired promotions (was an UPDATE on every page view). |
| `/api/cron/translate-listings` | every 30 min | DeepL translations of new/changed listings for `LISTING_TRANSLATION_LOCALES`, capped by `LISTING_TRANSLATION_MAX_CHARS_PER_RUN`. No-op without `DEEPL_API_KEY`. |

All cron routes require `Authorization: Bearer $CRON_SECRET`.

## Listing translations
- Never translated during page render. Visitors see a stored translation for their locale, otherwise the original text.
- Editing a listing's title/description (dashboard or feed) deletes its stored translations; the cron job re-creates them.
- Website UI texts are static files in `messages/*.json` (no machine translation at runtime).

## Location search
The public search box suggests cities from our own listings (`/api/locations/suggest`), not from public Nominatim (its usage policy forbids autocomplete and allows ~1 req/s). The address picker in the listing form still geocodes via Nominatim; that is low volume (only people creating listings).

## Known next steps
- Generate resized photo variants (e.g. 480 px thumbnail + 1600 px) at upload time; cards still load the stored original (now lazy-loaded).
- Serve R2 through a custom domain (e.g. `images.nunvio.eu`) instead of `r2.dev`, which Cloudflare rate-limits and does not recommend for production.
- Error monitoring (e.g. Sentry) and tests for the importer.
