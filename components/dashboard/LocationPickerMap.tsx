"use client";

// ============================================
// LOCATION PICKER MAP
// ============================================
// Click / drag pin to set listing coordinates.
// - Overlay is positioned relative to the map box (not the page)
// - Map recenters when city geocode updates `position`
// - Without a pin yet, centers near the user's browser location
// ============================================

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslations } from "next-intl";

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

/** Slovakia / Central Europe — sensible default for Nunvio before geolocation. */
const FALLBACK_CENTER: [number, number] = [48.669, 19.699];
const FALLBACK_ZOOM = 7;

interface LocationPickerMapProps {
  position: [number, number] | null;
  onChange: (position: [number, number]) => void;
}

function MapClickHandler({
  onPick,
}: {
  onPick: (position: [number, number]) => void;
}) {
  useMapEvents({
    click: (e) => {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

/** Keep map in sync when parent geocodes city → new coordinates. */
function MapViewSync({
  target,
  zoom,
}: {
  target: [number, number];
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    map.setView(target, zoom, { animate: true });
  }, [map, target[0], target[1], zoom]);

  useEffect(() => {
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    // Leaflet often needs a second invalidate after layout settles
    const t = window.setTimeout(() => map.invalidateSize(), 200);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
  }, [map]);

  return null;
}

export default function LocationPickerMap({
  position,
  onChange,
}: LocationPickerMapProps) {
  const t = useTranslations("PropertyForm");
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    position
  );
  const [userCenter, setUserCenter] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setMarkerPosition(position);
  }, [position]);

  // Approximate map center from browser geolocation (does NOT drop a pin).
  useEffect(() => {
    if (position || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCenter([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        // Permission denied / unavailable — keep fallback
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [position]);

  useEffect(() => {
    setMapReady(true);
  }, []);

  const viewCenter = useMemo<[number, number]>(() => {
    if (markerPosition) return markerPosition;
    if (userCenter) return userCenter;
    return FALLBACK_CENTER;
  }, [markerPosition, userCenter]);

  const viewZoom = markerPosition ? 14 : userCenter ? 11 : FALLBACK_ZOOM;

  const handlePick = (next: [number, number]) => {
    setMarkerPosition(next);
    onChange(next);
  };

  const handleMarkerDragEnd = (e: L.DragEndEvent) => {
    const { lat, lng } = e.target.getLatLng();
    handlePick([lat, lng]);
  };

  if (!mapReady) {
    return (
      <div className="relative flex h-[400px] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-300 bg-gray-100 shadow-md">
        <p className="text-sm text-gray-500">{t("findingLocationText")}</p>
      </div>
    );
  }

  return (
    <div className="relative h-[400px] w-full overflow-hidden rounded-lg border border-gray-300 shadow-md">
      <MapContainer
        center={viewCenter}
        zoom={viewZoom}
        className="h-full w-full"
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewSync target={viewCenter} zoom={viewZoom} />
        <MapClickHandler onPick={handlePick} />
        {markerPosition && (
          <Marker
            position={markerPosition}
            draggable
            eventHandlers={{ dragend: handleMarkerDragEnd }}
          />
        )}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[min(100%-1.5rem,280px)] rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-sm text-gray-700 shadow-lg backdrop-blur-sm">
        <p className="font-medium">{t("mapHintTitle")}</p>
        <p className="mt-0.5 text-xs text-gray-500">{t("mapHintBody")}</p>
        {markerPosition && (
          <p className="mt-1 font-mono text-[11px] text-gray-600">
            {markerPosition[0].toFixed(5)}, {markerPosition[1].toFixed(5)}
          </p>
        )}
      </div>
    </div>
  );
}
