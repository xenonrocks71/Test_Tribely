import api from "./api";

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

// In-memory cache map
const memoryCache = new Map<string, CacheEntry>();

// Pending network requests to avoid duplicate parallel requests for the same URL
const pendingRequests = new Map<string, Promise<any>>();

const DEFAULT_TTL = 30000; // 30 seconds fresh TTL
const SESSION_CACHE_PREFIX = "tribely_datacache_";

/**
 * High-Performance Client Data Cache with SWR (Stale-While-Revalidate) architecture.
 * Serves cached responses in 0ms while silently updating in background.
 */
export const dataCache = {
  /**
   * Get cached data synchronously if available (memory first, then sessionStorage fallback).
   */
  get<T = any>(key: string): T | null {
    // 1. Memory check
    const entry = memoryCache.get(key);
    if (entry) {
      return entry.data as T;
    }

    // 2. Session storage check fallback
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
        if (stored) {
          const parsed = JSON.parse(stored) as CacheEntry<T>;
          // Cache into memory for instant subsequent access
          memoryCache.set(key, parsed);
          return parsed.data;
        }
      } catch {
        // Ignore session storage errors
      }
    }

    return null;
  },

  /**
   * Set cached data in both memory and sessionStorage.
   */
  set<T = any>(key: string, data: T): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };

    memoryCache.set(key, entry);

    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(SESSION_CACHE_PREFIX + key, JSON.stringify(entry));
      } catch {
        // Session storage limit reached, fallback silently to memory
      }
    }
  },

  /**
   * Execute SWR (Stale-While-Revalidate) fetch pattern.
   * If cached data exists, onData is called immediately with 0ms delay.
   * Background fetch updates cache and triggers onData if payload updated.
   */
  async fetchSWR<T = any>(
    url: string,
    onData: (data: T, fromCache: boolean) => void,
    onError?: (err: any) => void,
    ttl: number = DEFAULT_TTL
  ): Promise<T | null> {
    const cachedData = this.get<T>(url);
    const entry = memoryCache.get(url);
    const isStale = !entry || Date.now() - entry.timestamp > ttl;

    // 1. Immediately return cached data if present (0ms sub-millisecond load)
    if (cachedData !== null) {
      onData(cachedData, true);

      // If cache is still fresh, skip background revalidation
      if (!isStale) {
        return cachedData;
      }
    }

    // 2. Perform background revalidation
    try {
      const freshData = await this.prefetch<T>(url);
      if (freshData !== null) {
        onData(freshData, false);
      }
      return freshData;
    } catch (err) {
      if (onError && cachedData === null) {
        onError(err);
      }
      return cachedData;
    }
  },

  /**
   * Prefetch and cache endpoint data in background. Deduplicates concurrent requests.
   */
  async prefetch<T = any>(url: string): Promise<T | null> {
    // Check if request is already in-flight
    if (pendingRequests.has(url)) {
      return pendingRequests.get(url) as Promise<T | null>;
    }

    const requestPromise = (async () => {
      try {
        const response = await api.get(url);
        const data = response.data?.data !== undefined ? response.data.data : response.data;
        this.set(url, data);
        return data as T;
      } catch (err) {
        // Silent prefetch failure
        return null;
      } finally {
        pendingRequests.delete(url);
      }
    })();

    pendingRequests.set(url, requestPromise);
    return requestPromise;
  },

  /**
   * Invalidate specific cache keys or key prefixes.
   */
  invalidate(keyOrPrefix: string): void {
    // Clear matching keys in memory
    for (const k of Array.from(memoryCache.keys())) {
      if (k.startsWith(keyOrPrefix)) {
        memoryCache.delete(k);
      }
    }

    // Clear matching keys in sessionStorage
    if (typeof window !== "undefined") {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(SESSION_CACHE_PREFIX + keyOrPrefix)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => sessionStorage.removeItem(k));
      } catch {
        // Ignore
      }
    }
  },

  /**
   * Clear all cached data.
   */
  clear(): void {
    memoryCache.clear();
    pendingRequests.clear();
    if (typeof window !== "undefined") {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(SESSION_CACHE_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => sessionStorage.removeItem(k));
      } catch {
        // Ignore
      }
    }
  },
};

export default dataCache;
