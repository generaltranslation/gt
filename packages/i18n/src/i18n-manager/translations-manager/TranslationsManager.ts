import { DEFAULT_CACHE_EXPIRY_TIME } from './utils/constants';
import logger from '../../logs/logger';
import {
  SafeTranslationsLoader,
  TranslationsLoader,
} from './translations-loaders/types';
import {
  ResolvedTranslationsMap,
  Translation,
  Translations,
  TranslationsMap,
} from './utils/types/translation-data';
import { TranslationsManagerConfig } from './utils/types/translations-manager';
import { determineTranslationLoader } from './utils/determineTranslationLoader';

/**
 * TranslationsManager is responsible for loading and caching translations
 */
class TranslationsManager<T extends Translation> {
  /**
   * Translation loader function
   */
  private translationLoader: SafeTranslationsLoader<T>;

  /**
   * Cache of translations
   */
  private cache: TranslationsMap<T> = new Map();

  /**
   * Cache entry time to live (negative value means never expires)
   */
  private translationEntryTTL: number;

  /**
   * Resolved cache for sync operations
   */
  private resolvedCache: ResolvedTranslationsMap<T> = new Map();

  /**
   * Constructor
   * @param {TranslationsManagerConfig} config - The configuration for the TranslationsManager
   */
  constructor(config: TranslationsManagerConfig) {
    this.translationEntryTTL =
      config.cacheExpiryTime === null
        ? -1
        : (config.cacheExpiryTime ?? DEFAULT_CACHE_EXPIRY_TIME);

    // Set up translation loader
    const unsafeTranslationLoader = determineTranslationLoader(config);
    this.translationLoader = this.attachResolveCaptureToTranslationLoader(
      this.protectTranslationLoader(unsafeTranslationLoader)
    );
  }

  // ========== Private Methods ========== //

  // ----- Translation Loader Wrappers ----- //

  /**
   * Wrap the translation loader to handle errors
   *
   * We will assume that they at least return a mapping of strings to {@link Translation}
   * Validating the response is slow and should be the responsibility of the callee
   */
  private protectTranslationLoader(
    unsafeTranslationLoader: TranslationsLoader
  ): SafeTranslationsLoader<T> {
    return async (locale: string): Promise<Translations<T>> => {
      try {
        const translations = ((await unsafeTranslationLoader(locale)) ||
          {}) as Translations<T>;
        return translations;
      } catch (error) {
        // TODO: centralized logging system
        logger.error('Failed to load translations ' + error);
        // Delete failed promise entry from cache to avoid persisting failed promises
        this.cache.delete(locale);
        return {} as Translations<T>;
      }
    };
  }

  /**
   * Wrap translation loader to record items to resolved cache for sync operations
   */
  private attachResolveCaptureToTranslationLoader(
    translationLoader: SafeTranslationsLoader<T>
  ): SafeTranslationsLoader<T> {
    return async (locale: string): Promise<Translations<T>> => {
      const translations = await translationLoader(locale);
      this.resolvedCache.set(locale, translations);
      return translations;
    };
  }

  /**
   * Handle cache miss for the locale
   * @param locale Handle cache miss for the locale
   */
  private async handleCacheMiss(locale: string): Promise<Translations<T>> {
    // Fetch translations
    const promise = this.translationLoader(locale);

    // Get cache expiry time
    const expiresAt =
      this.translationEntryTTL < 0
        ? this.translationEntryTTL
        : Date.now() + this.translationEntryTTL;

    // Cache the promise and expiry timestamp
    const entry = { promise, expiresAt };
    this.cache.set(locale, entry);

    return promise;
  }

  // ----- Utilities ----- //

  /**
   * Determines whether cache hit or miss based on:
   * - Cache entry exists
   * - Time-stamp (never expires if negative)
   */
  private isCacheHit(locale: string): boolean {
    if (!this.cache.has(locale)) return false;

    const { expiresAt } = this.cache.get(locale)!;
    if (expiresAt < 0 || expiresAt > Date.now()) return true;
    return false;
  }

  // ========== Public Methods ========== //

  /**
   * Get translations for a given locale
   */
  async getTranslations(locale: string): Promise<Translations<T>> {
    // Cache hit
    if (this.isCacheHit(locale)) {
      return this.cache.get(locale)!.promise;
    }

    // Cache miss
    return this.handleCacheMiss(locale);
  }

  /**
   * Get translations for a given locale
   * @note This method does not account for cache expiry
   */
  getTranslationsSync(locale: string): Translations<T> | undefined {
    return this.resolvedCache.get(locale);
  }

  // ----- Utilities ----- //

  /**
   * Get the translation loader function
   */
  getTranslationLoader(): TranslationsLoader {
    return this.translationLoader;
  }
}

export { TranslationsManager };
