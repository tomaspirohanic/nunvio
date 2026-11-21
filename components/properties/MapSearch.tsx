"use client";

// ============================================
// SEARCH MAP: all results in view, clusters, draw an area
// ============================================
// - Loads every matching listing inside the visible map area from
//   /api/map-points (not only the current results page).
// - Many results come back as clusters (server-side grid); clicking one
//   zooms in.
// - "Draw area": tap points on the map, "Done" filters the search to that
//   polygon (?area=lat,lng;…). Works with touch as well as mouse.
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MapPreviewCard, { prefetchMapPreview, type MapPreviewSeed } from "./MapPreviewCard";
import { parseArea, serializeArea } from "@/lib/listing-search-params";

type Point = { id: string; lat: number; lng: number; price: number; currency: string; offerType: string };
type Cluster = { lat: number; lng: number; count: number };
type MapData = { kind: "points"; points: Point[] } | { kind: "clusters"; clusters: Cluster[] };

type Fallback = { latitude: number | null; longitude: number | null };

const DEFAULT_CENTER: [number, number] = [48.669, 19.699];

function compactPrice(v: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);
  } catch {
    return `${Math.round(v)} ${currency}`;
  }
}

function pillIcon(label: string, active = false) {
  return L.divIcon({
    className: active ? "nv-map-pill nv-map-pill--active" : "nv-map-pill",
    html: `<span>${label.replace(/</g, "&lt;")}</span>`,
    iconSize: [72, 28],
    iconAnchor: [36, 28],
    popupAnchor: [0, -28],
  });
}

function clusterIcon(count: number) {
  const size = count < 10 ? 34 : count < 100 ? 40 : count < 1000 ? 48 : 56;
  return L.divIcon({
    className: "nv-map-cluster",
    html: `<span style="width:${size}px;height:${size}px">${count >= 1000 ? `${Math.round(count / 100) / 10}k` : count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitInitial({ area, fallback }: { area?: Array<[number, number]>; fallback: Fallback[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    map.invalidateSize();
    if (area) {
      map.fitBounds(L.latLngBounds(area), { padding: [30, 30] });
      // The split-screen container settles its size after the first paint.
      const id = setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(L.latLngBounds(area), { padding: [30, 30] });
      }, 300);
      return () => clearTimeout(id);
    }
    const pts = fallback.filter(
      (p) => p.latitude != null && p.longitude != null && p.latitude !== 0 && p.longitude !== 0
    ) as Array<{ latitude: number; longitude: number }>;
    if (pts.length === 1) map.setView([pts[0].latitude, pts[0].longitude], 13);
    else if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts.map((p) => [p.latitude, p.longitude] as [number, number])), {
        padding: [40, 40],
        maxZoom: 14,
      });
    }
  }, [map, area, fallback]);
  return null;
}

function DataLoader({ query, onData }: { query: string; onData: (d: MapData | null) => void }) {
  const map = useMap();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const b = map.getBounds();
      const params = new URLSearchParams(query);
      params.delete("page");
      params.set(
        "bbox",
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(",")
      );
      params.set("zoom", String(map.getZoom()));
      abort.current?.abort();
      abort.current = new AbortController();
      try {
        const res = await fetch(`/api/map-points?${params}`, { signal: abort.current.signal });
        if (res.ok) onData((await res.json()) as MapData);
      } catch {
        /* aborted or offline: keep the previous markers */
      }
    }, 250);
  }, [map, query, onData]);

  useEffect(() => {
    load();
  }, [load]);
  useMapEvents({ moveend: load });
  return null;
}

function DrawCapture({
  active,
  onPoint,
  onMapClick,
}: {
  active: boolean;
  onPoint: (p: [number, number]) => void;
  onMapClick: () => void;
}) {
  useMapEvents({
    click(e) {
      if (active) onPoint([e.latlng.lat, e.latlng.lng]);
      else onMapClick();
    },
  });
  return null;
}

/** Keeps the selected pin's on-screen position up to date while the map moves. */
function PinTracker({
  latLng,
  onPosition,
}: {
  latLng: [number, number] | null;
  onPosition: (p: { x: number; y: number; w: number; h: number } | null) => void;
}) {
  const map = useMap();
  const update = useCallback(() => {
    if (!latLng) return onPosition(null);
    const pt = map.latLngToContainerPoint(latLng);
    const size = map.getSize();
    onPosition({ x: pt.x, y: pt.y, w: size.x, h: size.y });
  }, [map, latLng, onPosition]);
  useEffect(() => {
    update();
  }, [update]);
  useMapEvents({ move: update, zoom: update, resize: update });
  return null;
}

export default function MapSearch({ fallback = [] }: { fallback?: Fallback[] }) {
  const t = useTranslations("MapSearch");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const area = useMemo(() => parseArea(searchParams.get("area") ?? undefined), [searchParams]);

  const [data, setData] = useState<MapData | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<Array<[number, number]>>([]);
  const [selected, setSelected] = useState<(MapPreviewSeed & { lat: number; lng: number }) | null>(null);
  const [pinPos, setPinPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selectedLatLng = useMemo<[number, number] | null>(
    () => (selected ? [selected.lat, selected.lng] : null),
    [selected]
  );

  const selectPin = (p: Point) => {
    setSelected({ id: p.id, price: p.price, currency: p.currency, offerType: p.offerType, lat: p.lat, lng: p.lng });
    // Phones: the card sits at the bottom of the map, so move the pin into
    // the free space above it.
    const m = mapRef.current;
    if (m && window.matchMedia("(max-width: 639px)").matches) {
      const pt = m.latLngToContainerPoint([p.lat, p.lng]);
      const size = m.getSize();
      const targetY = Math.max(70, (size.y - 380) / 2 + 20);
      if (pt.y > size.y - 380 || pt.y < 60) m.panBy([pt.x - size.x / 2, pt.y - targetY]);
    }
  };
  const mapRef = useRef<L.Map | null>(null);

  const applyArea = (next: Array<[number, number]> | null) => {
    const params = new URLSearchParams(query);
    params.delete("page");
    if (next) params.set("area", serializeArea(next));
    else params.delete("area");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-lg">
      <style jsx global>{`
        .nv-map-pill,
        .nv-map-cluster {
          background: transparent;
          border: none;
        }
        .nv-map-pill span {
          display: inline-block;
          white-space: nowrap;
          background: #fff;
          border: 2px solid #dc2626;
          color: #111827;
          font-weight: 700;
          font-size: 12px;
          line-height: 1;
          padding: 6px 10px;
          border-radius: 9999px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
          transform: translateX(-50%);
          margin-left: 50%;
        }
        .nv-map-pill--active span {
          background: #dc2626;
          color: #fff;
          transform: translateX(-50%) scale(1.1);
        }
        .leaflet-marker-icon.nv-map-pill--active {
          z-index: 10000 !important;
        }
        .nv-map-cluster span {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          background: #dc2626;
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          border: 3px solid #fff;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
        }
      `}</style>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={7}
        className="h-full w-full"
        style={{ minHeight: 420, cursor: drawing ? "crosshair" : undefined }}
        ref={mapRef}
        doubleClickZoom={!drawing}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitInitial area={area} fallback={fallback} />
        <DataLoader query={query} onData={setData} />
        <PinTracker latLng={selectedLatLng} onPosition={setPinPos} />
        <DrawCapture
          active={drawing}
          onPoint={(p) => setDraft((d) => [...d, p])}
          onMapClick={() => setSelected(null)}
        />

        {area && !drawing && (
          <Polygon positions={area} pathOptions={{ color: "#dc2626", weight: 2, fillOpacity: 0.06 }} />
        )}
        {drawing && draft.length > 0 && (
          <Polyline positions={draft.length >= 3 ? [...draft, draft[0]] : draft} pathOptions={{ color: "#dc2626", weight: 2, dashArray: "6 6" }} />
        )}

        {!drawing && data?.kind === "clusters" &&
          data.clusters.map((c, i) => (
            <Marker
              key={`c${i}-${c.lat}-${c.lng}`}
              position={[c.lat, c.lng]}
              icon={clusterIcon(c.count)}
              eventHandlers={{
                click: () => {
                  const m = mapRef.current;
                  if (m) m.setView([c.lat, c.lng], Math.min(m.getZoom() + 2, 18));
                },
              }}
            />
          ))}

        {!drawing && data?.kind === "points" &&
          data.points.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={pillIcon(compactPrice(p.price, p.currency, locale), selected?.id === p.id)}
              eventHandlers={{
                click: () => selectPin(p),
                mouseover: () => prefetchMapPreview(p.id, locale),
              }}
            />
          ))}
      </MapContainer>

      {/* Controls */}
      <div className="absolute left-1/2 top-3 z-[500] flex -translate-x-1/2 gap-2">
        {!drawing && (
          <button
            type="button"
            onClick={() => {
              setDraft([]);
              setSelected(null);
              setDrawing(true);
            }}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-md hover:bg-gray-50"
          >
            {area ? t("redraw") : t("drawArea")}
          </button>
        )}
        {!drawing && area && (
          <button
            type="button"
            onClick={() => applyArea(null)}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-md hover:bg-gray-50"
          >
            {t("clearArea")}
          </button>
        )}
        {drawing && (
          <>
            <button
              type="button"
              disabled={draft.length < 3}
              onClick={() => {
                setDrawing(false);
                applyArea(draft);
              }}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
            >
              {t("done")}
            </button>
            <button
              type="button"
              onClick={() => setDraft((d) => d.slice(0, -1))}
              disabled={draft.length === 0}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-md disabled:opacity-50"
            >
              {t("undo")}
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawing(false);
                setDraft([]);
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-md"
            >
              {t("cancel")}
            </button>
          </>
        )}
      </div>
      {selected && !drawing && (
        <MapPreviewCard key={selected.id} seed={selected} anchor={pinPos} onClose={() => setSelected(null)} />
      )}
      {drawing && (
        <div className="absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-gray-900/85 px-4 py-2 text-center text-sm text-white">
          {t("drawHint")}
        </div>
      )}
    </div>
  );
}
