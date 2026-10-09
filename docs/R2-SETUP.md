# Cloudflare R2 Setup Guide

This guide configures a Cloudflare R2 bucket for Nunvio's property image
pipeline (presigned `PUT` uploads directly from the browser, then a public
read URL persisted in the database).

By the end you will have:

- An R2 bucket + S3 API credentials.
- Public read access via a **custom domain** (recommended) or the `r2.dev`
  development URL.
- A **CORS policy** that allows `PUT` uploads from `http://localhost:3000`
  and your production domain.

All of the values below map to the variables in [`.env.example`](../.env.example).

---

## 0. Create the bucket and API token

1. In the Cloudflare dashboard, go to **R2 → Overview → Create bucket**.
   - Name it e.g. `nunvio-images`. → this is `S3_BUCKET_NAME`.
2. Go to **R2 → Manage R2 API Tokens → Create API token**.
   - Permission: **Object Read & Write**.
   - Scope it to the `nunvio-images` bucket.
   - On creation, copy:
     - **Access Key ID** → `S3_ACCESS_KEY_ID`
     - **Secret Access Key** → `S3_SECRET_ACCESS_KEY`
     - **S3 API endpoint** (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
       → `S3_ENDPOINT`
3. Set `S3_REGION="auto"` and `S3_FORCE_PATH_STYLE="true"` in your `.env`.

> The secret is shown **only once** — store it in your secrets manager.

---

## 1. Enable Public Read access

Uploaded objects are private by default. The app stores a **public** URL, so
the bucket needs public read. Choose **one** of the options below.

### Option A — Custom Domain (recommended for production)

A custom domain serves objects through Cloudflare's CDN with caching and your
own hostname.

1. Open your bucket → **Settings** tab.
2. Under **Public access → Custom Domains**, click **Connect Domain**.
3. Enter a subdomain you control, e.g. `images.yourdomain.com`.
   - The domain (or its zone) must be on Cloudflare; a DNS `CNAME` record is
     created automatically.
4. Wait for status to become **Active**.
5. Set in `.env`:

   ```bash
   S3_PUBLIC_BASE_URL="https://images.yourdomain.com"
   ```

### Option B — `r2.dev` public URL (quick, for development)

1. Open your bucket → **Settings** tab.
2. Under **Public access → R2.dev subdomain**, click **Allow Access** and
   confirm.
3. Copy the generated URL, e.g. `https://pub-<HASH>.r2.dev`.
4. Set in `.env`:

   ```bash
   S3_PUBLIC_BASE_URL="https://pub-<HASH>.r2.dev"
   ```

> `r2.dev` is rate-limited and not meant for production traffic — use a custom
> domain before launch.

---

## 2. Configure CORS (required for browser PUT uploads)

The browser uploads files **directly** to R2 using a presigned URL, so the
bucket must allow cross-origin `PUT` requests from your app's origin(s).

1. Open your bucket → **Settings** tab.
2. Find **CORS Policy** → **Edit** (or **Add CORS policy**).
3. Paste the JSON below, then **Save**.

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://www.yourdomain.com",
      "https://yourdomain.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Notes:

- Replace the production origins with your real domain(s). Keep
  `http://localhost:3000` for local development.
- `PUT` is what the presigned upload uses; `GET`/`HEAD` cover reads/preflight.
- `AllowedHeaders: ["Content-Type"]` matches the header the client sends with
  the upload. If you later sign additional headers, add them here.
- **Do not** use `"*"` for `AllowedOrigins` in production — list explicit
  origins only.

---

## 3. Verify your `.env`

Your `.env` should now contain (values are examples):

```bash
S3_REGION="auto"
S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_BUCKET_NAME="nunvio-images"
S3_FORCE_PATH_STYLE="true"
S3_PUBLIC_BASE_URL="https://images.yourdomain.com"
```

Restart the dev server after editing `.env` so the new variables load.

---

## 4. Test the upload

1. Run the app and open a property's **edit** page in the dashboard.
2. Drag an image into the uploader.
   - The browser requests a presigned URL (`getUploadUrl`).
   - It `PUT`s the file straight to R2 (watch the progress bar).
   - The image is persisted (`savePropertyImage`) and appears in the gallery.
3. Open the stored image URL directly in a new tab — it should load from your
   `S3_PUBLIC_BASE_URL`.

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `PUT` fails with a CORS error in the console | CORS policy missing/incorrect origin | Re-check Step 2; ensure the exact origin (scheme + host + port) is listed |
| Upload succeeds but the image URL 404s / access denied | Public read not enabled | Complete Step 1 (custom domain or `r2.dev`) and confirm `S3_PUBLIC_BASE_URL` |
| `SignatureDoesNotMatch` / `403` on `PUT` | Wrong keys or endpoint, or `S3_FORCE_PATH_STYLE` not set | Re-check `S3_ENDPOINT`, keys, and `S3_FORCE_PATH_STYLE="true"` |
| `Missing S3_PUBLIC_BASE_URL` error | Env var not set/loaded | Set it and restart the dev server |
