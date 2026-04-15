import { Translation } from 'gt-i18n/types';

// TODO: Add purge key/locks to prevent concurrent purges across tabs
// TODO: Add cache key/locks for non-atomic read-modify-write operations across tabs

// ===== Types ===== //

/** A cached translation entry with expiry metadata */
type CachedEntry = { t: Translation; exp: number };

// ===== Constants ===== //

const STORAGE_KEY_PREFIX = 'gt:tx:';
const PURGE_TIMESTAMP_PREFIX = 'gt:tx:purge:';
const FLUSH_INTERVAL = 500;
const DEFAULT_MAX_SIZE = 1_000_000; // ~1M characters (localStorage uses UTF-16)
const DEFAULT_TTL_MS = 86_400_000; // 24 hours
const DEFAULT_PURGE_INTERVAL_MS = 300_000; // 5 minutes
const PURGE_TARGET_RATIO = 0.8; // purge down to 80% of max

// Prevents interval leaks on HMR — keyed by storage key
// eslint-disable-next-line no-undef
const activeIntervals = new Map<string, ReturnType<typeof setInterval>>();

// ===== Class ===== //

/**
 * A localStorage-backed translation cache for a single locale.
 * Used in development mode only to persist runtime translations across page refreshes.
 *
 * Entries are stored with per-entry expiry timestamps and the cache is purged
 * when estimated size exceeds the configured maximum.
 */
export class LocalStorageTranslationCache {
  private _storageKey: string;
  private _writeBuffer: Record<string, Translation> = {};
  // eslint-disable-next-line no-undef
  private _flushTimer: ReturnType<typeof setTimeout> | null = null;
  private _estimatedSize: number = 0;
  private _maxSize: number;
  private _ttl: number;
  private _purgeInterval: number;
  private _purgeTimestampKey: string;

  /**
   * @param locale - The locale this cache is for
   * @param projectId - The project id (namespaces localStorage keys)
   * @param init - Optional initial translations to merge on top of localStorage data.
   *               init values take priority over stale localStorage entries.
   * @param maxSize - Maximum cache size in characters (default: ~1M)
   * @param ttl - TTL in milliseconds for each entry (default: 24 hours)
   * @param purgeInterval - Background purge check interval in ms (default: 5 min)
   */
  constructor({
    locale,
    projectId,
    init,
    maxSize,
    ttl,
    purgeInterval,
  }: {
    locale: string;
    projectId: string;
    init?: Record<string, Translation>;
    maxSize?: number;
    ttl?: number;
    purgeInterval?: number;
  }) {
    this._storageKey = `${STORAGE_KEY_PREFIX}${projectId}:${locale}`;
    this._purgeTimestampKey = `${PURGE_TIMESTAMP_PREFIX}${projectId}:${locale}`;
    this._maxSize = maxSize ?? DEFAULT_MAX_SIZE;
    this._ttl = ttl ?? DEFAULT_TTL_MS;
    this._purgeInterval = purgeInterval ?? DEFAULT_PURGE_INTERVAL_MS;

    // Merge init values on top (init wins on conflict)
    if (init) {
      this.initStorage(init);
    }

    // Start background purge interval (clears any existing interval for HMR safety)
    if (activeIntervals.has(this._storageKey)) {
      // eslint-disable-next-line no-undef
      clearInterval(activeIntervals.get(this._storageKey)!);
    }
    // eslint-disable-next-line no-undef
    const intervalId = setInterval(
      () => this._backgroundPurge(),
      this._purgeInterval
    );
    activeIntervals.set(this._storageKey, intervalId);
  }

  /**
   * Returns the full translation map (cache + pending buffer writes).
   * Filters out expired entries. Buffer entries take priority.
   */
  getInternalCache(): Record<string, Translation> {
    const now = Date.now();
    const cache = this._readFromStorage();
    const result: Record<string, Translation> = {};

    for (const [key, entry] of Object.entries(cache)) {
      if (entry.exp > now) {
        result[key] = entry.t;
      }
    }

    // Buffer entries are always fresh
    Object.assign(result, this._writeBuffer);
    return result;
  }

  /**
   * Queue a translation for writing to localStorage.
   * Writes are batched via a debounced flush.
   */
  write(hash: string, translation: Translation): void {
    this._writeBuffer[hash] = translation;
    this._scheduleFlush();
  }

  /**
   * Remove specific entries from the cache by hash.
   */
  purge(hashes: string[]): void {
    const cache = this._readFromStorage();
    for (const hash of hashes) {
      delete cache[hash];
    }
    this._writeRaw(JSON.stringify(cache));
  }

  // ===== Private Methods ===== //

  /**
   * Schedule a flush of the write buffer.
   * Uses a debounce — resets the timer on each call.
   */
  private _scheduleFlush(): void {
    if (this._flushTimer) return; // already scheduled
    // eslint-disable-next-line no-undef
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._flush();
    }, FLUSH_INTERVAL);
  }

  /**
   * Merge the write buffer into the cache and persist to localStorage.
   * Purges before writing if estimated size exceeds max.
   */
  private _flush(): void {
    if (Object.keys(this._writeBuffer).length === 0) return;

    try {
      const cache = this._readFromStorage();
      const now = Date.now();

      // Purge if estimated size exceeds max
      if (this._estimatedSize > this._maxSize) {
        this._purgeCache(cache, now);
      }

      // Merge buffer entries with expiry
      const exp = now + this._ttl;
      for (const [key, value] of Object.entries(this._writeBuffer)) {
        cache[key] = { t: value, exp };
      }

      this._writeRaw(JSON.stringify(cache));
    } catch {
      // Silently fail
    }

    this._writeBuffer = {};
  }

  /**
   * Purge entries from the cache in place.
   * Phase 1: Remove expired entries.
   * Phase 2: If still over target, drop oldest entries by expiry time.
   */
  private _purgeCache(cache: Record<string, CachedEntry>, now: number): void {
    const keysBeforePurge = Object.keys(cache);
    if (keysBeforePurge.length === 0) return;

    const avgEntrySize = this._estimatedSize / keysBeforePurge.length;

    // Phase 1: Remove expired entries
    deleteExpiredEntries(cache, now);

    // Phase 2: If still over target, drop oldest entries
    const targetSize = this._maxSize * PURGE_TARGET_RATIO;
    const maxEntries = Math.floor(targetSize / avgEntrySize);

    const remaining = Object.entries(cache);
    if (remaining.length > maxEntries) {
      remaining.sort((a, b) => a[1].exp - b[1].exp); // oldest first
      const toDrop = remaining.length - maxEntries;
      for (let i = 0; i < toDrop; i++) {
        delete cache[remaining[i][0]];
      }
    }
  }

  /**
   * Background purge triggered by setInterval.
   * Checks the last purge timestamp to avoid redundant work across tabs,
   * then removes expired entries. Only writes back if something changed.
   * Timestamp is updated after the purge completes.
   */
  private _backgroundPurge(): void {
    try {
      // Check if a purge is needed (another tab may have purged recently)
      // eslint-disable-next-line no-undef
      const raw = localStorage.getItem(this._purgeTimestampKey);
      const lastPurge = raw ? parseInt(raw, 10) : 0;
      const now = Date.now();

      if (now - lastPurge < this._purgeInterval) return;

      // Run TTL purge
      const cache = this._readFromStorage();
      const keysBefore = Object.keys(cache).length;

      deleteExpiredEntries(cache, now);

      // Only write back if something was actually purged
      if (Object.keys(cache).length < keysBefore) {
        this._writeRaw(JSON.stringify(cache));
      }

      // Update timestamp after purge completes
      // eslint-disable-next-line no-undef
      localStorage.setItem(this._purgeTimestampKey, String(now));
    } catch {
      // Silently fail
    }
  }

  /**
   * Read and parse translations from localStorage.
   * Recalibrates estimated size as a side effect.
   * Returns empty object on any error (unavailable, corrupt data, etc.)
   */
  private _readFromStorage(): Record<string, CachedEntry> {
    try {
      // eslint-disable-next-line no-undef
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) {
        this._estimatedSize = 0;
        return {};
      }
      this._estimatedSize = raw.length;
      return JSON.parse(raw) as Record<string, CachedEntry>;
    } catch {
      this._estimatedSize = 0;
      return {};
    }
  }

  /**
   * Persist new entries to localStorage with expiry timestamps.
   * Reads current cache, merges buffer on top, writes back.
   */
  private initStorage(buffer: Record<string, Translation>): void {
    try {
      const cache = this._readFromStorage();
      const exp = Date.now() + this._ttl;

      for (const [key, value] of Object.entries(buffer)) {
        cache[key] = { t: value, exp };
      }

      this._writeRaw(JSON.stringify(cache));
    } catch {
      // Silently fail — localStorage may be unavailable or full
    }
  }

  /**
   * Write a pre-serialized string to localStorage and recalibrate estimate.
   */
  private _writeRaw(serialized: string): void {
    try {
      // eslint-disable-next-line no-undef
      localStorage.setItem(this._storageKey, serialized);
      this._estimatedSize = serialized.length;
    } catch {
      // Silently fail — localStorage may be unavailable or full
    }
  }
}

// ===== Helper Functions ===== //

/**
 * Helper function deletes expired entries from a cache in place.
 */
function deleteExpiredEntries(
  cache: Record<string, CachedEntry>,
  now: number = Date.now()
): void {
  for (const key of Object.keys(cache)) {
    if (cache[key].exp <= now) {
      delete cache[key];
    }
  }
}
