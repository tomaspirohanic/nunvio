"use client";

// ============================================
// useImageUpload — client-side upload orchestrator
// ============================================
// Ties the full direct-to-cloud pipeline together:
//
//   1) getUploadUrl(fileName, fileType)  -> short-lived presigned PUT URL
//   2) PUT the raw bytes straight to S3/R2 (with real progress via XHR)
//   3) savePropertyImage(propertyId, url) -> persist metadata in Prisma
//
// Design notes:
// - Per-file state machine (idle | uploading | success | error) so the UI can
//   render granular progress and per-file failures.
// - Concurrency-limited fan-out: uploads run in parallel but capped, and each
//   file is wrapped in its own try/catch so ONE failure never aborts the rest.
// - Works in BOTH flows:
//     * Edit mode  (propertyId provided) -> images are persisted immediately.
//     * Create mode (no propertyId)      -> images are only uploaded to cloud
//       and returned to the caller, which persists them on form submit.
// ============================================

import { useCallback, useRef, useState } from "react";
import {
  getUploadUrl,
  savePropertyImage,
  type SavePropertyImageResult,
} from "@/actions/images";

export type UploadStatus = "idle" | "uploading" | "success" | "error";

/** A single in-flight / finished upload, surfaced to the UI. */
export interface UploadTask {
  /** Stable client-only id for React keys and updates. */
  id: string;
  fileName: string;
  /** Object URL for an instant local preview while uploading. */
  previewUrl: string;
  status: UploadStatus;
  /** 0–100 upload progress (bytes sent to storage). */
  progress: number;
  /** Human-readable error message when status === "error". */
  error?: string;
}

/** Result handed back to the consumer once an image is fully processed. */
export interface UploadedImage {
  url: string;
  /** Present only when persisted to the DB (edit mode). */
  id?: string;
  order?: number;
}

export interface UseImageUploadOptions {
  /**
   * When provided, each successful upload is persisted via savePropertyImage.
   * When omitted (create flow), images are uploaded to the cloud only.
   */
  propertyId?: string;
  /** Called once per batch with the images that succeeded. */
  onUploaded?: (images: UploadedImage[]) => void;
  /** Max file size in bytes. Defaults to 15MB. */
  maxSizeBytes?: number;
  /** Max number of simultaneous uploads. Defaults to 3. */
  concurrency?: number;
}

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024; // 15MB
const DEFAULT_CONCURRENCY = 3;

const ALLOWED_IMAGE_TYPES = new Set<string>([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/** Generate a stable client-side id (no crypto dependency required). */
function makeTaskId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Synchronous, client-side guardrails before we ever hit the network. */
function validateFile(file: File, maxBytes: number): string | null {
  if (!(file instanceof File)) return "Invalid file.";
  const type = (file.type || "").toLowerCase();
  if (!type.startsWith("image/")) return "Only image files are allowed.";
  if (!ALLOWED_IMAGE_TYPES.has(type)) return `Unsupported image type: ${file.type}`;
  if (file.size <= 0) return "File is empty.";
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `File is too large (max ${mb}MB).`;
  }
  return null;
}

/**
 * PUTs a File to a presigned URL using XMLHttpRequest so we can report real
 * upload progress (the fetch API can't observe request-body progress yet).
 */
function putWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage rejected the upload (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));
    xhr.timeout = 60_000;

    xhr.send(file);
  });
}

/**
 * Runs `worker` over `items` with a bounded number of simultaneous executions.
 * Each worker call is expected to swallow its own errors (returns null on fail),
 * so a single failure never rejects the whole batch.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const {
    propertyId,
    onUploaded,
    maxSizeBytes = DEFAULT_MAX_BYTES,
    concurrency = DEFAULT_CONCURRENCY,
  } = options;

  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Keep latest option values addressable inside stable callbacks.
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const patchTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...patch } : task))
    );
  }, []);

  /** Process a single file end-to-end. Never throws (errors land on the task). */
  const processFile = useCallback(
    async (task: UploadTask, file: File): Promise<UploadedImage | null> => {
      patchTask(task.id, { status: "uploading", progress: 0, error: undefined });

      try {
        // 1) Ask the server for a short-lived presigned PUT URL.
        const { uploadUrl, publicUrl } = await getUploadUrl(file.name, file.type);

        // 2) Stream the bytes straight to S3/R2, tracking progress.
        await putWithProgress(uploadUrl, file, (percent) =>
          patchTask(task.id, { progress: percent })
        );

        // 3) Persist metadata in Prisma when we know the owning property.
        if (propertyId) {
          const saved: SavePropertyImageResult = await savePropertyImage(
            propertyId,
            publicUrl
          );
          patchTask(task.id, { status: "success", progress: 100 });
          return { url: saved.url, id: saved.id, order: saved.order };
        }

        // Create flow: defer DB persistence to the form submit.
        patchTask(task.id, { status: "success", progress: 100 });
        return { url: publicUrl };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed unexpectedly.";
        console.error(`[useImageUpload] failed for "${file.name}":`, err);
        patchTask(task.id, { status: "error", error: message });
        return null;
      }
    },
    [patchTask, propertyId]
  );

  /**
   * Public entry point: validates and uploads a batch of files concurrently.
   * Returns the images that succeeded (also delivered via onUploaded).
   */
  const uploadFiles = useCallback(
    async (input: FileList | File[]): Promise<UploadedImage[]> => {
      const files = Array.from(input ?? []);
      if (files.length === 0) return [];

      // Build a task per file up front so the UI renders immediately.
      const newTasks: { task: UploadTask; file: File; valid: boolean }[] =
        files.map((file) => {
          const validationError = validateFile(file, maxSizeBytes);
          const task: UploadTask = {
            id: makeTaskId(),
            fileName: file.name,
            previewUrl: URL.createObjectURL(file),
            status: validationError ? "error" : "idle",
            progress: 0,
            error: validationError ?? undefined,
          };
          return { task, file, valid: !validationError };
        });

      setTasks((prev) => [...prev, ...newTasks.map((t) => t.task)]);
      setIsUploading(true);

      try {
        const uploadable = newTasks.filter((t) => t.valid);
        const settled = await runWithConcurrency(
          uploadable,
          concurrency,
          ({ task, file }) => processFile(task, file)
        );

        const succeeded = settled.filter(
          (r): r is UploadedImage => r !== null
        );
        if (succeeded.length > 0) {
          onUploadedRef.current?.(succeeded);
        }
        return succeeded;
      } finally {
        setIsUploading(false);
      }
    },
    [concurrency, maxSizeBytes, processFile]
  );

  /** Remove a single transient task (e.g. dismiss a failed upload). */
  const removeTask = useCallback((id: string) => {
    setTasks((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  /** Clear all finished (success/error) tasks from the transient list. */
  const clearFinished = useCallback(() => {
    setTasks((prev) => {
      prev
        .filter((t) => t.status === "success" || t.status === "error")
        .forEach((t) => URL.revokeObjectURL(t.previewUrl));
      return prev.filter((t) => t.status === "uploading" || t.status === "idle");
    });
  }, []);

  return {
    tasks,
    isUploading,
    uploadFiles,
    removeTask,
    clearFinished,
  };
}
