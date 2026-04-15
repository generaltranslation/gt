import { Translation } from 'gt-i18n/types';

// ===== Constants ===== //

const STORAGE_KEY_PREFIX = 'gt:tx:';
const FLUSH_INTERVAL = 500;

// ===== Class ===== //

/**
 * A localStorage-backed translation cache for a single locale.
 * Used in development mode only to persist runtime translations across page refreshes.
 *
 * Does NOT extend Cache from gt-i18n — that class is designed for in-memory caching
 * with async fallback, which doesn't apply here. Instead, we match the interface
 * contract (getInternalCache()) for duck-type compatibility.
 */
export class LocalStorageTranslationCache {
  private _locale: string;
  private _storageKey: string;
  private _cache: Record<string, Translation>;
  private _writeBuffer: Record<string, Translation> = {};
  // eslint-disable-next-line no-undef
  private _flushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param locale - The locale this cache is for
   * @param init - Optional initial translations to merge on top of localStorage data.
   *               init values take priority over stale localStorage entries.
   */
  constructor(locale: string, init?: Record<string, Translation>) {
    this._locale = locale;
    this._storageKey = `${STORAGE_KEY_PREFIX}${locale}`;

    // Read existing data from localStorage
    this._cache = this._readFromStorage();

    // Merge init values on top (init wins on conflict)
    if (init) {
      this._cache = { ...this._cache, ...init };
      this._writeToStorage();
    }
  }

  /**
   * Returns the full translation map (cache + pending buffer writes).
   * Buffer entries take priority over cache entries.
   */
  getInternalCache(): Record<string, Translation> {
    if (Object.keys(this._writeBuffer).length === 0) {
      return this._cache;
    }
    return { ...this._cache, ...this._writeBuffer };
  }

  /**
   * Queue a translation for writing to localStorage.
   * Writes are batched via a debounced flush.
   */
  write(hash: string, translation: Translation): void {
    this._writeBuffer[hash] = translation;
    this._scheduleFlush();
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
   */
  private _flush(): void {
    if (Object.keys(this._writeBuffer).length === 0) return;
    Object.assign(this._cache, this._writeBuffer);
    this._writeBuffer = {};
    this._writeToStorage();
  }

  /**
   * Read and parse translations from localStorage.
   * Returns empty object on any error (unavailable, corrupt data, etc.)
   */
  private _readFromStorage(): Record<string, Translation> {
    try {
      // eslint-disable-next-line no-undef
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, Translation>;
    } catch {
      return {};
    }
  }

  /**
   * Persist the current cache to localStorage.
   * No-ops on any error (quota exceeded, unavailable, etc.)
   */
  private _writeToStorage(): void {
    try {
      // eslint-disable-next-line no-undef
      localStorage.setItem(this._storageKey, JSON.stringify(this._cache));
    } catch {
      // Silently fail — localStorage may be unavailable or full
    }
  }
}
