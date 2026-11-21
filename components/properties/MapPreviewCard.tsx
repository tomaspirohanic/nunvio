/* eslint-disable @next/next/no-img-element */
"use client";

// ============================================
// MAP PREVIEW CARD
// ============================================
// Opens over the search map when a price pin is clicked: swipeable photos
// (touch swipe, mouse arrows, keyboard ←/→), price, key facts, location and
// a short excerpt. The whole text area links to the full listing.
// Rendered outside the Leaflet map so swiping the photos never drags the map.
// ============================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bath, BedDouble, ChevronLeft, ChevronRight, ImageOff, MapPin, Square, X } from "lucide-react";
import { Link } from "@/src/i18n/routing";

export type MapPreview = {
  id: string;
  title: string;
  excerpt: string;
  price: number;
  previousPrice: number | null;
  currency: string;
  offerType: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  location: string;
  images: string[];
};

/** What the card already knows from the pin, shown while the rest loads. */
export type MapPreviewSeed = { id: string; price: number; currency: string; offerType: string };

const cache = new Map<string, MapPreview>();

function money(v: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${Math.round(v)} ${currency}`;
  }
}

export function prefetchMapPreview(id: string, locale: string) {
  if (cache.has(id)) return;
  fetch(`/api/map-preview?id=${encodeURIComponent(id)}&locale=${encodeURIComponent(locale)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: MapPreview | null) => {
      if (d) cache.set(id, d);
    })
    .catch(() => {});
}

const CARD_W = 380;
const GAP = 12;

/**
 * Desktop: place the card right above the pin (or below it when there is no
 * room), kept inside the map. Phones: the card stays docked at the bottom.
 */
function useDesktopPosition(
  anchor: { x: number; y: number; w: number; h: number } | null | undefined,
  cardHeight: number
) {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  if (!desktop || !anchor || cardHeight === 0) return undefined;
  const left = Math.max(GAP, Math.min(anchor.w - CARD_W - GAP, anchor.x - CARD_W / 2));
  const pinTop = anchor.y - 34; // price pill sits above its anchor point
  let top: number;
  if (pinTop - GAP - cardHeight >= GAP) top = pinTop - GAP - cardHeight;
  else if (anchor.y + GAP + cardHeight <= anchor.h - GAP) top = anchor.y + GAP;
  else top = Math.max(GAP, Math.min(anchor.h - cardHeight - GAP, anchor.y - cardHeight / 2));
  return { left, top, width: CARD_W } as const;
}

export default function MapPreviewCard({
  seed,
  anchor,
  onClose,
  stack,
}: {
  seed: MapPreviewSeed;
  anchor?: { x: number; y: number; w: number; h: number } | null;
  onClose: () => void;
  /** Several listings in the same spot (e.g. one building): step through them. */
  stack?: { index: number; total: number; go: (i: number) => void };
}) {
  const t = useTranslations("MapSearch");
  const tGallery = useTranslations("Gallery");
  const tProps = useTranslations("Properties");
  const tTypes = useTranslations("PropertyTypes");
  const locale = useLocale();

  const [data, setData] = useState<MapPreview | null>(() => cache.get(seed.id) ?? null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const desktopStyle = useDesktopPosition(anchor, cardHeight);

  useEffect(() => {
    // The card is keyed by listing id, so a cached preview is already in state.
    if (cache.has(seed.id)) return;
    const ctrl = new AbortController();
    fetch(`/api/map-preview?id=${encodeURIComponent(seed.id)}&locale=${encodeURIComponent(locale)}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: MapPreview) => {
        cache.set(seed.id, d);
        setData(d);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setFailed(true);
      });
    return () => ctrl.abort();
  }, [seed.id, locale]);

  const images = data?.images ?? [];
  const count = images.length;

  const goTo = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el || count === 0) return;
      const next = Math.max(0, Math.min(count - 1, i));
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    },
    [count]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo, onClose]);

  const price = data?.price ?? seed.price;
  const currency = data?.currency ?? seed.currency;
  const offerType = data?.offerType ?? seed.offerType;
  const href = `/properties/${seed.id}`;

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={data?.title ?? t("openListing")}
      style={desktopStyle}
      className={`nv-map-preview absolute z-[600] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 ${
        desktopStyle
          ? ""
          : "inset-x-3 bottom-3 mx-auto max-w-[380px] sm:inset-x-auto sm:left-1/2 sm:w-[380px] sm:-translate-x-1/2"
      }`}
    >
      {/* Photos */}
      <div className="group relative h-44 w-full bg-gray-100 sm:h-52">
        {count > 0 ? (
          <div
            ref={track}
            onScroll={(e) => {
              const el = e.currentTarget;
              setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
            }}
            className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((src, i) => (
              <Link key={src} href={href} className="block h-full w-full flex-none snap-center snap-always" draggable={false}>
                <img
                  src={src}
                  alt={tGallery("photoAlt", { n: i + 1 })}
                  loading={i < 2 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                />
              </Link>
            ))}
          </div>
        ) : data || failed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-sm text-gray-400">
            <ImageOff className="h-6 w-6" />
            {t("noPhotos")}
          </div>
        ) : (
          <div className="h-full w-full animate-pulse bg-gray-200" />
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label={tGallery("previous")}
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow transition-opacity hover:bg-white disabled:opacity-0 sm:flex sm:opacity-0 sm:group-hover:opacity-100 sm:disabled:group-hover:opacity-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={tGallery("next")}
              onClick={() => goTo(index + 1)}
              disabled={index >= count - 1}
              className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow transition-opacity hover:bg-white disabled:opacity-0 sm:flex sm:opacity-0 sm:group-hover:opacity-100 sm:disabled:group-hover:opacity-0"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            {count <= 7 ? (
              <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                {images.map((_, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`} />
                ))}
              </div>
            ) : (
              <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                {index + 1} / {count}
              </div>
            )}
          </>
        )}

        <button
          type="button"
          aria-label={tGallery("close")}
          onClick={onClose}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white"
        >
          <X className="h-4 w-4" />
        </button>
        {data?.previousPrice != null && data.previousPrice > data.price && (
          <div className="pointer-events-none absolute left-2 top-2 rounded bg-green-600 px-2 py-0.5 text-xs font-bold text-white shadow">
            {tProps("priceReducedBadge", { percent: Math.round((1 - data.price / data.previousPrice) * 100) })}
          </div>
        )}
      </div>

      {stack && (
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
          <button
            type="button"
            aria-label={t("prevHere")}
            onClick={() => stack.go(stack.index - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>{t("sameSpot", { current: stack.index + 1, total: stack.total })}</span>
          <button
            type="button"
            aria-label={t("nextHere")}
            onClick={() => stack.go(stack.index + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-200"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Text */}
      <Link href={href} className="block px-4 pb-4 pt-3 hover:bg-gray-50">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-gray-900">{money(price, currency, locale)}</span>
          {offerType === "RENT" && <span className="text-sm text-gray-500">{t("perMonth")}</span>}
          {data?.previousPrice != null && data.previousPrice > data.price && (
            <span className="text-sm text-gray-400 line-through">{money(data.previousPrice, currency, locale)}</span>
          )}
        </div>

        {data ? (
          <>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
              <span className="font-semibold">
                {tTypes(data.propertyType)} · {offerType === "RENT" ? tProps("forRent") : tProps("forSale")}
              </span>
              {data.bedrooms > 0 && (
                <span className="inline-flex items-center gap-1" title={tProps("bedrooms")}>
                  <BedDouble className="h-4 w-4 text-gray-500" />
                  {data.bedrooms}
                </span>
              )}
              {data.bathrooms > 0 && (
                <span className="inline-flex items-center gap-1" title={tProps("bathrooms")}>
                  <Bath className="h-4 w-4 text-gray-500" />
                  {data.bathrooms}
                </span>
              )}
              {data.areaSqm > 0 && (
                <span className="inline-flex items-center gap-1" title={tProps("area")}>
                  <Square className="h-4 w-4 text-gray-500" />
                  {data.areaSqm.toLocaleString(locale)} m²
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-3.5 w-3.5 flex-none" />
              <span className="line-clamp-1">{data.location}</span>
            </div>
            {data.excerpt && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{data.excerpt}</p>}
          </>
        ) : failed ? (
          <p className="mt-1 text-sm text-gray-500">{t("previewError")}</p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-gray-200" />
            <div className="h-3.5 w-full animate-pulse rounded bg-gray-200" />
          </div>
        )}

        <span className="mt-3 inline-block text-sm font-semibold text-red-600">{t("openListing")} →</span>
      </Link>
    </div>
  );
}
