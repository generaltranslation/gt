import { publishValidationResults } from './validation/publishValidationResults';
import logger from '../logs/logger';
import { TranslationsManager } from './translations-manager/TranslationsManager';
import { I18nManagerConfig, I18nManagerConstructorParams } from './types';
import { StorageAdapterType } from './storage-adapter/types';
import { validateConfig } from './validation/validateConfig';
import {
  Translation,
  Translations,
} from './translations-manager/utils/types/translation-data';
import { StorageAdapter } from './storage-adapter/StorageAdapter';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { GT, standardizeLocale } from 'generaltranslation';
import { CustomMapping } from 'generaltranslation/types';
import { ResolutionOptions } from '../translation-functions/types/options';
import { FallbackStorageAdapter } from './storage-adapter/FallbackStorageAdapter';
import { getGTServicesEnabled } from './utils/getGTServicesEnabled';
import { hashMessage } from '../utils/hashMessage';
import {
  SafeTranslationsLoader,
  TranslationsLoader,
} from './translations-manager/translations-loaders/types';
import { createTranslateManyFactory } from './translations-manager/utils/createTranslateMany';
import { createTranslationLoader } from './translations-manager/utils/createTranslationLoader';
import { getLoadTranslationsType } from './utils/getLoadTranslationsType';
import { TranslationsCache } from './translations-manager/utils/TranslationsCache';
import { Hash } from './translations-manager/utils/LocaleTranslationCache';

// TODO: this is a placeholder, find a precedent for this value
const DEFAULT_TRANSLATION_TIMEOUT = 8_000; // 8 seconds

/**
 * Class for managing translation functionality
 * @template StorageAdapterInstanceType - The type of the storage adapter
 * @template TranslationType - The type of the translation that will be cached
 *
 * TODO: next major version, move U to the first generic and make it a required parameter, no default value
 */
class I18nManager<
  StorageAdapterInstanceType extends StorageAdapter = StorageAdapter,
  TranslationType extends Translation = Translation,
> {
  protected config: I18nManagerConfig;

  /**
   * Cache for translations
   */
  private translationsManager: TranslationsManager<TranslationType>;

  /**
   * Store adapter
   */
  protected storeAdapter: StorageAdapterInstanceType;

  /**
   * Cache for translations
   */
  private translationsCache: TranslationsCache<TranslationType>;

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
    this.translationsManager = new TranslationsManager(params);

    // Setup translations cache
    const createTranslateMany = createTranslateManyFactory(
      this.getGTClass(),
      DEFAULT_TRANSLATION_TIMEOUT
    );
    const loadTranslations = createTranslationLoader({
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

    this.translationsCache = new TranslationsCache<TranslationType>({
      createTranslateMany,
      loadTranslations,
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
    this.storeAdapter.setItem('locale', locale);
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
    return new GT({
      sourceLocale: this.config.defaultLocale,
      targetLocale: this.getLocale(),
      locales: this.config.locales,
      customMapping: this.config.customMapping,
      projectId: this.config.projectId,
      baseUrl: this.config.runtimeUrl || undefined,
      apiKey: this.config.apiKey,
      devApiKey: this.config.devApiKey,
    });
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
   */
  getTranslationLoader(): TranslationsLoader {
    return this.translationsManager.getTranslationLoader();
  }

  // ========== Translation Resolution ========== //

  // ----- New Operations ----- //

  /**
   * Get translations
   * Loads in translations for a given locale
   *
   * This is used by gt-tanstack-start to access the translations object directly
   */
  async getTranslationsObject(
    locale: string = this.getLocale()
  ): Promise<Record<Hash, TranslationType>> {
    // Get the locale cache
    let localeCache = this.translationsCache.get(locale);
    if (!localeCache) localeCache = await this.translationsCache.miss(locale);

    // Get the translations
    const translations = localeCache.getInternalCache();
    return translations;
  }

  /**
   * Just lookup a translation
   */
  lookupTranslation<T extends TranslationType = TranslationType>(
    message: T,
    options: ResolutionOptions
  ): T | undefined {
    const locale = this.getLocale();

    // Get the locale cache
    const localeCache = this.translationsCache.get(locale);
    if (!localeCache) return undefined;

    // Get the translation
    return localeCache.get({ message, options });
  }

  /**
   * Look up a translation
   * If it's not found, use the fallback (runtime translate)
   */
  async lookupTranslationWithFallback<
    T extends TranslationType = TranslationType,
  >(message: T, options: ResolutionOptions): Promise<T | undefined> {
    const locale = options.$locale ?? this.getLocale();

    // Get the locale cache
    let localeCache = this.translationsCache.get(locale);
    if (!localeCache) localeCache = await this.translationsCache.miss(locale);

    // Get the translation (falling back to runtime translate)
    let translation = localeCache.get({ message, options });
    if (!translation)
      translation = await localeCache.miss({ message, options });
    return translation;
  }

  /**
   * Saves a current lookup translation function immune to expiry
   * Useful for operations involving lookup callbacks like useGT()
   * @param locale - The locale to get the lookup translation for
   * @param prefetchEntries - Any entries we want to prefetch during the async period
   * @returns A lookup translation function
   */
  async getLookupTranslation(
    locale: string = this.getLocale(),
    prefetchEntries: {
      message: TranslationType;
      options: ResolutionOptions;
    }[] = []
  ): Promise<TranslationResolver<TranslationType>> {
    // Early return if i18n is disabled or default locale
    if (
      this.config.enableI18n === false ||
      locale === this.config.defaultLocale
    ) {
      return (message) => message;
    }

    // Get Locale Cache
    let localeCache = this.translationsCache.get(locale);
    if (!localeCache) localeCache = await this.translationsCache.miss(locale);
    if (!localeCache) return () => undefined;

    // Prefetch any entries during async block
    await Promise.all(
      prefetchEntries
        .filter((entry) => !localeCache.get(entry))
        .map((entry) => localeCache.miss(entry))
    );

    // Create translation resolver
    return (message, options: ResolutionOptions) => {
      // Calculate hash
      return localeCache.get({ message, options });
    };
  }

  // ----- Sync Operations ----- //

  /**
   * Get the translations (error on unloaded translations)
   * @param {string} message - The message to get the translation for
   * @param {ResolutionOptions} [options] - The options for the translation
   * @returns {TranslationType | undefined} The translation for the given message and options synchronously
   */
  resolveTranslationSync: TranslationResolver<TranslationType> = <
    T extends TranslationType = TranslationType,
  >(
    message: T,
    options: ResolutionOptions
  ) => {
    const locale = this.getLocale();
    const translations = this.translationsManager.getTranslations(locale);
    if (!translations) return undefined;
    const hash = hashMessage(message, options);
    return translations[hash] as T;
  };

  // ----- Async Operations ----- //

  /**
   * Get the translations
   */
  async getTranslations(
    locale: string = this.getLocale()
  ): Promise<Translations<TranslationType>> {
    if (!this.config.locales.includes(locale)) {
      throw new Error(`Locale ${locale} not found in config`);
    }
    return this.translationsManager.getTranslationsPromise(locale);
  }

  /**
   * Get translation for a given locale and message
   *
   * @param {string} [locale] - The locale to get the translation for (if not provided, will use the current locale)
   * @returns A function that resolves the translations for a given message and options synchronously
   *
   * Note: we can assume that the translation is a string because we are passing a string
   */
  async getTranslationResolver(
    locale: string = this.getLocale()
  ): Promise<TranslationResolver<TranslationType>> {
    // Early return if i18n is disabled or default locale
    if (
      this.config.enableI18n === false ||
      locale === this.config.defaultLocale
    ) {
      return <T extends TranslationType = TranslationType>(
        message: T
      ): T | undefined => message;
    }

    // Get translations
    const translations =
      await this.translationsManager.getTranslationsPromise(locale);

    // Create translation resolver
    return <T extends TranslationType = TranslationType>(
      message: T,
      options: ResolutionOptions
    ): T | undefined => {
      // Calculate hash
      const hash = hashMessage(message, options);

      // Return translation or undefined
      return translations[hash] as T;
    };
  }

  // ========== Metadata ========== //

  /**
   * Returns true if translation is required
   * @param {string} [locale] - The user's locale
   * @returns {boolean} True if translation is required, otherwise false
   */
  requiresTranslation(locale: string = this.getLocale()): boolean {
    const defaultLocale = this.getDefaultLocale();
    const gt = this.getGTClass();
    const locales = this.getLocales();
    return (
      this.config.enableI18n &&
      gt.requiresTranslation(defaultLocale, locale, locales)
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
 * A translation resolver is a function that synchronously resolves a translation
 * @template U - The type of the translation (default: Translation)
 * @param {U} message - The message to get the translation for
 * @param {ResolutionOptions} [options] - The options for the translation
 * @returns {U | undefined} The translation for the given message and options or undefined if the translation is not found
 */
type TranslationResolver<U extends Translation = Translation> = <
  T extends U = U,
>(
  message: T,
  options: ResolutionOptions
) => T | undefined;
