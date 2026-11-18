// ============================================
// NEIGHBOURHOOD: schools, transport, shops, health, parks (SERVER-ONLY)
// ============================================
// Source: OpenStreetMap via the Overpass API (free, worldwide, all EU
// countries). To stay polite and fast at scale:
// - results are cached per ~200 m cell in NearbyCache (many listings share
//   a cell), so a city with 10 000 listings needs a few hundred lookups;
// - lookups happen only when a person opens a listing (the browser asks
//   /api/nearby), not when crawlers render pages;
// - OVERPASS_URL can point to a self-hosted Overpass when traffic grows.
// ============================================

import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type NearbyCategory = "school" | "transport" | "shop" | "health" | "park";
export type Place = { c: NearbyCategory; n: string | null; la: number; lo: number };
export type NearbyResult = Array<{
  category: NearbyCategory;
  count: number;
  nearest: Array<{ name: string | null; meters: number; walkMinutes: number }>;
}>;

const CELL = 0.002; // degrees ≈ 220 m north–south
const RADIUS_M = 1200;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const CATEGORIES: NearbyCategory[] = ["transport", "school", "shop", "health", "park"];

export function cellKey(lat: number, lng: number) {
  return `${Math.round(lat / CELL)}:${Math.round(lng / CELL)}`;
}

function cellCenter(key: string): [number, number] {
  const [a, b] = key.split(":").map(Number);
  return [a * CELL, b * CELL];
}

export function overpassQuery(lat: number, lng: number, radius = RADIUS_M) {
  const a = `(around:${radius},${lat.toFixed(5)},${lng.toFixed(5)})`;
  return `[out:json][timeout:15];(
nwr${a}[amenity~"^(school|kindergarten)$"];
node${a}[highway=bus_stop];
node${a}[railway~"^(tram_stop|station|halt|subway_entrance)$"];
nwr${a}[shop~"^(supermarket|convenience|bakery)$"];
nwr${a}[amenity~"^(pharmacy|doctors|clinic|hospital)$"];
nwr${a}[leisure=park];
);out center 400;`;
}

type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export function classify(tags: Record<string, string>): NearbyCategory | null {
  if (tags.amenity === "school" || tags.amenity === "kindergarten") return "school";
  if (tags.highway === "bus_stop" || tags.railway) return "transport";
  if (tags.shop) return "shop";
  if (["pharmacy", "doctors", "clinic", "hospital"].includes(tags.amenity ?? "")) return "health";
  if (tags.leisure === "park") return "park";
  return null;
}

export function parseOverpass(json: { elements?: OverpassElement[] }): Place[] {
  const out: Place[] = [];
  for (const e of json.elements ?? []) {
    const la = e.lat ?? e.center?.lat;
    const lo = e.lon ?? e.center?.lon;
    const c = e.tags ? classify(e.tags) : null;
    if (la == null || lo == null || !c) continue;
    out.push({ c, n: e.tags?.name ?? null, la, lo });
  }
  return out;
}

function meters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Group places by category, nearest first; walking ≈ 80 m/min × 1.3 detour. */
export function summarize(places: Place[], lat: number, lng: number): NearbyResult {
  return CATEGORIES.map((category) => {
    const items = places
      .filter((p) => p.c === category)
      .map((p) => ({ name: p.n, meters: Math.round(meters(lat, lng, p.la, p.lo)) }))
      .filter((p) => p.meters <= 1000)
      .sort((a, b) => a.meters - b.meters);
    // Bus stops come in pairs (one per direction): drop same-name duplicates.
    const seen = new Set<string>();
    const unique = items.filter((p) => {
      if (!p.name) return true;
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
    return {
      category,
      count: unique.length,
      nearest: unique.slice(0, 3).map((p) => ({
        ...p,
        walkMinutes: Math.max(1, Math.round((p.meters * 1.3) / 80)),
      })),
    };
  });
}

async function fetchPlaces(lat: number, lng: number): Promise<Place[]> {
  const url = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Nunvio/1.0 (+https://nunvio.eu)",
    },
    body: `data=${encodeURIComponent(overpassQuery(lat, lng))}`,
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return parseOverpass(await res.json());
}

/** Nearby places for a listing position (cached per cell). */
export async function getNearby(lat: number, lng: number): Promise<NearbyResult | null> {
  const key = cellKey(lat, lng);
  const cached = await prisma.nearbyCache.findUnique({ where: { cell: key } });
  let places: Place[] | null = cached ? (cached.places as unknown as Place[]) : null;
  if (!cached || Date.now() - cached.fetchedAt.getTime() > MAX_AGE_MS) {
    try {
      const [cLat, cLng] = cellCenter(key);
      places = await fetchPlaces(cLat, cLng);
      await prisma.nearbyCache.upsert({
        where: { cell: key },
        create: { cell: key, places: places as unknown as Prisma.InputJsonValue },
        update: { places: places as unknown as Prisma.InputJsonValue, fetchedAt: new Date() },
      });
    } catch (err) {
      console.warn("[nearby] lookup failed", err);
      // Stale data is better than none.
    }
  }
  return places ? summarize(places, lat, lng) : null;
}
