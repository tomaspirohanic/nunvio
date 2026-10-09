"use client";

// ============================================
// IMAGE UPLOADER COMPONENT
// ============================================
// Premium, enterprise-grade gallery uploader.
//
// Pipeline (via useImageUpload):
//   getUploadUrl -> direct PUT to S3/R2 (with progress) -> savePropertyImage
//
// Features:
// - Native HTML5 drag & drop (no extra deps; react-dropzone is not installed).
// - Live "uploading" grid with per-file progress bars + error dismissal.
// - "Uploaded" grid with drag-to-reorder (dnd-kit) and delete.
// - Drop-in compatible with PropertyForm (same props), supporting BOTH the
//   create flow (no propertyId) and the edit flow (persists immediately).
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useImageUpload,
  type UploadedImage,
} from "@/hooks/use-image-upload";
import {
  deletePropertyImage,
  updateImageOrder,
  type SavedPropertyImage,
} from "@/actions/property-images";

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ImageUploaderProps {
  /** Current image URLs (kept in sync for the parent form's hidden inputs). */
  value: string[];
  /** Called whenever the committed gallery changes. */
  onChange: (urls: string[]) => void;
  /** Optional callback when an image is removed (local/create flow). */
  onRemove?: (url: string) => void;
  /**
   * If provided, each successful upload is persisted to DB as a PropertyImage.
   * If omitted (create flow before the property exists), uploads are kept local
   * and surfaced via `onUploadComplete`.
   */
  propertyId?: string;
  /** Fires in the create flow with freshly uploaded cloud URLs. */
  onUploadComplete?: (cloudUrls: string[]) => void;
  /** DB-backed images already linked to the property (edit mode). */
  initialImages?: Pick<SavedPropertyImage, "id" | "url" | "order">[];
}

type GalleryItem = {
  id?: string;
  url: string;
  order?: number;
  source: "db" | "local";
};

export default function ImageUploader({
  value,
  onChange,
  onRemove,
  propertyId,
  onUploadComplete,
  initialImages,
}: ImageUploaderProps) {
  // ---- Committed gallery state -----------------------------------------
  const [items, setItems] = useState<GalleryItem[]>(() => {
    const dbItems =
      initialImages
        ?.slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((img) => ({
          id: img.id,
          url: img.url,
          order: img.order,
          source: "db" as const,
        })) ?? [];
    if (dbItems.length > 0) return dbItems;
    return (value ?? []).map((url) => ({ url, source: "local" as const }));
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mirror refs avoid stale closures inside stable callbacks / async work.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onUploadCompleteRef = useRef(onUploadComplete);
  onUploadCompleteRef.current = onUploadComplete;

  // ---- Upload pipeline (custom hook) -----------------------------------
  const handleUploaded = useCallback(
    (images: UploadedImage[]) => {
      const additions: GalleryItem[] = images.map((img) => ({
        id: img.id,
        url: img.url,
        order: img.order,
        source: img.id ? "db" : "local",
      }));
      const next = [...itemsRef.current, ...additions];
      itemsRef.current = next;
      setItems(next);
      onChangeRef.current(next.map((i) => i.url));

      // Create flow: hand cloud URLs back so the form can persist on submit.
      if (!propertyId) {
        onUploadCompleteRef.current?.(images.map((i) => i.url));
      }
    },
    [propertyId]
  );

  const { tasks, isUploading, uploadFiles, removeTask } = useImageUpload({
    propertyId,
    onUploaded: handleUploaded,
  });

  // Once a task succeeds it is lifted into the gallery, so prune it from the
  // transient list (also revokes its object URL inside the hook).
  useEffect(() => {
    const finishedSuccess = tasks.filter((t) => t.status === "success");
    if (finishedSuccess.length > 0) {
      finishedSuccess.forEach((t) => removeTask(t.id));
    }
  }, [tasks, removeTask]);

  const uploadingTasks = useMemo(
    () => tasks.filter((t) => t.status === "uploading" || t.status === "idle"),
    [tasks]
  );
  const errorTasks = useMemo(
    () => tasks.filter((t) => t.status === "error"),
    [tasks]
  );

  // ---- Drag & drop reordering (dnd-kit) --------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const persistOrder = useCallback(
    async (nextItems: GalleryItem[], prevItems: GalleryItem[]) => {
      if (!propertyId) return;
      const canPersist =
        nextItems.length > 0 &&
        nextItems.every(
          (i) => i.source === "db" && typeof i.id === "string" && i.id.length > 0
        );
      if (!canPersist) return;

      const orderedIds = nextItems.map((i) => i.id!) as string[];
      setIsSavingOrder(true);
      try {
        await updateImageOrder(propertyId, orderedIds);
      } catch (err) {
        console.error("Failed to persist image order:", err);
        itemsRef.current = prevItems;
        setItems(prevItems);
        onChangeRef.current(prevItems.map((i) => i.url));
      } finally {
        setIsSavingOrder(false);
      }
    },
    [propertyId]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const current = itemsRef.current;
      const oldIndex = current.findIndex(
        (i) => (i.id ?? i.url) === String(active.id)
      );
      const newIndex = current.findIndex(
        (i) => (i.id ?? i.url) === String(over.id)
      );
      if (oldIndex < 0 || newIndex < 0) return;

      const next = arrayMove(current, oldIndex, newIndex);
      itemsRef.current = next;
      setItems(next);
      onChangeRef.current(next.map((i) => i.url));
      void persistOrder(next, current);
    },
    [persistOrder]
  );

  // ---- Delete / remove -------------------------------------------------
  const removeLocal = useCallback((url: string) => {
    const next = itemsRef.current.filter((i) => i.url !== url);
    itemsRef.current = next;
    setItems(next);
    onChangeRef.current(next.map((i) => i.url));
    onRemove?.(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteDbImage = useCallback(
    async (imageId: string, url: string) => {
      if (!propertyId) return;
      setIsBusy(true);
      try {
        await deletePropertyImage(imageId, propertyId);
        const next = itemsRef.current.filter((i) => i.id !== imageId);
        itemsRef.current = next;
        setItems(next);
        onChangeRef.current(next.map((i) => i.url));
        onRemove?.(url);
      } catch (err) {
        console.error("Failed to delete image:", err);
        alert(err instanceof Error ? err.message : "Failed to delete image");
      } finally {
        setIsBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [propertyId]
  );

  // ---- Dropzone handlers ------------------------------------------------
  const openFileDialog = () => fileInputRef.current?.click();

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void uploadFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files) void uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles]
  );

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const busy = isUploading || isBusy;

  return (
    <div className="space-y-5">
      {/* ---- Dropzone ---- */}
      <div
        role="button"
        tabIndex={0}
        onClick={openFileDialog}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openFileDialog();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          "group relative flex flex-col items-center justify-center gap-3",
          "rounded-2xl border-2 border-dashed px-6 py-12 text-center",
          "cursor-pointer transition-all duration-200 outline-none",
          "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          isDragging
            ? "border-blue-500 bg-blue-50/80 scale-[1.01] shadow-sm"
            : "border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-blue-50/40",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          onChange={onFileInputChange}
          className="hidden"
        />

        <span
          className={[
            "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
            isDragging
              ? "bg-blue-100 text-blue-600"
              : "bg-white text-gray-400 shadow-sm group-hover:text-blue-500",
          ].join(" ")}
        >
          <svg
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6 4.5 4.5 0 0117 15M12 12v9m0-9l-3 3m3-3l3 3"
            />
          </svg>
        </span>

        <div>
          <p className="text-sm font-semibold text-gray-800">
            Drag &amp; drop images here, or{" "}
            <span className="text-blue-600 underline-offset-2 group-hover:underline">
              click to browse
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            PNG, JPG, WebP, GIF or AVIF — up to 15MB each. Multiple files supported.
          </p>
        </div>

        {busy && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-blue-600/90 px-2.5 py-1 text-xs font-medium text-white">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
            Working…
          </span>
        )}
      </div>

      {/* ---- In-progress uploads ---- */}
      {uploadingTasks.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Uploading ({uploadingTasks.length})
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {uploadingTasks.map((task) => (
              <div
                key={task.id}
                className="relative overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={task.previewUrl}
                  alt={task.fileName}
                  className="h-28 w-full object-cover opacity-70"
                  draggable={false}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span className="text-xs font-semibold text-white">
                    {task.progress}%
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 h-1.5 w-full bg-gray-200/70">
                  <div
                    className="h-full bg-blue-500 transition-all duration-200"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <p className="truncate px-2 py-1 text-[11px] text-gray-600">
                  {task.fileName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Failed uploads ---- */}
      {errorTasks.length > 0 && (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            {errorTasks.length} upload{errorTasks.length > 1 ? "s" : ""} failed
          </p>
          <ul className="space-y-1.5">
            {errorTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 text-sm text-red-700"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{task.fileName}:</span>{" "}
                  {task.error}
                </span>
                <button
                  type="button"
                  onClick={() => removeTask(task.id)}
                  className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Committed gallery ---- */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Gallery ({items.length})
            </p>
            {isSavingOrder && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                Saving order…
              </span>
            )}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i, idx) => (i.id ?? i.url) || String(idx))}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item, index) => (
                  <SortableImageCard
                    key={item.id ?? `${item.url}-${index}`}
                    item={item}
                    index={index}
                    disabled={busy}
                    isCover={index === 0}
                    onDeleteDb={(id, url) => void deleteDbImage(id, url)}
                    onRemoveLocal={removeLocal}
                    canDeleteDb={Boolean(item.id && propertyId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable gallery card
// ---------------------------------------------------------------------------
function SortableImageCard(props: {
  item: GalleryItem;
  index: number;
  disabled: boolean;
  isCover: boolean;
  canDeleteDb: boolean;
  onDeleteDb: (imageId: string, url: string) => void;
  onRemoveLocal: (url: string) => void;
}) {
  const { item, index, disabled, isCover, canDeleteDb, onDeleteDb, onRemoveLocal } =
    props;
  const sortableId = (item.id ?? item.url) || String(index);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sortableId, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      {isCover && (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Cover
        </span>
      )}

      {/* Drag handle */}
      <button
        type="button"
        className="absolute right-2 top-2 z-10 cursor-grab rounded-full bg-white/90 p-1 text-gray-600 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100 active:cursor-grabbing"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 4h2v2H9V4zm4 0h2v2h-2V4zM9 9h2v2H9V9zm4 0h2v2h-2V9zM9 14h2v2H9v-2zm4 0h2v2h-2v-2zM9 19h2v2H9v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={`Property image ${index + 1}`}
        className="h-32 w-full object-cover"
        draggable={false}
      />

      {/* Delete */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (canDeleteDb && item.id) onDeleteDb(item.id, item.url);
          else onRemoveLocal(item.url);
        }}
        disabled={disabled}
        aria-label="Remove image"
        title="Remove"
        className="absolute bottom-2 right-2 rounded-full bg-red-500 p-1.5 text-white opacity-0 shadow transition-opacity hover:bg-red-600 disabled:opacity-40 group-hover:opacity-100"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0V5a2 2 0 012-2h2a2 2 0 012 2v2"
          />
        </svg>
      </button>
    </div>
  );
}
