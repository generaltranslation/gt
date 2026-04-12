import { Cache } from './Cache';
import {
  Hash,
  LocaleTranslationsCache,
  TranslateMany,
} from './LocaleTranslationCache';
import { Translation } from './types/translation-data';
import { CreateRemoteTranslationLoaderParams } from '../translations-loaders/createRemoteTranslationLoader';
import { determineTranslationLoader } from './determineTranslationLoader';
import logger from '../../../logs/logger';
import { DEFAULT_CACHE_EXPIRY_TIME } from './constants';
import { GT } from 'generaltranslation';

/**
 * Just being explicit about the purpose of this type
 */
type Locale = string;

/**
 * Cache entry
 * @typedef {Object} CacheEntry
 * @property {number} expiresAt - The time at which the cache entry expires.
 * @property {LocaleTranslationsCache<TranslationValue>} translations - The translations cache for the locale.
 */
type CacheEntry<TranslationValue extends Translation | unknown = Translation> =
  {
    expiresAt: number;
    localeCache: LocaleTranslationsCache<TranslationValue>;
  };

/**
 * Translations loader function type
 */
type TranslationsLoader = (locale: Locale) => Promise<unknown>;

/**
 * Safe translations loader function type
 * @returns A promise that resolves to a mapping of strings to {@link Translation}
 * TODO: rename this because we are no longer doing try/catch around the translation loader
 */
type SafeTranslationsLoader<TranslationValue extends Translation | unknown> = (
  locale: string
) => Promise<Record<Hash, TranslationValue>>;

/**
 * Cache for translations
 */
export class TranslationsCache<
  TranslationValue extends Translation | unknown = Translation,
> extends Cache<Locale, Locale, CacheEntry<TranslationValue>> {
  /**
   * Translation loader function
   */
  private _translationLoader: SafeTranslationsLoader<TranslationValue>;

  /**
   * Translate many function
   */
  private _translateMany: TranslateMany;

  /**
   * Time to live for cache entries
   */
  private ttl: number = DEFAULT_CACHE_EXPIRY_TIME;

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Record<string, CacheEntry<TranslationValue>>} params.init - The initial cache
   * @param {CreateRemoteTranslationLoaderParams} params.remoteTranslationLoaderParams - The parameters for the remote translation loader
   * @param {number | null} params.ttl - The time to live for cache entries
   * @param {TranslationsLoader} params.loadTranslations - The translation loader function
   */
  constructor({
    init,
    remoteTranslationLoaderParams,
    ttl,
    loadTranslations,
    translateMany,
  }: {
    init: Record<string, CacheEntry<TranslationValue>>;
    // TODO: perhaps we can find a way to create it and pass this
    // as a "defaultLoadTranslations"
    remoteTranslationLoaderParams: CreateRemoteTranslationLoaderParams;
    ttl?: number | null;
    loadTranslations?: TranslationsLoader;
    translateMany?: TranslateMany;
  }) {
    super(init);

    // Set time to live
    this.ttl = ttl === null ? -1 : (ttl ?? DEFAULT_CACHE_EXPIRY_TIME);

    // Set translate many function
    if (!translateMany) {
      throw new Error('TranslationsCache: Translate many function is not set');
    }
    this._translateMany = translateMany;

    // Set up translation loader
    // TODO: update determineTranslationLoader to accept a different parameter type
    // to make this cleaner
    const config = {
      ...remoteTranslationLoaderParams,
      loadTranslations,
    };

    // TODO: abstract this into a separate utility function
    const unsafeTranslationLoader = determineTranslationLoader(config);
    this._translationLoader = async (locale) =>
      ((await unsafeTranslationLoader(locale)) || {}) as Record<
        Hash,
        TranslationValue
      >;
  }

  /**
   * Get the translations for a given locale
   * @param key - The locale
   * @returns The translations
   */
  public get(
    key: Locale
  ): CacheEntry<TranslationValue>['localeCache'] | undefined {
    const entry = this.getCache(key);
    if (!entry || entry.expiresAt < Date.now()) {
      // TODO: should we invalidate associated promises here?
      return undefined;
    }
    return entry.localeCache;
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
    const localeCache = new LocaleTranslationsCache<TranslationValue>({
      init: await translationsPromise,
      translateMany: this._createTranslateManyFunction(locale),
    });
    const entry = { localeCache, expiresAt };
    const cacheKey = this.genKey(locale);
    this.setCache(cacheKey, entry);

    return entry;
  }

  // ===== PRIVATE METHODS ===== //

  /**
   * Creates a translate many function, used for cache misses for {@link LocaleTranslationsCache}
   * @param locale - The locale
   * @returns The translate many function
   *
   * TODO: abstract this into a separate utility function
   */
  private _createTranslateManyFunction(locale: Locale): TranslateMany {
    return async (
      sources: Parameters<TranslateMany>[0],
      timeout?: Parameters<TranslateMany>[1]
    ) => {
      // TODO: error handling
      return await this._translateMany(
        sources,
        { targetLocale: locale },
        timeout
      );
    };
  }
}
