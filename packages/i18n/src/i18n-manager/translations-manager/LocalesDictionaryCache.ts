import { Cache } from './Cache';
import { DictionaryCache } from './DictionaryCache';
import type {
  Dictionary,
  DictionaryKey,
  DictionaryPath,
  DictionaryValue,
} from './DictionaryCache';
import { DEFAULT_CACHE_EXPIRY_TIME } from './utils/constants';
import type { CreateTranslateMany } from './utils/createTranslateMany';
import type {
  DictionaryCacheLifecycleCallback,
  LocalesDictionaryCacheLifecycleCallbacks,
  LifecycleParam,
} from '../lifecycle-hooks/types';
import type { Locale } from './LocalesCache';

/**
 * Cache entry
 * @typedef {Object} DictionaryCacheEntry
 * @property {number} expiresAt - The time at which the cache entry expires.
 * @property {DictionaryCache} dictionaryCache - The dictionary cache for the locale.
 */
export type DictionaryCacheEntry = {
  expiresAt: number;
  dictionaryCache: DictionaryCache;
};

/**
 * Dictionary loader function type
 */
export type DictionaryLoader = (locale: string) => Promise<Dictionary>;

/**
 * Safe dictionary loader function type
 * @returns A promise that resolves to a dictionary
 * TODO: rename this because we are no longer doing try/catch around the dictionary loader
 */
export type SafeDictionaryLoader = (locale: string) => Promise<Dictionary>;

/**
 * Cache for looking up dictionaries by locale
 */
export class LocalesDictionaryCache extends Cache<
  Locale,
  Locale,
  DictionaryCacheEntry,
  DictionaryCacheEntry['dictionaryCache']
> {
  /**
   * Dictionary loader function
   */
  private _dictionaryLoader: SafeDictionaryLoader;

  /**
   * Translate many function
   */
  private _createTranslateMany: CreateTranslateMany;

  /**
   * Time to live for cache entries
   */
  private ttl: number = DEFAULT_CACHE_EXPIRY_TIME;

  /**
   * Dictionary cache lifecycle callbacks (locale embedded)
   */
  private _onDictionaryCacheHit?: DictionaryCacheLifecycleCallback;
  private _onDictionaryCacheMiss?: DictionaryCacheLifecycleCallback;

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Record<string, DictionaryCacheEntry>} params.init - The initial cache
   * @param {number | null} params.ttl - The time to live for cache entries
   * @param {SafeDictionaryLoader} params.loadDictionary - The dictionary loader function
   * @param {CreateTranslateMany} params.createTranslateMany - Factory function for creating a translate many function
   */
  constructor({
    init = {},
    ttl,
    defaultLocale,
    dictionary = {},
    loadDictionary,
    createTranslateMany,
    lifecycle: {
      onLocalesDictionaryCacheHit: onHit,
      onLocalesDictionaryCacheMiss: onMiss,
      onDictionaryCacheHit,
      onDictionaryCacheMiss,
    },
  }: {
    init?: Record<string, DictionaryCacheEntry>;
    ttl?: number | null;
    defaultLocale: Locale;
    dictionary?: Dictionary;
    createTranslateMany: CreateTranslateMany;
    loadDictionary: SafeDictionaryLoader;
    lifecycle: LocalesDictionaryCacheLifecycleCallbacks;
  }) {
    super(init, { onHit, onMiss });

    // Set time to live
    this.ttl = ttl === null ? -1 : (ttl ?? DEFAULT_CACHE_EXPIRY_TIME);

    this._dictionaryLoader = loadDictionary;
    this._createTranslateMany = createTranslateMany;
    this._onDictionaryCacheHit = onDictionaryCacheHit;
    this._onDictionaryCacheMiss = onDictionaryCacheMiss;

    // The default locale dictionary is always available.
    this.setCache(defaultLocale, {
      dictionaryCache: new DictionaryCache({
        init: dictionary,
        lifecycle: this._createDictionaryCacheLifecycle(defaultLocale),
        translateMany: this._createTranslateMany(defaultLocale),
      }),
      expiresAt: -1,
    });
  }

  /**
   * Get the dictionary for a given locale
   * @param key - The locale
   * @returns The dictionary
   */
  public get(key: Locale): DictionaryCacheEntry['dictionaryCache'] | undefined {
    // Get the cache entry
    const entry = this.getCache(key);
    if (!entry || (entry.expiresAt > 0 && entry.expiresAt < Date.now())) {
      return undefined;
    }
    const value = entry.dictionaryCache;

    // Life cycle callback
    if (value != null && this.onHit) {
      this.onHit({
        inputKey: key,
        cacheKey: this.genKey(key),
        cacheValue: entry,
        outputValue: value,
      });
    }

    return value;
  }

  /**
   * Miss the cache
   * @param key - The locale
   * @returns The dictionary cache
   */
  public async miss(
    key: Locale
  ): Promise<DictionaryCacheEntry['dictionaryCache']> {
    // Miss the cache
    const cacheValue = await this.missCache(key);

    // Life cycle callback
    const value = cacheValue.dictionaryCache;
    if (value != null && this.onMiss) {
      this.onMiss({
        inputKey: key,
        cacheKey: this.genKey(key),
        cacheValue: cacheValue,
        outputValue: value,
      });
    }

    return value;
  }

  /**
   * Generate the cache key for a given locale
   * @param key - The locale
   * @returns The cache key
   *
   * This is just an identity function, no transformation needed
   */
  protected genKey(key: Locale): Locale {
    return key;
  }

  /**
   * Fallback for a cache miss
   * @param locale - The locale
   * @returns The cache entry
   */
  protected async fallback(locale: Locale): Promise<DictionaryCacheEntry> {
    // Fetch dictionary
    const dictionaryPromise = this._dictionaryLoader(locale);

    // Get cache expiry time
    const expiresAt = this.ttl < 0 ? this.ttl : Date.now() + this.ttl;

    // Cache the promise and expiry timestamp
    const dictionaryCache = new DictionaryCache({
      init: await dictionaryPromise,
      lifecycle: this._createDictionaryCacheLifecycle(locale),
      translateMany: this._createTranslateMany(locale),
    });

    return { dictionaryCache, expiresAt };
  }

  // ===== PRIVATE METHODS ===== //

  /**
   * Create the dictionary cache lifecycle
   * @param locale - The locale
   * @returns The dictionary cache lifecycle
   */
  private _createDictionaryCacheLifecycle(
    locale: Locale
  ): LifecycleParam<
    DictionaryKey,
    DictionaryPath,
    DictionaryValue,
    DictionaryValue
  > {
    return {
      onHit: this._onDictionaryCacheHit
        ? (params) =>
            this._onDictionaryCacheHit!({
              locale,
              ...params,
            })
        : undefined,
      onMiss: this._onDictionaryCacheMiss
        ? (params) =>
            this._onDictionaryCacheMiss!({
              locale,
              ...params,
            })
        : undefined,
    };
  }
}
