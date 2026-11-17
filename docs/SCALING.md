# Scaling notes (SK + CZ now, whole EU later)

How the portal stays fast and cheap with a large catalog. Read before changing
search, feeds, translations or caching.

## Database (Neon)
- `DATABASE_URL` = **pooled** connection string (`-pooler` host). `DIRECT_URL` = direct one, used only by `prisma db push` / migrations.
- `pg_trgm` extension + GIN trigram indexes make `contains` / `ILIKE '%x%'` searches on city, country, title and description use an index.
- Default sort `(status, promotionLevel DESC, createdAt DESC)` has its own index.
- `Property.countryCode` (ISO code, e.g. `SK`) is derived from the free-text `country` on every write. Searching a country ("Slovensko", "Nemecko", "Germany", "DE") is an indexed equality filter `(status, countryCode, promotionLevel, createdAt)` instead of a text match. Older rows are filled by the maintenance cron (`lib/country-backfill.server.ts`, resumable); unrecognised names get `ZZ`.
- Schema changes: `npm run db:push` (with `DIRECT_URL` set).

## Caching
| Page | Strategy |
|---|---|
| Homepage `/[locale]` | Dynamic shell, DB data cached 5 min (tag `listings`); build needs no DB |
| Listing detail `/[locale]/properties/[id]` | ISR, 10 min, refreshed immediately on edit / import / promotion |
| Search `/[locale]/properties` | Dynamic, but DB result cached 60 s per identical query (tag `listings`) |
| `/api/locations/suggest` | CDN 1 h |

Any listing change must call `revalidateListings(ids)` from `lib/revalidate-listings.ts`.

## Cron jobs (vercel.json)
| Route | Schedule | What |
|---|---|---|
| `/api/cron/sync-feeds` | daily 03:00 UTC (target: every 15 min) | Agency XML feeds. Time-budgeted (stops ~30 s before limit and resumes next run), per-agency lock, unchanged listings skipped by content hash, photos re-downloaded only when their URLs change, listings missing from a complete feed pass are archived (guarded against broken feeds). |
| `/api/cron/maintenance` | daily 03:30 UTC (target: every 10 min) | Demotes expired promotions (was an UPDATE on every page view). Fills missing `countryCode`. |
| `/api/cron/translate-listings` | daily 04:00 UTC (target: every 30 min) | DeepL translations of new/changed listings for `LISTING_TRANSLATION_LOCALES`, capped by `LISTING_TRANSLATION_MAX_CHARS_PER_RUN`. No-op without `DEEPL_API_KEY`. |

All cron routes require `Authorization: Bearer $CRON_SECRET`.

> **Before production launch:** Vercel Hobby rejects crons that run more than once a day, so `vercel.json` currently runs everything daily. Upgrade to **Vercel Pro** and restore the target schedules above (`*/15`, `*/10`, `*/30`). With a daily sync, agency feeds are up to 24 h stale.

## Listing translations
- Never translated during page render. Visitors see a stored translation for their locale, otherwise the original text.
- Editing a listing's title/description (dashboard or feed) deletes its stored translations; the cron job re-creates them.
- Website UI texts are static files in `messages/*.json` (no machine translation at runtime).

## Search
- All public search filtering lives in `lib/listing-search.server.ts` (`buildListingWhere` + `searchListings`). Pages never build Prisma queries for search themselves, so the backend can later be swapped for a search engine without touching the UI.
- Counting stops at 10 000 matches (`MAX_COUNTED_RESULTS`); the UI shows "More than 10 000 results" and pagination ends there (≈208 pages). Exact counts over millions of rows were the slowest part of every search.

## SEO sitemaps
- `/sitemap.xml` is an index: `/sitemaps/static.xml` + `/sitemaps/listings-N.xml` (2 000 published listings each, with hreflang links for all 28 languages). CDN-cached 24 h. `robots.txt` points to it.

## Location search
The public search box suggests cities from our own listings (`/api/locations/suggest`), not from public Nominatim (its usage policy forbids autocomplete and allows ~1 req/s). The address picker in the listing form still geocodes via Nominatim; that is low volume (only people creating listings).

## Growth stages

Measured locally on 3 000 000 listings (16 countries, Postgres 16, no cache), see "Benchmarks" below.

### Stage 1: SK + CZ (up to ~300 000 listings) — current setup
- One Neon Postgres (pooled), Vercel, R2. Everything above is enough.
- Vercel Pro before launch (cron frequency, function duration).

### Stage 2: first EU countries (~0.3 – 2 million listings)
- Neon: bigger compute (4–8 CU) and autoscaling; add a **read replica** and send public search/detail reads to it (`@prisma/extension-read-replicas`, env `DATABASE_REPLICA_URL`). Writes (feeds, dashboard) stay on the primary.
- Image variants (thumbnail + large) at upload, R2 custom domain + Cloudflare cache.
- Per-country listing translation targets (translate a Slovak listing to sk/cs/en/de/hu, not all 28) to keep DeepL cost linear.
- Map: load markers by visible map area (bounding box) with server-side clustering instead of one marker per result.
- Error monitoring (Sentry), slow-query log in Neon.

### Stage 3: whole EU (2 – 20 million listings)
- **Dedicated search engine** (Typesense or Meilisearch Cloud; OpenSearch if we need heavy aggregations). Postgres stays the source of truth; a sync job pushes changed listings (we already have `updatedAt` + content hashes). `searchListings` queries the engine for ids and loads cards from Postgres/cache. Gives typo tolerance, multilingual full-text, facets with counts, geo search and map clustering out of the box.
- Then drop the trigram index on `description` (huge, and it makes every feed write slower).
- Postgres: partition `Property` by `countryCode` (LIST partitions) or archive `ARCHIVED` listings older than N months into a separate table; feed sync workers move from Vercel cron to a queue (e.g. Upstash QStash / Inngest) so thousands of agencies sync in parallel.
- Country-specific domains / subpaths for SEO (nunvio.de, /de-at/…), per-country sitemaps.

### Stage 4: largest portals level (20 M+)
- Multi-region read replicas, CDN edge caching of search pages, separate services for import and media processing. Not needed for years.

## Benchmarks (3 000 000 listings, local Postgres 16, cache off)
| Search | Before | After |
|---|---|---|
| No filter, count + page 1 | 652 ms + 4 ms | 32 ms + 2 ms |
| Country ("Nemecko") | 809 ms + 3 ms | 139 ms + 2 ms |
| City ("Berlin") | 740 ms + 3 ms | 245 ms + 4 ms |
| Country + rent + flat + price, page 100 | 1 622 ms + 1 582 ms | 185 ms + 81 ms |
| Keyword "balcony" | 5 813 ms + 5 ms | 33 ms + 3 ms |

Sitemap: index 0.8 s (1 353 files), one listings file 0.1–1.6 s, CDN-cached 24 h.

Filling `countryCode` on existing rows costs ~2 500 rows/s locally because each update touches every index on `Property` (the description trigram index is the most expensive). Fine for SK + CZ; for a multi-million import run the maintenance endpoint repeatedly or a one-off SQL update off-peak.

## Known next steps
- Generate resized photo variants (e.g. 480 px thumbnail + 1600 px) at upload time; cards still load the stored original (now lazy-loaded).
- Serve R2 through a custom domain (e.g. `images.nunvio.eu`) instead of `r2.dev`, which Cloudflare rate-limits and does not recommend for production.
- Error monitoring (e.g. Sentry) and tests for the importer.
