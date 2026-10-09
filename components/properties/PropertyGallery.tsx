"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type GalleryView = "grid" | "list" | "slider";

export default function PropertyGallery({ images }: { images: string[] }) {
  const safeImages = useMemo(() => {
    const cleaned = (Array.isArray(images) ? images : []).filter(
      (url): url is string => typeof url === "string" && url.trim().length > 0
    );

    if (cleaned.length > 0) return cleaned;

    return [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1800&h=1200&fit=crop&q=80",
    ];
  }, [images]);

  const [view, setView] = useState<GalleryView>("grid");
  const [currentIndex, setCurrentIndex] = useState(0);

  const openList = () => setView("list");
  const closeList = () => setView("grid");

  const openSliderAt = (index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), safeImages.length - 1);
    setCurrentIndex(nextIndex);
    setView("slider");
  };

  const closeSliderToList = () => setView("list");

  const goPrev = () =>
    setCurrentIndex((i) => (i - 1 + safeImages.length) % safeImages.length);
  const goNext = () => setCurrentIndex((i) => (i + 1) % safeImages.length);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view === "slider") closeSliderToList();
        if (view === "list") closeList();
        return;
      }

      if (view !== "slider") return;

      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, safeImages.length]);

  // Prevent background scroll when in overlays
  useEffect(() => {
    if (view === "grid") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [view]);

  const gridImages = safeImages.slice(0, 5);
  const mainImage = gridImages[0];
  const sideImages = gridImages.slice(1);

  return (
    <>
      {/* STATE 1: Initial grid */}
      <div className="relative">
        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-2 h-[40vh] md:h-[60vh] rounded-2xl overflow-hidden bg-gray-100">
          <button
            type="button"
            onClick={openList}
            className="col-span-1 md:col-span-2 row-span-2 relative group focus:outline-none"
            aria-label="Open photos"
          >
            <img
              src={mainImage}
              alt="Property photo 1"
              className="object-cover w-full h-full group-hover:opacity-90 transition-opacity"
            />
          </button>

          {Array.from({ length: 4 }).map((_, idx) => {
            const imageUrl = sideImages[idx];
            const isLastTile = idx === 3;

            return (
              <button
                key={idx}
                type="button"
                onClick={openList}
                className="col-span-1 row-span-1 relative group focus:outline-none"
                aria-label={`Open photos${imageUrl ? ` (photo ${idx + 2})` : ""}`}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`Property photo ${idx + 2}`}
                    className="object-cover w-full h-full group-hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}

                {isLastTile && (
                  <div className="absolute bottom-3 right-3">
                    <div className="rounded-full bg-white/95 backdrop-blur px-4 py-2 text-sm font-semibold text-gray-900 shadow-md border border-gray-200 group-hover:bg-white transition-colors">
                      Zobraziť všetky fotky
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* STATE 2: Vertical list modal */}
      {view === "list" && (
        <div className="fixed inset-0 z-[9999] bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">
                Fotky ({safeImages.length})
              </div>
              <button
                type="button"
                onClick={closeList}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 transition-colors"
              >
                Zavrieť
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 max-w-4xl mx-auto py-12 px-4">
            {safeImages.map((url, idx) => (
              <button
                key={`${url}-${idx}`}
                type="button"
                onClick={() => openSliderAt(idx)}
                className="group rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm hover:shadow-md transition-shadow focus:outline-none"
                aria-label={`Open fullscreen slider at photo ${idx + 1}`}
              >
                <img
                  src={url}
                  alt={`Property photo ${idx + 1}`}
                  className="w-full h-auto object-cover group-hover:opacity-95 transition-opacity"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STATE 3: Fullscreen horizontal slider */}
      {view === "slider" && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
          <button
            type="button"
            onClick={closeSliderToList}
            className="absolute top-5 right-5 inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close fullscreen slider"
          >
            <X className="w-7 h-7" />
          </button>

          <button
            type="button"
            onClick={goPrev}
            className="absolute left-4 md:left-8 inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-8 h-8 md:w-9 md:h-9" />
          </button>

          <div className="w-full max-w-6xl px-4">
            <div className="relative w-full h-[70vh] md:h-[80vh] flex items-center justify-center">
              <img
                src={safeImages[currentIndex]}
                alt={`Property photo ${currentIndex + 1}`}
                className="w-full h-full object-contain transition-opacity duration-200"
              />
            </div>

            <div className="mt-4 text-center text-white/80 text-sm">
              {currentIndex + 1} / {safeImages.length}
            </div>
          </div>

          <button
            type="button"
            onClick={goNext}
            className="absolute right-4 md:right-8 inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Next photo"
          >
            <ChevronRight className="w-8 h-8 md:w-9 md:h-9" />
          </button>
        </div>
      )}
    </>
  );
}

