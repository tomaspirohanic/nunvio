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
import MapPreviewCard, { prefetchMapPreview } from "./MapPreviewCard";
import { parseArea, serializeArea } from "@/lib/listing-search-params";
import { boundsForCountry, countryForLocale, EUROPE_BOUNDS, type Bounds } from "@/lib/country-bounds";

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

function pillIcon(label: string, state: "normal" | "active" | "visited" = "normal") {
  return L.divIcon({
    className: state === "normal" ? "nv-map-pill" : `nv-map-pill nv-map-pill--${state}`,
    html: `<span>${label.replace(/</g, "&lt;")}</span>`,
    iconSize: [72, 28],
    iconAnchor: [36, 28],
    popupAnchor: [0, -28],
  });
}

function clusterIcon(count: number, active = false) {
  const size = count < 10 ? 34 : count < 100 ? 40 : count < 1000 ? 48 : 56;
  return L.divIcon({
    className: active ? "nv-map-cluster nv-map-cluster--active" : "nv-map-cluster",
    html: `<span style="width:${size}px;height:${size}px">${count >= 1000 ? `${Math.round(count / 100) / 10}k` : count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function toLatLngBounds(b: Bounds) {
  return L.latLngBounds([b[0], b[1]], [b[2], b[3]]);
}

/**
 * Decides where the map looks. Runs on first load and whenever the searched
 * place (or drawn area) changes — not on other filters, so moving the map
 * and then changing e.g. the price keeps the user's view.
 * 1. Drawn area → fit it.
 * 2. Searched place → its country, or the area where its listings are.
 * 3. Nothing searched → the visitor's country (geo / language), else Europe.
 */
function ViewController({
  area,
  location,
  place,
  bbox,
  locale,
  fallback,
  programmaticAt,
}: {
  area?: Array<[number, number]>;
  location: string;
  /** Street / city part picked in "Kde:" — searched by its area (bbox) */
  place: string;
  bbox: Bounds | null;
  locale: string;
  fallback: Fallback[];
  /** Time of our own (not the user's) last map move. */
  programmaticAt: { current: number };
}) {
  const map = useMap();
  // Searching the visible map area: the map is where the user put it.
  const key = area ? `area:${serializeArea(area)}` : location ? `loc:${location.toLowerCase()}` : place && bbox ? `place:${place}:${bbox.join(",")}` : bbox ? "bbox" : "home";
  const initialised = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    // The split-screen container settles its size after the first paint,
    // so fit again a moment later.
    const fit = (b: L.LatLngBounds, maxZoom: number) => {
      const go = () => {
        if (cancelled) return;
        programmaticAt.current = Date.now();
        map.invalidateSize();
        map.fitBounds(b, { padding: [30, 30], maxZoom });
        initialised.current = true;
      };
      go();
      timers.push(setTimeout(go, 300));
    };
    const fitHome = () => {
      const code = readCookie("NEXT_COUNTRY") || countryForLocale(locale);
      fit(toLatLngBounds(boundsForCountry(code) ?? EUROPE_BOUNDS), 9);
    };
    const fitResults = () => {
      const pts = fallback.filter(
        (p) => p.latitude != null && p.longitude != null && p.latitude !== 0 && p.longitude !== 0
      ) as Array<{ latitude: number; longitude: number }>;
      if (pts.length === 0) return fitHome();
      fit(L.latLngBounds(pts.map((p) => [p.latitude, p.longitude] as [number, number])), 14);
    };

    if (key === "bbox") {
      // Coming back to a map-area search (reload, shared link): show that area.
      if (!initialised.current && bbox) {
        programmaticAt.current = Date.now();
        map.invalidateSize();
        map.fitBounds(toLatLngBounds(bbox));
        initialised.current = true;
      }
    } else if (key.startsWith("place:") && bbox) fit(toLatLngBounds(bbox), 16);
    else if (area) fit(L.latLngBounds(area), 18);
    else if (location) {
      fetch(`/api/map-extent?location=${encodeURIComponent(location)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { bounds: Bounds | null; kind?: string } | null) => {
          if (cancelled) return;
          if (d?.bounds) fit(toLatLngBounds(d.bounds), d.kind === "country" ? 9 : 14);
          else fitResults();
        })
        .catch(() => fitResults());
    } else fitHome();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // fallback/area are read only when the place changes (key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/**
 * "Search as I move the map": after the user pans or zooms, the results
 * list switches to the visible area (?bbox=…, typed place dropped).
 */
function MapMoveSync({
  enabled,
  programmaticAt,
}: {
  enabled: boolean;
  programmaticAt: { current: number };
}) {
  const map = useMap();
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useMapEvents({
    moveend: () => {
      if (!enabled || Date.now() - programmaticAt.current < 1200) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("area")) return; // a drawn area decides the results
        const b = map.getBounds();
        params.delete("location");
        params.delete("city");
        params.delete("place");
        params.delete("page");
        params.set("bbox", [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(","));
        window.dispatchEvent(new Event("nv:map-area"));
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }, 500);
    },
  });
  return null;
}

/** Re-renders the markers when the zoom level changes (for pin grouping). */
function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

/** Wall-clock ms; only ever called from event handlers and effects. */
const nowMs = () => Date.now();

type PinGroup = { key: string; lat: number; lng: number; points: Point[] };

/**
 * Groups price pins that would overlap on screen at this zoom into one
 * bubble with a count; zooming in splits them again.
 */
function groupPins(points: Point[], zoom: number): PinGroup[] {
  const groups: Array<{ x: number; y: number; points: Point[] }> = [];
  for (const p of points) {
    const pt = L.CRS.EPSG3857.latLngToPoint(L.latLng(p.lat, p.lng), zoom);
    const g = groups.find((g) => Math.abs(g.x - pt.x) < 78 && Math.abs(g.y - pt.y) < 30);
    if (g) g.points.push(p);
    else groups.push({ x: pt.x, y: pt.y, points: [p] });
  }
  return groups.map((g) => ({
    key: g.points.map((p) => p.id).join(","),
    lat: g.points.reduce((a, p) => a + p.lat, 0) / g.points.length,
    lng: g.points.reduce((a, p) => a + p.lng, 0) / g.points.length,
    points: g.points,
  }));
}

const VISITED_KEY = "nv-visited-listings";
function loadVisited(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(VISITED_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveVisited(ids: Set<string>) {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify(Array.from(ids).slice(-500)));
  } catch {
    /* private mode */
  }
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
  /** Selected pin; `group` = all listings in the same spot (e.g. one building). */
  const [selected, setSelected] = useState<{ point: Point; group: Point[] } | null>(null);
  const [pinPos, setPinPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(7);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const location = searchParams.get("location") ?? searchParams.get("city") ?? "";
  const place = searchParams.get("place") ?? "";
  const bboxParam = searchParams.get("bbox");
  const bbox = useMemo<Bounds | null>(() => {
    const n = (bboxParam ?? "").split(",").map(Number);
    return n.length === 4 && n.every(Number.isFinite) ? [n[1], n[0], n[3], n[2]] : null; // → [s, w, n, e]
  }, [bboxParam]);
  const programmaticAt = useRef(0);
  const [syncList, setSyncList] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem("nv-map-sync") === "0") setSyncList(false);
    } catch {
      /* storage blocked */
    }
  }, []);
  const toggleSync = () => {
    setSyncList((v) => {
      try {
        localStorage.setItem("nv-map-sync", v ? "0" : "1");
      } catch {
        /* storage blocked */
      }
      return !v;
    });
  };
  const selectedLatLng = useMemo<[number, number] | null>(
    () => (selected ? [selected.point.lat, selected.point.lng] : null),
    [selected]
  );

  useEffect(() => {
    // Read once after mount (localStorage is not available on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisited(loadVisited());
    const onHover = (e: Event) => setHoveredId((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener("nv:hover-listing", onHover);
    return () => window.removeEventListener("nv:hover-listing", onHover);
  }, []);

  const markVisited = (id: string) => {
    setVisited((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveVisited(next);
      return next;
    });
  };

  const selectPin = (p: Point, group: Point[] = [p]) => {
    setSelected({ point: p, group });
    markVisited(p.id);
    // Phones: the card sits at the bottom of the map, so move the pin into
    // the free space above it.
    const m = mapRef.current;
    if (m && window.matchMedia("(max-width: 639px)").matches) {
      const pt = m.latLngToContainerPoint([p.lat, p.lng]);
      const size = m.getSize();
      const targetY = Math.max(70, (size.y - 380) / 2 + 20);
      if (pt.y > size.y - 380 || pt.y < 60) {
        programmaticAt.current = nowMs(); // making room for the card is not a new search
        m.panBy([pt.x - size.x / 2, pt.y - targetY]);
      }
    }
  };

  const openGroup = (g: PinGroup) => {
    const m = mapRef.current;
    if (!m) return;
    const b = L.latLngBounds(g.points.map((p) => [p.lat, p.lng] as [number, number]));
    const sameSpot = b.getNorthEast().distanceTo(b.getSouthWest()) < 15; // metres
    const z = m.getZoom();
    if (sameSpot || z >= m.getMaxZoom()) {
      selectPin(g.points[0], g.points);
      return;
    }
    const target = Math.min(m.getBoundsZoom(b.pad(0.3)), m.getMaxZoom());
    if (target > z) m.fitBounds(b.pad(0.3), { maxZoom: target });
    else m.setView([g.lat, g.lng], Math.min(z + 2, m.getMaxZoom()));
  };

  const pinGroups = useMemo(() => {
    if (data?.kind !== "points") return [];
    return groupPins(data.points, zoom);
  }, [data, zoom]);

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
        .nv-map-pill--visited span {
          border-color: #9ca3af;
          color: #6b7280;
        }
        .nv-map-cluster--active span {
          background: #111827;
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
        <ViewController
          area={area}
          location={location}
          place={place}
          bbox={bbox}
          locale={locale}
          fallback={fallback}
          programmaticAt={programmaticAt}
        />
        <MapMoveSync enabled={syncList && !drawing && !area} programmaticAt={programmaticAt} />
        <ZoomWatcher onZoom={setZoom} />
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

        {!drawing &&
          data?.kind === "points" &&
          pinGroups.map((g) => {
            if (g.points.length > 1) {
              const hot = g.points.some((p) => p.id === selected?.point.id || p.id === hoveredId);
              return (
                <Marker
                  key={g.key}
                  position={[g.lat, g.lng]}
                  icon={clusterIcon(g.points.length, hot)}
                  zIndexOffset={hot ? 1000 : 0}
                  eventHandlers={{ click: () => openGroup(g) }}
                />
              );
            }
            const p = g.points[0];
            const state =
              selected?.point.id === p.id || hoveredId === p.id ? "active" : visited.has(p.id) ? "visited" : "normal";
            return (
              <Marker
                key={p.id}
                position={[p.lat, p.lng]}
                icon={pillIcon(compactPrice(p.price, p.currency, locale), state)}
                zIndexOffset={state === "active" ? 1000 : 0}
                eventHandlers={{
                  click: () => selectPin(p),
                  mouseover: () => prefetchMapPreview(p.id, locale),
                }}
              />
            );
          })}
      </MapContainer>

      {!drawing && !area && (
        <label className="absolute right-3 top-14 z-[500] flex cursor-pointer select-none items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-md sm:top-3">
          <input
            type="checkbox"
            checked={syncList}
            onChange={toggleSync}
            className="h-4 w-4 accent-red-600"
          />
          {t("searchAsMove")}
        </label>
      )}

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
        <MapPreviewCard
          key={selected.point.id}
          seed={selected.point}
          anchor={pinPos}
          onClose={() => setSelected(null)}
          stack={
            selected.group.length > 1
              ? {
                  index: selected.group.findIndex((p) => p.id === selected.point.id),
                  total: selected.group.length,
                  go: (i: number) => {
                    const g = selected.group;
                    const next = g[(i + g.length) % g.length];
                    setSelected({ point: next, group: g });
                    markVisited(next.id);
                  },
                }
              : undefined
          }
        />
      )}
      {drawing && (
        <div className="absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-gray-900/85 px-4 py-2 text-center text-sm text-white">
          {t("drawHint")}
        </div>
      )}
    </div>
  );
}
