import { DEFAULT_CACHE_EXPIRY_TIME } from './utils/constants';
import logger from '../../logs/logger';
import {
  SafeTranslationsLoader,
  TranslationsLoader,
} from './translations-loaders/types';
import {
  ResolvedTranslationsMap,
  Translations,
  TranslationsMap,
} from './utils/types/translation-data';
import { TranslationsManagerConfig } from './utils/types/translations-manager';
import { createRemoteTranslationLoader } from './translations-loaders/createRemoteTranslationLoader';
import { createFallbackTranslationLoader } from './translations-loaders/createFallbackTranslationLoader';
import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from '../utils/getLoadTranslationsType';
import { CustomMapping } from 'generaltranslation/types';

/**
 * TranslationsManager is responsible for loading and caching translations
 */
class TranslationsManager {
  /**
   * Translation loader function
   */
  private translationLoader: SafeTranslationsLoader;

  /**
   * Cache of translations
   */
  private cache: TranslationsMap = new Map();

  /**
   * Cache entry time to live (negative value means never expires)
   */
  private translationEntryTTL: number;

  /**
   * Resolved cache for sync operations
   */
  private resolvedCache: ResolvedTranslationsMap = new Map();

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
  ): SafeTranslationsLoader {
    return async (locale: string): Promise<Translations> => {
      try {
        const translations = ((await unsafeTranslationLoader(locale)) ||
          {}) as Translations;
        return translations;
      } catch (error) {
        // TODO: centralized logging system
        logger.error('Failed to load translations ' + error);
        // Delete failed promise entry from cache to avoid persisting failed promises
        this.cache.delete(locale);
        return {} as Translations;
      }
    };
  }

  /**
   * Wrap translation loader to record items to resolved cache for sync operations
   */
  private attachResolveCaptureToTranslationLoader(
    translationLoader: SafeTranslationsLoader
  ): SafeTranslationsLoader {
    return async (locale: string): Promise<Translations> => {
      const translations = await translationLoader(locale);
      this.resolvedCache.set(locale, translations);
      return translations;
    };
  }

  /**
   * Handle cache miss for the locale
   * @param locale Handle cache miss for the locale
   */
  private async handleCacheMiss(locale: string): Promise<Translations> {
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
  async getTranslations(locale: string): Promise<Translations> {
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
  getTranslationsSync(locale: string): Translations | undefined {
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

// ===== HELPER FUNCTIONS ===== //

/**
 * determine the correct translation loader to use
 */
function determineTranslationLoader(config: {
  projectId?: string;
  cacheUrl?: string | null;
  _versionId?: string;
  _branchId?: string;
  loadTranslations?: TranslationsLoader;
  customMapping?: CustomMapping;
}): TranslationsLoader {
  const loadTranslationsType = getLoadTranslationsType(config);
  if (loadTranslationsType === LoadTranslationsType.DISABLED) {
    // TODO: move this warning to validation layer
    logger.warn('No translation loader found. No translations will be loaded.');
  }

  switch (loadTranslationsType) {
    case LoadTranslationsType.REMOTE:
    case LoadTranslationsType.GT_REMOTE:
      return createRemoteTranslationLoader({
        cacheUrl: config.cacheUrl!,
        projectId: config.projectId!,
        _versionId: config._versionId,
        _branchId: config._branchId,
        customMapping: config.customMapping,
      });
    case LoadTranslationsType.CUSTOM:
      return config.loadTranslations!;
    case LoadTranslationsType.DISABLED:
      return createFallbackTranslationLoader();
  }
}
