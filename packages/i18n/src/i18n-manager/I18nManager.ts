import { publishValidationResults } from './validation/publishValidationResults';
import logger from '../logs/logger';
import { I18nManagerConfig, I18nManagerConstructorParams } from './types';
import { StorageAdapterType } from './storage-adapter/types';
import { validateConfig } from './validation/validateConfig';
import { Translation } from './translations-manager/utils/types/translation-data';
import { StorageAdapter } from './storage-adapter/StorageAdapter';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { GT, standardizeLocale } from 'generaltranslation';
import { CustomMapping } from 'generaltranslation/types';
import { LookupOptions } from '../translation-functions/types/options';
import { FallbackStorageAdapter } from './storage-adapter/FallbackStorageAdapter';
import { getGTServicesEnabled } from './utils/getGTServicesEnabled';
import {
  SafeTranslationsLoader,
  TranslationsLoader,
} from './translations-manager/translations-loaders/types';
import { createTranslateManyFactory } from './translations-manager/utils/createTranslateMany';
import { routeCreateTranslationLoader } from './translations-manager/translations-loaders/routeCreateTranslationLoader';
import { getLoadTranslationsType } from './utils/getLoadTranslationsType';
import { LocalesCache } from './translations-manager/LocalesCache';
import { Hash } from './translations-manager/TranslationsCache';

/**
 * Default translation timeout in milliseconds for a runtime translation request
 */
const DEFAULT_TRANSLATION_TIMEOUT = 12_000; // 12 seconds

/**
 * A translation resolver is a function that synchronously resolves a translation
 * @template U - The type of the translation (default: Translation)
 * @param {U} message - The message to get the translation for
 * @param {LookupOptions} [options] - The options for the translation
 * @returns {U | undefined} The translation for the given message and options or undefined if the translation is not found
 */
type TranslationResolver<U extends Translation = Translation> = <
  T extends U = U,
>(
  message: T,
  options: LookupOptions
) => T | undefined;

/**
 * A prefetch entry is an entry that we want to prefetch during the async period
 * @template TranslationType - The type of the translation
 * @param {TranslationType} message - The message to prefetch
 * @param {LookupOptions} options - The options for the prefetch
 * @returns {PrefetchEntry<TranslationType>} The prefetch entry
 */
type PrefetchEntry<TranslationType extends Translation> = {
  message: TranslationType;
  options: LookupOptions;
};

/**
 * Class for managing translation functionality
 * @template StorageAdapterInstanceType - The type of the storage adapter
 * @template TranslationValue - The type of the translation that will be cached
 *
 * TODO: next major version, move U to the first generic and make it a required parameter, no default value
 */
class I18nManager<
  StorageAdapterInstanceType extends StorageAdapter = StorageAdapter,
  TranslationValue extends Translation = Translation,
> {
  protected config: I18nManagerConfig;

  /**
   * Store adapter
   */
  protected storeAdapter: StorageAdapterInstanceType;

  /**
   * Cache for translations
   */
  private localesCache: LocalesCache<TranslationValue>;

  /**
   * Creates an instance of I18nManager.
   * TODO: resolve gtConfig from just file path
   * @param params - The parameters for the I18nManager constructor
   * @param params.config - The configuration for the I18nManager
   */
  constructor(
    params: I18nManagerConstructorParams<StorageAdapterInstanceType>
  ) {
    // Validation
    const validationResults = validateConfig(params);
    publishValidationResults(validationResults, 'I18nManager: ');

    // Setup
    this.config = standardizeConfig(params);
    this.storeAdapter =
      (params.storeAdapter as StorageAdapterInstanceType) ??
      new FallbackStorageAdapter();

    // Create cache miss handlers
    const loadTranslations = createTranslationLoader<TranslationValue>(params);
    const createTranslateMany = createTranslateManyFactory(
      this.getGTClassClean(),
      DEFAULT_TRANSLATION_TIMEOUT
    );

    // Setup translations cache
    this.localesCache = new LocalesCache<TranslationValue>({
      loadTranslations:
        loadTranslations as SafeTranslationsLoader<TranslationValue>,
      createTranslateMany,
    });
  }

  // ========== Getters and Setters ========== //

  /**
   * Get adapter type
   */
  getAdapterType(): StorageAdapterType {
    return this.storeAdapter.type;
  }

  /**
   * Get the locale
   */
  getLocale(): string {
    const locale = this.storeAdapter.getItem('locale');
    if (!locale) {
      logger.warn(
        'getLocale() invoked outside of translation context, falling back to default locale'
      );
      return this.config.defaultLocale;
    }
    return locale;
  }

  /**
   * Set the locale
   */
  setLocale(locale: string): void {
    this.validateLocale(locale);
    const gtInstance = this.getGTClass();
    this.storeAdapter.setItem('locale', gtInstance.determineLocale(locale)!);
  }

  /**
   * Get the default locale
   */
  getDefaultLocale(): string {
    return this.config.defaultLocale;
  }

  /**
   * Get the locales
   */
  getLocales(): string[] {
    return this.config.locales;
  }

  /**
   * Get the version ID
   */
  getVersionId(): string | undefined {
    return this.config._versionId;
  }

  /**
   * Get a gt class instance
   * TODO: keep a cache to avoid creating new instances unnecessarily
   */
  getGTClass(): GT {
    return this.getGTClassClean(this.getLocale());
  }

  /**
   * Is translation enabled?
   */
  isTranslationEnabled(): boolean {
    return this.config.enableI18n;
  }

  // ========== Translation Loading ========== //

  /**
   * Get the translation loader function
   * @deprecated wrap a cb around loadTranslations instead
   */
  getTranslationLoader(): TranslationsLoader {
    return (locale: string) => this.loadTranslations(locale);
  }

  // ========== Translation Resolution ========== //

  // ----- New Operations ----- //

  /**
   * Loads in translations for a given locale
   * Edge case usage: access the translations object directly
   */
  async loadTranslations(
    locale: string = this.getLocale()
  ): Promise<Record<Hash, TranslationValue>> {
    try {
      // Validate
      this.validateLocale(locale);
      if (!this.requiresTranslation(locale)) {
        return {};
      }

      // Get the locale cache
      let txCache = this.localesCache.get(locale);
      if (!txCache) txCache = await this.localesCache.miss(locale);

      // Get the translations
      const translations = txCache.getInternalCache();
      return translations;
    } catch (error) {
      this.handleError(error);
      return {};
    }
  }

  /**
   * Just lookup a translation
   */
  lookupTranslation<T extends TranslationValue = TranslationValue>(
    message: T,
    options: LookupOptions
  ): T | undefined {
    try {
      // Validate
      const locale = options.$locale ?? this.getLocale();
      this.validateLocale(locale);

      // Early return if in default locale
      if (!this.requiresTranslation(locale)) {
        return message;
      }

      // Get the locale cache
      const txCache = this.localesCache.get(locale);
      if (!txCache) return undefined;

      // Get the translation
      return txCache.get({ message, options });
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
  }

  /**
   * Look up a translation
   * If it's not found, use the fallback (runtime translate)
   */
  async lookupTranslationWithFallback<
    T extends TranslationValue = TranslationValue,
  >(message: T, options: LookupOptions): Promise<T | undefined> {
    try {
      // Validate
      const locale = options.$locale ?? this.getLocale();
      this.validateLocale(locale);

      // Early return if in default locale
      if (!this.requiresTranslation(locale)) {
        return message;
      }

      // Get the locale cache
      let txCache = this.localesCache.get(locale);
      if (!txCache) txCache = await this.localesCache.miss(locale);

      // Get the translation (falling back to runtime translate)
      let translation = txCache.get({ message, options });
      if (!translation) translation = await txCache.miss({ message, options });
      return translation;
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
  }

  /**
   * Saves a current lookup translation function immune to expiry
   * Useful for operations involving lookup callbacks like useGT()
   * @param locale - The locale to get the lookup translation for
   * @param prefetchEntries - Any entries we want to prefetch during the async period
   * @returns A lookup translation function
   *
   * @important prefetchEntries must all be the same locale
   */
  async getLookupTranslation(
    locale: string = this.getLocale(),
    prefetchEntries: {
      message: TranslationValue;
      options: LookupOptions;
    }[] = []
  ): Promise<TranslationResolver<TranslationValue>> {
    try {
      // Validate
      this.validateLocale(locale);

      // Early return if i18n is disabled or default locale
      if (!this.requiresTranslation(locale)) {
        return (message) => message;
      }

      // Invariant: all prefetchEntries must be the same locale
      const filteredPrefetchEntries = filterPrefetchEntriesByLocale(
        prefetchEntries,
        locale
      );
      if (filteredPrefetchEntries.length !== prefetchEntries.length) {
        console.warn(
          `I18nManager: getLookupTranslation(): prefetchEntries must all be the same locale, ignoring all entries that are not for ${locale}`
        );
      }

      // Get Locale Cache
      let txCache = this.localesCache.get(locale);
      if (!txCache) txCache = await this.localesCache.miss(locale);
      if (!txCache) return () => undefined;

      // Prefetch any entries during async block
      await Promise.all(
        filteredPrefetchEntries
          .filter((entry) => !txCache.get(entry))
          .map((entry) => txCache.miss(entry))
      );

      // Create translation resolver
      return (message, options: LookupOptions) => {
        // Calculate hash
        return txCache.get({ message, options });
      };
    } catch (error) {
      this.handleError(error);
      return (message) => message;
    }
  }

  // ----- Sync Operations ----- //

  /**
   * Get the translations (error on unloaded translations)
   * @param {string} message - The message to get the translation for
   * @param {LookupOptions} [options] - The options for the translation
   * @returns {TranslationValue | undefined} The translation for the given message and options synchronously
   * @deprecated use lookupTranslation instead
   */
  resolveTranslationSync: TranslationResolver<TranslationValue> = <
    T extends TranslationValue = TranslationValue,
  >(
    message: T,
    options: LookupOptions
  ) => {
    return this.lookupTranslation(message, options);
  };

  // ----- Async Operations ----- //

  /**
   * Get the translations
   * @deprecated use loadTranslations instead
   */
  async getTranslations(
    locale: string = this.getLocale()
  ): Promise<Record<Hash, TranslationValue>> {
    // Validate
    this.validateLocale(locale);
    return this.loadTranslations(locale);
  }

  /**
   * Get translation for a given locale and message
   *
   * @param {string} [locale] - The locale to get the translation for (if not provided, will use the current locale)
   * @returns A function that resolves the translations for a given message and options synchronously
   *
   * Note: we can assume that the translation is a string because we are passing a string
   *
   * @deprecated use getLookupTranslation instead
   */
  async getTranslationResolver(
    locale: string = this.getLocale()
  ): Promise<TranslationResolver<TranslationValue>> {
    return this.getLookupTranslation(locale);
  }

  // ========== Metadata ========== //

  /**
   * Returns true if translation is required
   * @param {string} [locale] - The user's locale
   * @returns {boolean} True if translation is required, otherwise false
   */
  requiresTranslation(locale: string = this.getLocale()): boolean {
    const defaultLocale = this.getDefaultLocale();
    const gtInstance = this.getGTClass();
    const locales = this.getLocales();
    return (
      this.isTranslationEnabled() &&
      gtInstance.requiresTranslation(defaultLocale, locale, locales)
    );
  }

  /**
   * Returns true if dialect translation is required
   * @param {string} [locale] - The user's locale
   * @returns {boolean} True if dialect translation is required, otherwise false
   */
  requiresDialectTranslation(locale: string = this.getLocale()): boolean {
    const defaultLocale = this.getDefaultLocale();
    const gt = this.getGTClass();
    return (
      this.requiresTranslation(locale) &&
      gt.isSameLanguage(defaultLocale, locale)
    );
  }

  /**
   * Handle errors
   * Soft error in production, throw in development
   */
  private handleError(error: unknown): void {
    switch (this.config.environment) {
      case 'development':
        throw error;
      case 'production':
      default:
        logger.error('I18nManager' + error);
        break;
    }
  }

  /**
   * Validate locale
   */
  protected validateLocale(locale: string): void {
    const gtInstance = this.getGTClass();
    if (
      !gtInstance.isValidLocale(locale) ||
      !gtInstance.determineLocale(locale)
    ) {
      throw new Error(
        `I18nManager: validateLocale(): locale ${locale} is not valid`
      );
    }
  }

  /**
   * A helper function to create a gt class that is locale agnostic
   * This is helpful for when our getLocale function is bound to a
   * specifica context
   */
  private getGTClassClean(locale?: string): GT {
    return new GT({
      sourceLocale: this.config.defaultLocale,
      targetLocale: locale,
      locales: this.config.locales,
      customMapping: this.config.customMapping,
      projectId: this.config.projectId,
      baseUrl: this.config.runtimeUrl || undefined,
      apiKey: this.config.apiKey,
      devApiKey: this.config.devApiKey,
    });
  }
}

export { I18nManager };

// ===== Helper Functions ===== //

/**
 * Standardize the config
 * @param config - The config to standardize
 * @returns The standardized config
 */
function standardizeConfig<T extends StorageAdapter>(
  config: I18nManagerConstructorParams<T>
): I18nManagerConfig {
  const gtServicesEnabled = getGTServicesEnabled(config);

  const dedupedLocales = dedupeLocales({
    defaultLocale: config.defaultLocale || libraryDefaultLocale,
    locales: config.locales || [libraryDefaultLocale],
    customMapping: config.customMapping,
  });

  return {
    environment: config.environment || 'production',
    enableI18n: config.enableI18n !== undefined ? config.enableI18n : true,
    projectId: config.projectId,
    devApiKey: config.devApiKey,
    apiKey: config.apiKey,
    runtimeUrl: config.runtimeUrl,
    _versionId: config._versionId,
    ...(gtServicesEnabled
      ? standardizeLocales(dedupedLocales)
      : dedupedLocales),
  };
}

/**
 * Dedupe locales and add defaultLocale
 */
function dedupeLocales({
  defaultLocale,
  locales,
  customMapping,
}: {
  defaultLocale: string;
  locales: string[];
  customMapping?: CustomMapping;
}): {
  defaultLocale: string;
  locales: string[];
  customMapping: CustomMapping;
} {
  return {
    defaultLocale,
    locales: Array.from(new Set([defaultLocale, ...locales])),
    customMapping: customMapping || {},
  };
}

/**
 * Standardize all locales in config
 * Only apply if using GT services
 */
function standardizeLocales(config: {
  defaultLocale: string;
  locales: string[];
  customMapping: CustomMapping;
}): {
  defaultLocale: string;
  locales: string[];
  customMapping: CustomMapping;
} {
  // Sanitize defaultLocale and locales
  const defaultLocale = standardizeLocale(config.defaultLocale);
  const locales = config.locales.map((locale) => {
    const mappedLocale =
      typeof config.customMapping?.[locale] === 'string'
        ? config.customMapping?.[locale]
        : config.customMapping?.[locale]?.code;
    if (mappedLocale) {
      return locale;
    } else {
      return standardizeLocale(locale);
    }
  });

  // Sanitize customMapping
  const customMapping = Object.fromEntries(
    Object.entries(config.customMapping || {}).map(([key, value]) => [
      key,
      typeof value === 'string'
        ? standardizeLocale(value)
        : {
            ...value,
            ...(value.code ? { code: standardizeLocale(value.code) } : {}),
          },
    ])
  );

  return {
    defaultLocale,
    locales,
    customMapping,
  };
}

/**
 * Filter prefetch entries by locale
 * @template TranslationType - The type of the translation
 * @param {PrefetchEntry<TranslationType>[]} prefetchEntries - The prefetch entries to filter
 * @param {string} locale - The locale to filter by
 * @returns {PrefetchEntry<TranslationType>[]} The filtered prefetch entries
 */
function filterPrefetchEntriesByLocale<TranslationType extends Translation>(
  prefetchEntries: PrefetchEntry<TranslationType>[],
  locale: string
): PrefetchEntry<TranslationType>[] {
  const filteredEntries = prefetchEntries.filter(
    (entry) => entry.options.$locale == null || entry.options.$locale === locale
  );
  return filteredEntries;
}

/**
 * Helper function for creating a translation loader
 */
function createTranslationLoader<
  TranslationType extends Translation,
  StorageAdapterInstanceType extends StorageAdapter = StorageAdapter,
>(
  params: I18nManagerConstructorParams<StorageAdapterInstanceType>
): SafeTranslationsLoader<TranslationType> {
  return routeCreateTranslationLoader({
    loadTranslations: params.loadTranslations,
    type: getLoadTranslationsType(params),
    remoteTranslationLoaderParams: {
      cacheUrl: params.cacheUrl,
      projectId: params.projectId,
      _versionId: params._versionId,
      _branchId: params._branchId,
      customMapping: params.customMapping,
    },
  }) as SafeTranslationsLoader<TranslationType>;
}
