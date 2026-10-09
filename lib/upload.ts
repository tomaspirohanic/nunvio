import { getPresignedUrl, type PresignedUploadResult } from "@/actions/images";

export class UploadError extends Error {
  override name = "UploadError";
}

function assertFileIsReasonableImage(file: File) {
  if (!(file instanceof File)) {
    throw new UploadError("Invalid file object.");
  }
  if (!file.type || !file.type.toLowerCase().startsWith("image/")) {
    throw new UploadError("Only image uploads are supported.");
  }
  // 15MB default guardrail. Adjust as needed for enterprise imports.
  const maxBytes = 15 * 1024 * 1024;
  if (file.size <= 0) throw new UploadError("File is empty.");
  if (file.size > maxBytes) throw new UploadError("File is too large (max 15MB).");
}

/**
 * Uploads a browser File directly to S3/R2 using a presigned PUT URL.
 * Returns the final public URL of the uploaded image.
 */
export async function uploadImageDirectToCloud(file: File): Promise<string> {
  assertFileIsReasonableImage(file);

  let presign: PresignedUploadResult;
  try {
    presign = await getPresignedUrl({
      fileName: file.name,
      fileType: file.type,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get presigned URL.";
    throw new UploadError(msg);
  }

  const res = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new UploadError(
      `Upload failed (${res.status}). ${text ? `Response: ${text}` : ""}`.trim()
    );
  }

  return presign.publicUrl;
}

