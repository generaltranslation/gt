import { Cache } from './Cache';
import { Hash, TranslationsCache } from './TranslationsCache';
import { Translation } from './utils/types/translation-data';
import { DEFAULT_CACHE_EXPIRY_TIME } from './utils/constants';
import { CreateTranslateMany } from './utils/createTranslateMany';

/**
 * Just being explicit about the purpose of this type
 */
export type Locale = string;

/**
 * Cache entry
 * @typedef {Object} CacheEntry
 * @property {number} expiresAt - The time at which the cache entry expires.
 * @property {TranslationsCache<TranslationValue>} translationsCache - The translations cache for the locale.
 */
type CacheEntry<TranslationValue extends Translation> = {
  expiresAt: number;
  translationsCache: TranslationsCache<TranslationValue>;
};

/**
 * Safe translations loader function type
 * @returns A promise that resolves to a mapping of strings to {@link Translation}
 * TODO: rename this because we are no longer doing try/catch around the translation loader
 */
export type SafeTranslationsLoader<TranslationValue extends Translation> = (
  locale: string
) => Promise<Record<Hash, TranslationValue>>;

/**
 * Cache for looking up translations by locale
 */
export class LocalesCache<TranslationValue extends Translation> extends Cache<
  Locale,
  Locale,
  CacheEntry<TranslationValue>
> {
  /**
   * Translation loader function
   */
  private _translationLoader: SafeTranslationsLoader<TranslationValue>;

  /**
   * Translate many function
   */
  private _createTranslateMany: CreateTranslateMany;

  /**
   * Time to live for cache entries
   */
  private ttl: number = DEFAULT_CACHE_EXPIRY_TIME;

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Record<string, CacheEntry<TranslationValue>>} params.init - The initial cache
   * @param {number | null} params.ttl - The time to live for cache entries
   * @param {SafeTranslationsLoader<TranslationValue>} params.loadTranslations - The translation loader function
   * @param {CreateTranslateMany} params.createTranslateMany - Factory function for creating a translate many function
   */
  constructor({
    init = {},
    ttl,
    loadTranslations,
    createTranslateMany,
  }: {
    init?: Record<string, CacheEntry<TranslationValue>>;
    ttl?: number | null;
    createTranslateMany: CreateTranslateMany;
    loadTranslations: SafeTranslationsLoader<TranslationValue>;
  }) {
    super(init);

    // Set time to live
    this.ttl = ttl === null ? -1 : (ttl ?? DEFAULT_CACHE_EXPIRY_TIME);

    this._translationLoader = loadTranslations;
    this._createTranslateMany = createTranslateMany;
  }

  /**
   * Get the translations for a given locale
   * @param key - The locale
   * @returns The translations
   */
  public get(
    key: Locale
  ): CacheEntry<TranslationValue>['translationsCache'] | undefined {
    const entry = this.getCache(key);
    if (!entry || (entry.expiresAt > 0 && entry.expiresAt < Date.now())) {
      // TODO: should we invalidate associated promises here?
      return undefined;
    }
    return entry.translationsCache;
  }

  /**
   * Miss the cache
   * @param key - The locale
   * @returns The translations cache
   */
  public async miss(
    key: Locale
  ): Promise<CacheEntry<TranslationValue>['translationsCache']> {
    const cacheValue = await this.missCache(key);
    return cacheValue.translationsCache;
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
  protected async fallback(
    locale: Locale
  ): Promise<CacheEntry<TranslationValue>> {
    // Fetch translations
    const translationsPromise = this._translationLoader(locale);

    // Get cache expiry time
    const expiresAt = this.ttl < 0 ? this.ttl : Date.now() + this.ttl;

    // Cache the promise and expiry timestamp
    const translationsCache = new TranslationsCache<TranslationValue>({
      init: await translationsPromise,
      translateMany: this._createTranslateMany(locale),
    });
    const entry = { translationsCache, expiresAt };
    const cacheKey = this.genKey(locale);
    this.setCache(cacheKey, entry);

    return entry;
  }
}
