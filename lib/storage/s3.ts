// ============================================
// S3 / R2 STORAGE SERVICE
// ============================================
// Centralized object-storage layer for property imagery.
//
// Why this exists:
// - Single source of truth for presigned-URL generation and server-side
//   uploads (used by the XML background worker / importer).
// - Provider-agnostic: works with standard AWS S3 and S3-compatible
//   providers such as Cloudflare R2 (see `lib/s3-client.ts` for the
//   credential/endpoint resolution).
//
// Security notes:
// - Presigned PUT URLs let the browser upload DIRECTLY to the bucket, so
//   large files never transit our serverless functions (cost + latency win).
// - URLs are short-lived (default 60s) to limit replay/abuse.
// - We never set object ACLs here because many S3-compatible providers
//   (R2 included) reject them. Public read should be configured at the
//   bucket-policy / public gateway / custom-domain layer.
// ============================================

import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getS3BucketName } from "@/lib/s3-client";

// Presigned upload URLs expire quickly to reduce the abuse window.
const PRESIGNED_URL_TTL_SECONDS = 60;

// Hard ceiling for server-side fetch-and-upload (worker path) to protect
// memory in serverless environments. 25 MB is generous for listing photos.
const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;

// Allowlist of accepted MIME types. Keeping this tight reduces the
// content-type spoofing surface and prevents arbitrary file uploads.
const ALLOWED_IMAGE_MIME_TYPES = new Set<string>([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export type PresignedUploadResult = {
  /** Short-lived URL the browser PUTs the raw file bytes to. */
  uploadUrl: string;
  /** The object key inside the bucket (store this if you need to delete later). */
  fileKey: string;
  /** The final, publicly reachable URL to persist in the database. */
  publicUrl: string;
};

export type RemoteUploadResult = {
  fileKey: string;
  publicUrl: string;
  /** Resolved content type of the stored object. */
  contentType: string;
  /** Number of bytes written to storage. */
  byteSize: number;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the public-facing base URL used to build the final image URL.
 * For R2 this is typically a custom domain or the r2.dev public bucket URL;
 * for AWS it can be the CloudFront/CDN domain or the bucket's website URL.
 */
function getPublicBaseUrl(): string {
  const value =
    process.env.S3_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL;

  if (!value || value.trim().length === 0) {
    throw new Error(
      "Missing S3_PUBLIC_BASE_URL (or NEXT_PUBLIC_S3_PUBLIC_BASE_URL). " +
        "It is required to construct the public image URL."
    );
  }

  // Strip any trailing slashes so we can safely append `/<key>`.
  return value.trim().replace(/\/+$/, "");
}

/** Builds the canonical public URL for a stored object key. */
function buildPublicUrl(fileKey: string): string {
  return `${getPublicBaseUrl()}/${fileKey}`;
}

/**
 * Strips a trailing file extension (e.g. ".png", ".JPEG") from a basename.
 */
function stripExtension(baseName: string): string {
  return baseName.replace(/\.[a-zA-Z0-9]{1,8}$/i, "") || "image";
}

/**
 * Normalizes a user-supplied file name into a safe object-key stem.
 * - Removes path segments (anti path-traversal)
 * - Strips diacritics (Snímka → Snimka)
 * - Drops the original extension (we always append a MIME-derived one)
 * - Keeps only safe ASCII characters
 */
function sanitizeFileStem(fileName: string): string {
  const raw = (fileName || "image").trim();
  const baseName = raw.split(/[/\\]+/).pop() || "image";
  const stem = stripExtension(baseName);

  const cleaned = stem
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove combining marks
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .toLowerCase()
    .slice(0, 48);

  return cleaned.length > 0 ? cleaned : "image";
}

/**
 * Validates that the provided MIME type is an allowed image type.
 * Throws a descriptive error otherwise.
 */
function assertValidImageType(fileType: string): void {
  const normalized = (fileType || "").trim().toLowerCase();

  if (!normalized.startsWith("image/")) {
    throw new Error("Invalid fileType: only image/* uploads are allowed.");
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.has(normalized)) {
    throw new Error(`Unsupported image type: ${fileType}`);
  }
}

/** Maps a MIME type to a short file extension (never includes "/" or MIME text). */
function extensionFromMime(fileType: string): string {
  switch ((fileType || "").trim().toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default:
      return "bin";
  }
}

/** Cross-runtime UUID generator (Edge/Node/serverless safe). */
function generateUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Builds a hierarchical, collision-resistant object key.
 * Date partitioning keeps prefixes shallow for listing at scale.
 *
 * Example: `nunvio/uploads/u_<id>/2026/07/<uuid>_snimka-obrazovky.jpg`
 */
function buildObjectKey(params: {
  scope: string;
  fileName?: string;
  extension: string;
}): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const uuid = generateUuid();
  const stem = params.fileName ? sanitizeFileStem(params.fileName) : "image";
  // Hard-sanitize extension so a bad MIME never leaks into the key as "image/jpeg".
  const ext = (params.extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";

  return `nunvio/${params.scope}/${year}/${month}/${uuid}_${stem}.${ext}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a presigned PUT URL so the client can upload an image directly
 * to object storage. The server never receives the file bytes.
 *
 * IMPORTANT: This function does NOT perform authentication. Always call it
 * from a context (e.g. a Server Action) that has already verified the user.
 *
 * @param fileName Original client file name (used only to build a nice key).
 * @param fileType MIME type of the file (validated against an allowlist).
 * @param options.userId Optional tenant scope to isolate objects per user.
 * @returns The upload URL, the stored object key, and the final public URL.
 */
export async function generatePresignedUrl(
  fileName: string,
  fileType: string,
  options: { userId?: string } = {}
): Promise<PresignedUploadResult> {
  assertValidImageType(fileType);

  const extension = extensionFromMime(fileType);
  const scope = options.userId ? `uploads/u_${options.userId}` : "uploads/anon";
  const fileKey = buildObjectKey({ scope, fileName, extension });

  try {
    const s3 = createS3Client();
    const bucket = getS3BucketName();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
    });

    return {
      uploadUrl,
      fileKey,
      publicUrl: buildPublicUrl(fileKey),
    };
  } catch (error) {
    // Surface a clean, non-leaky error to callers while logging the cause.
    console.error("[storage] generatePresignedUrl failed:", error);
    throw new Error("Failed to generate a presigned upload URL.");
  }
}

/**
 * Fetches an image from an external URL and uploads it to object storage.
 * Intended for the XML background worker / importer where listing feeds
 * reference images hosted on third-party servers.
 *
 * Streams the remote response into memory as an ArrayBuffer (bounded by
 * MAX_REMOTE_IMAGE_BYTES) and writes it to the bucket under a key scoped to
 * the owning property.
 *
 * @param imageUrl   Absolute http(s) URL of the source image.
 * @param propertyId The property this image belongs to (used in the key).
 * @returns The stored object key, public URL, content type, and byte size.
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  propertyId: string
): Promise<RemoteUploadResult> {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    throw new Error("uploadImageFromUrl: a valid http(s) imageUrl is required.");
  }
  if (!propertyId || propertyId.trim().length === 0) {
    throw new Error("uploadImageFromUrl: propertyId is required.");
  }

  // Abort slow/hung remote fetches so the worker doesn't stall indefinitely.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      // External feeds occasionally block default fetch agents.
      headers: { "User-Agent": "Nunvio-Importer/1.0" },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch remote image (${response.status} ${response.statusText}): ${imageUrl}`
      );
    }

    // Validate content type against our allowlist before downloading bytes.
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ||
      "application/octet-stream";
    assertValidImageType(contentType);

    // Guard against oversized payloads using the advertised length when present.
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error(
        `Remote image exceeds the ${MAX_REMOTE_IMAGE_BYTES}-byte limit: ${imageUrl}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);

    // Re-check after download in case content-length was missing/incorrect.
    if (body.byteLength > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error(
        `Remote image exceeds the ${MAX_REMOTE_IMAGE_BYTES}-byte limit: ${imageUrl}`
      );
    }

    const extension = extensionFromMime(contentType);
    const fileKey = buildObjectKey({
      scope: `properties/${sanitizeFileStem(propertyId)}`,
      extension,
    });

    const s3 = createS3Client();
    const bucket = getS3BucketName();

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey,
        Body: body,
        ContentType: contentType,
        ContentLength: body.byteLength,
      })
    );

    return {
      fileKey,
      publicUrl: buildPublicUrl(fileKey),
      contentType,
      byteSize: body.byteLength,
    };
  } catch (error) {
    console.error(
      `[storage] uploadImageFromUrl failed for property=${propertyId} url=${imageUrl}:`,
      error
    );
    // Preserve the original message when it's already descriptive.
    if (error instanceof Error) throw error;
    throw new Error("Failed to upload image from remote URL.");
  } finally {
    clearTimeout(timeout);
  }
}
