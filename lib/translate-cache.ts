type CacheEntry = { value: string; expiresAt: number };

// Simple in-memory TTL cache (per Node.js instance)
const store = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_ENTRIES = 20_000;

function now() {
  return Date.now();
}

function pruneIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;

  // Remove expired first, then oldest-ish by insertion order.
  const t = now();
  for (const [k, v] of store) {
    if (v.expiresAt <= t) store.delete(k);
    if (store.size <= MAX_ENTRIES) return;
  }

  while (store.size > MAX_ENTRIES) {
    const firstKey = store.keys().next().value as string | undefined;
    if (!firstKey) break;
    store.delete(firstKey);
  }
}

export function cacheGet(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key: string, value: string, ttlMs: number = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: now() + ttlMs });
  pruneIfNeeded();
}

