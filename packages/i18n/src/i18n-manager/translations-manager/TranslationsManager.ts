import { DEFAULT_CACHE_EXPIRY_TIME } from './utils/constants';
import logger from '../../logs/logger';
import {
  SafeTranslationsLoader,
  TranslationsLoader,
} from './translations-loaders/types';
import { Translations, TranslationsMap } from './utils/types/translation-data';
import { TranslationsManagerConstructorParams } from './utils/types/translations-manager';
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
   * Cache expiry time
   */
  private cacheExpiryTime: number;

  /**
   * Translation loader function
   */
  private translationLoader: SafeTranslationsLoader;

  /**
   * Cache of translations
   */
  private cache: TranslationsMap = new Map();

  /**
   * Constructor
   * @param {TranslationsManagerConstructorParams} config - The configuration for the TranslationsManager
   * TODO: add expiration time on the translation loader
   */
  constructor(config: TranslationsManagerConstructorParams) {
    this.cacheExpiryTime = config.cacheExpiryTime ?? DEFAULT_CACHE_EXPIRY_TIME;

    // Set up translation loader
    const unsafeTranslationLoader = determineTranslationLoader(config);
    this.translationLoader = this.protectTranslationLoader(
      unsafeTranslationLoader
    );
  }

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
        const translations = await unsafeTranslationLoader(locale);
        return (translations || {}) as Translations;
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
   * @param locale Handle cache miss for the locale
   */
  private async handleCacheMiss(locale: string): Promise<Translations> {
    // Fetch translations
    const promise = this.translationLoader(locale);

    // Get cache expiry time
    const expiresAt =
      this.cacheExpiryTime === -1 ? -1 : Date.now() + this.cacheExpiryTime;

    // Cache the promise and expiry timestamp
    const entry = { promise, expiresAt };
    this.cache.set(locale, entry);

    return promise;
  }

  /**
   * Determines whether cache hit or miss based on:
   * - Cache entry exists
   * - Time-stamp (never expires if -1)
   */
  private isCacheHit(locale: string): boolean {
    if (!this.cache.has(locale)) return false;

    const { expiresAt } = this.cache.get(locale)!;
    if (expiresAt === -1 || expiresAt > Date.now()) return true;
    return false;
  }

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
  customTranslationLoader?: TranslationsLoader;
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
      return config.customTranslationLoader!;
    case LoadTranslationsType.DISABLED:
      return createFallbackTranslationLoader();
  }
}
