import { Cache, LifecycleCallback, LifecycleParam } from './Cache';
import { Hash, TranslationKey, TranslationsCache } from './TranslationsCache';
import { Translation } from './utils/types/translation-data';
import { DEFAULT_CACHE_EXPIRY_TIME } from './utils/constants';
import { CreateTranslateMany } from './utils/createTranslateMany';

/**
 * Locales cache lifecycle callback
 */
export type LocalesCacheLifecycleCallback<
  TranslationValue extends Translation,
> = LifecycleCallback<
  Locale,
  Locale,
  CacheEntry<TranslationValue>,
  CacheEntry<TranslationValue>['translationsCache']
>;

/**
 * Translations cache lifecycle callback with locale embedded as first param.
 * Uses base Translation type to avoid generic variance issues.
 */
export type TranslationsCacheLifecycleCallback<
  TranslationValue extends Translation,
> = (params: {
  locale: Locale;
  inputKey: TranslationKey<TranslationValue>;
  cacheKey: Hash;
  cacheValue: TranslationValue;
  outputValue: TranslationValue;
}) => void;

/**
 * Locales cache lifecycle callbacks
 */
export type LocalesCacheLifecycleCallbacks<
  TranslationValue extends Translation,
> = {
  onLocalesCacheHit?: LocalesCacheLifecycleCallback<TranslationValue>;
  onLocalesCacheMiss?: LocalesCacheLifecycleCallback<TranslationValue>;
  onTranslationsCacheHit?: TranslationsCacheLifecycleCallback<TranslationValue>;
  onTranslationsCacheMiss?: TranslationsCacheLifecycleCallback<TranslationValue>;
};

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
  CacheEntry<TranslationValue>,
  CacheEntry<TranslationValue>['translationsCache']
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
   * Translations cache lifecycle callbacks (locale embedded)
   */
  private _onTranslationsCacheHit?: TranslationsCacheLifecycleCallback<TranslationValue>;
  private _onTranslationsCacheMiss?: TranslationsCacheLifecycleCallback<TranslationValue>;

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
    lifecycle: {
      onLocalesCacheHit: onHit,
      onLocalesCacheMiss: onMiss,
      onTranslationsCacheHit,
      onTranslationsCacheMiss,
    },
  }: {
    init?: Record<string, CacheEntry<TranslationValue>>;
    ttl?: number | null;
    createTranslateMany: CreateTranslateMany;
    loadTranslations: SafeTranslationsLoader<TranslationValue>;
    lifecycle: LocalesCacheLifecycleCallbacks<TranslationValue>;
  }) {
    super(init, { onHit, onMiss });

    // Set time to live
    this.ttl = ttl === null ? -1 : (ttl ?? DEFAULT_CACHE_EXPIRY_TIME);

    this._translationLoader = loadTranslations;
    this._createTranslateMany = createTranslateMany;
    this._onTranslationsCacheHit = onTranslationsCacheHit;
    this._onTranslationsCacheMiss = onTranslationsCacheMiss;
  }

  /**
   * Get the translations for a given locale
   * @param key - The locale
   * @returns The translations
   */
  public get(
    key: Locale
  ): CacheEntry<TranslationValue>['translationsCache'] | undefined {
    // Get the cache entry
    const entry = this.getCache(key);
    if (!entry || (entry.expiresAt > 0 && entry.expiresAt < Date.now())) {
      return undefined;
    }
    const value = entry.translationsCache;

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
   * @returns The translations cache
   */
  public async miss(
    key: Locale
  ): Promise<CacheEntry<TranslationValue>['translationsCache']> {
    // Miss the cache
    const cacheValue = await this.missCache(key);

    // Life cycle callback
    const value = cacheValue.translationsCache;
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
      lifecycle: this._createTranslationsCacheLifecycle(locale),
      translateMany: this._createTranslateMany(locale),
    });

    return { translationsCache, expiresAt };
  }

  // ===== PRIVATE METHODS ===== //

  /**
   * Create the translations cache lifecycle
   * @param locale - The locale
   * @returns The translations cache lifecycle
   */
  private _createTranslationsCacheLifecycle(
    locale: Locale
  ): LifecycleParam<
    TranslationKey<TranslationValue>,
    Hash,
    TranslationValue,
    TranslationValue
  > {
    return {
      onHit: this._onTranslationsCacheHit
        ? (params) =>
            this._onTranslationsCacheHit!({
              locale,
              ...params,
            })
        : undefined,
      onMiss: this._onTranslationsCacheMiss
        ? (params) =>
            this._onTranslationsCacheMiss!({
              locale,
              ...params,
            })
        : undefined,
    };
  }
}
