import { apiClient } from "@/lib/api-client";

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<any>>();
const DEFAULT_TTL = 30000;
const SESSION_CACHE_PREFIX = "tribely_datacache_";

/**
 * High-Performance Client Data Cache with SWR (Stale-While-Revalidate) architecture.
 */
export const dataCache = {
  get<T = any>(key: string): T | null {
    const entry = memoryCache.get(key);
    if (entry) return entry.data as T;

    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
        if (stored) {
          const parsed = JSON.parse(stored) as CacheEntry<T>;
          memoryCache.set(key, parsed);
          return parsed.data;
        }
      } catch {}
    }
    return null;
  },

  set<T = any>(key: string, data: T): void {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    memoryCache.set(key, entry);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(SESSION_CACHE_PREFIX + key, JSON.stringify(entry));
      } catch {}
    }
  },

  prefetch(url: string): Promise<any> {
    const cached = this.get(url);
    if (cached) return Promise.resolve(cached);

    if (pendingRequests.has(url)) {
      return pendingRequests.get(url)!;
    }

    const req = apiClient.get(url)
      .then((res: any) => {
        const data = res?.data?.data ?? res?.data;
        this.set(url, data);
        pendingRequests.delete(url);
        return data;
      })
      .catch(() => {
        pendingRequests.delete(url);
        return null;
      });

    pendingRequests.set(url, req);
    return req;
  },

  clear(): void {
    memoryCache.clear();
    if (typeof window !== "undefined") {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith(SESSION_CACHE_PREFIX)) {
          sessionStorage.removeItem(k);
        }
      });
    }
  }
};

export default dataCache;
