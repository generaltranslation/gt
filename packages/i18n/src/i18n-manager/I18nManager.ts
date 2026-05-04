import { publishValidationResults } from './validation/publishValidationResults';
import logger from '../logs/logger';
import { I18nManagerConfig, I18nManagerConstructorParams } from './types';
import { validateConfig } from './validation/validateConfig';
import { Translation } from './translations-manager/utils/types/translation-data';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { GT } from 'generaltranslation';
import { LocaleConfig, standardizeLocale } from 'generaltranslation/core';
import type { CustomMapping } from 'generaltranslation/types';
import { LookupOptions } from '../translation-functions/types/options';
import { getGTServicesEnabled } from './utils/getGTServicesEnabled';
import {
  SafeTranslationsLoader,
  TranslationsLoader,
} from './translations-manager/translations-loaders/types';
import { createTranslateManyFactory } from './translations-manager/utils/createTranslateMany';
import { routeCreateTranslationLoader } from './translations-manager/translations-loaders/routeCreateTranslationLoader';
import { getLoadTranslationsType } from './utils/getLoadTranslationsType';
import { Locale, LocalesCache } from './translations-manager/LocalesCache';
import { Hash } from './translations-manager/TranslationsCache';
import { createLifecycleCallbacks } from './lifecycle-hooks/createLifecycleCallbacks';
import { EventEmitter } from './event-subscription/EventEmitter';
import { subscribeLifecycleCallbacks } from './lifecycle-hooks/subscribeLifecycleCallbacks';
import { I18nEvents } from './event-subscription/types';

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
  options?: LookupOptions
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
 * @template TranslationValue - The type of the translation that will be cached
 */
class I18nManager<
  TranslationValue extends Translation = Translation,
> extends EventEmitter<I18nEvents<TranslationValue>> {
  protected config: I18nManagerConfig;

  /**
   * Cache for translations
   */
  private localesCache: LocalesCache<TranslationValue>;

  /**
   * Runtime-safe locale and formatting helpers
   */
  private localeConfig: LocaleConfig;

  /**
   * Creates an instance of I18nManager.
   * TODO: resolve gtConfig from just file path
   * @param params - The parameters for the I18nManager constructor
   * @param params.config - The configuration for the I18nManager
   */
  constructor(params: I18nManagerConstructorParams<TranslationValue>) {
    super();

    // Validation
    const validationResults = validateConfig(params);
    publishValidationResults(validationResults, 'I18nManager: ');

    // Setup
    this.config = standardizeConfig(params);
    this.localeConfig = new LocaleConfig({
      defaultLocale: this.config.defaultLocale,
      locales: this.config.locales,
      customMapping: this.config.customMapping,
    });
    // Create cache miss handlers
    const loadTranslations = createTranslationLoader<TranslationValue>(params);
    const runtimeTranslationTimeout =
      this.config.runtimeTranslation?.timeout ?? DEFAULT_TRANSLATION_TIMEOUT;
    const runtimeTranslationMetadata =
      this.config.runtimeTranslation?.metadata ?? {};
    const createTranslateMany = createTranslateManyFactory(
      this.getGTClassClean(),
      runtimeTranslationTimeout,
      runtimeTranslationMetadata
    );

    // Subscribe lifecycle callbacks
    subscribeLifecycleCallbacks(params.lifecycle ?? {}, (...args) =>
      this.subscribe(...args)
    );

    // Setup translations cache
    this.localesCache = new LocalesCache<TranslationValue>({
      loadTranslations,
      createTranslateMany,
      ttl: this.config.cacheExpiryTime,
      batchConfig: this.config.batchConfig,
      lifecycle: createLifecycleCallbacks((...args) => this.emit(...args)),
    });
  }

  // ========== Subscribers and Emitters ========== //

  /**
   * Subscribes to a change in a translation entry (eg a runtime translation)
   * @param listener - The subscriber function
   * @param locale - The locale of the translation entry
   * @param hash - The hash of the translation entry
   * @returns An unsubscribe function
   *
   * Pair this with {@link lookupTranslation} to get the translation entry
   */
  subscribeToTranslationsCacheMiss(
    listener: (
      event: I18nEvents<TranslationValue>['translations-cache-miss']
    ) => void,
    locale: Locale,
    hash: Hash
  ) {
    return this.subscribe('translations-cache-miss', (event) => {
      if (event.locale !== locale || event.hash !== hash) {
        return;
      }
      listener(event);
    });
  }

  // ========== Getters and Setters ========== //

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
   * Get the custom locale mapping
   */
  getCustomMapping(): CustomMapping {
    return this.config.customMapping;
  }

  /**
   * Get the version ID
   */
  getVersionId(): string | undefined {
    return this.config._versionId;
  }

  /**
   * Get a gt class instance
   * @param locale - The locale to bind to the GT instance. When omitted, the GT instance is locale agnostic.
   * TODO: keep a cache to avoid creating new instances unnecessarily
   */
  getGTClass(locale?: string): GT {
    return this.getGTClassClean(
      locale ? this.resolveLocale(locale) : undefined
    );
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
    locale: string
  ): Promise<Record<Hash, TranslationValue>> {
    try {
      // Validate
      const translationLocale = this.resolveTranslationCacheLocale(locale);
      if (!translationLocale) {
        return {};
      }

      // Get the locale cache
      let txCache = this.localesCache.get(translationLocale);
      if (!txCache) txCache = await this.localesCache.miss(translationLocale);

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
    locale: string,
    message: T,
    options: LookupOptions
  ): T | undefined {
    try {
      // Validate
      const { translationLocale, options: lookupOptions } =
        this.resolveLookupParams(locale, options);

      // Early return if in default locale
      if (!translationLocale) {
        return message;
      }

      // Get the locale cache
      const txCache = this.localesCache.get(translationLocale);
      if (!txCache) return undefined;

      // Get the translation
      return txCache.get({ message, options: lookupOptions });
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
  >(
    locale: string,
    message: T,
    options: LookupOptions
  ): Promise<T | undefined> {
    try {
      // Validate
      const { translationLocale, options: lookupOptions } =
        this.resolveLookupParams(locale, options);

      // Early return if in default locale
      if (!translationLocale) {
        return message;
      }

      // Get the locale cache
      let txCache = this.localesCache.get(translationLocale);
      if (!txCache) txCache = await this.localesCache.miss(translationLocale);

      // Get the translation (falling back to runtime translate)
      let translation = txCache.get({ message, options: lookupOptions });
      if (translation == null)
        translation = await txCache.miss({ message, options: lookupOptions });
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
    locale: string,
    prefetchEntries: {
      message: TranslationValue;
      options: LookupOptions;
    }[] = []
  ): Promise<TranslationResolver<TranslationValue>> {
    try {
      // Validate
      const translationLocale = this.resolveTranslationCacheLocale(locale);

      // Early return if i18n is disabled or default locale
      if (!translationLocale) {
        return (message) => message;
      }

      // Invariant: all prefetchEntries must be the same locale
      const resolvedPrefetchEntries = resolvePrefetchEntriesByLocale(
        prefetchEntries,
        translationLocale,
        (entryLocale) =>
          this.resolveTranslationCacheLocale(entryLocale) ??
          this.resolveLocale(entryLocale)
      );
      if (resolvedPrefetchEntries.length !== prefetchEntries.length) {
        logger.warn(
          `I18nManager: getLookupTranslation(): prefetchEntries must all be the same locale, ignoring all entries that are not for ${translationLocale}`
        );
      }

      // Get Locale Cache
      let txCache = this.localesCache.get(translationLocale);
      if (!txCache) txCache = await this.localesCache.miss(translationLocale);
      if (!txCache) return () => undefined;

      // Prefetch any entries during async block
      await Promise.all(
        resolvedPrefetchEntries
          .filter((entry) => txCache.get(entry) == null)
          .map((entry) => txCache.miss(entry))
      );

      // Create translation resolver
      return (message, options: LookupOptions = {} as LookupOptions) => {
        // Calculate hash
        return txCache.get({
          message,
          options: this.resolveLookupOptions(options),
        });
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
  resolveTranslationSync = <T extends TranslationValue = TranslationValue>(
    locale: string,
    message: T,
    options: LookupOptions
  ) => {
    return this.lookupTranslation(locale, message, options);
  };

  // ----- Async Operations ----- //

  /**
   * Get the translations
   * @deprecated use loadTranslations instead
   */
  async getTranslations(
    locale: string
  ): Promise<Record<Hash, TranslationValue>> {
    try {
      return this.loadTranslations(locale);
    } catch (error) {
      this.handleError(error);
      return {};
    }
  }

  /**
   * Get translation for a given locale and message
   *
   * @param {string} locale - The locale to get the translation for
   * @returns A function that resolves the translations for a given message and options synchronously
   *
   * Note: we can assume that the translation is a string because we are passing a string
   *
   * @deprecated use getLookupTranslation instead
   */
  async getTranslationResolver(
    locale: string
  ): Promise<TranslationResolver<TranslationValue>> {
    return this.getLookupTranslation(locale);
  }

  // ========== Metadata ========== //

  /**
   * Returns true if translation is required
   * @param {string} locale - The user's locale
   * @returns {boolean} True if translation is required, otherwise false
   */
  requiresTranslation(locale: string): boolean {
    const defaultLocale = this.getDefaultLocale();
    const locales = this.getLocales();
    return (
      this.isTranslationEnabled() &&
      this.localeConfig.requiresTranslation(locale, defaultLocale, locales)
    );
  }

  /**
   * Returns true if dialect translation is required
   * @param {string} locale - The user's locale
   * @returns {boolean} True if dialect translation is required, otherwise false
   */
  requiresDialectTranslation(locale: string): boolean {
    const defaultLocale = this.getDefaultLocale();
    return (
      this.requiresTranslation(locale) &&
      this.localeConfig.isSameLanguage(defaultLocale, locale)
    );
  }

  /**
   * Handle errors
   * Soft error in production, throw in development
   */
  private handleError(error: unknown) {
    switch (this.config.environment) {
      case 'development':
        throw error;
      case 'production':
      default:
        logger.error('I18nManager: ' + error);
        break;
    }
  }

  private resolveLocale(locale: string) {
    const resolvedLocale = this.localeConfig.determineLocale(locale);
    if (!this.localeConfig.isValidLocale(locale) || !resolvedLocale) {
      throw new Error(
        `I18nManager: validateLocale(): locale ${locale} is not valid`
      );
    }
    return resolvedLocale;
  }

  /**
   * Resolve the locale key used to load/read translation caches.
   * Returns undefined when the requested locale can use source content.
   */
  private resolveTranslationCacheLocale(locale: string) {
    const resolvedLocale = this.resolveLocale(locale);
    if (this.requiresTranslation(resolvedLocale)) {
      return resolvedLocale;
    }

    const aliasLocale = this.localeConfig.resolveAliasLocale(
      standardizeLocale(locale)
    );
    if (this.requiresTranslation(aliasLocale)) {
      return aliasLocale;
    }

    return undefined;
  }

  private resolveLookupParams(locale: string, options: LookupOptions) {
    const translationLocale = this.resolveTranslationCacheLocale(locale);
    return {
      translationLocale,
      options: translationLocale
        ? this.resolveLookupOptions(options, translationLocale)
        : options,
    };
  }

  private resolveLookupOptions(
    options: LookupOptions = {} as LookupOptions,
    translationLocale?: string
  ) {
    if (!options.$locale) {
      return options;
    }
    return {
      ...options,
      $locale:
        translationLocale ??
        this.resolveTranslationCacheLocale(options.$locale) ??
        this.resolveLocale(options.$locale),
    };
  }

  /**
   * A helper function to create a gt class that is locale agnostic
   * This is helpful for when our getLocale function is bound to a
   * specific context
   */
  private getGTClassClean(locale?: string) {
    return new GT({
      sourceLocale: this.config.defaultLocale,
      targetLocale: locale,
      // GT validates approved locales before constructing its LocaleConfig, so
      // pass canonical locales here while preserving alias target locales.
      locales: Array.from(
        new Set(
          this.config.locales.map((locale) =>
            this.localeConfig.resolveCanonicalLocale(locale)
          )
        )
      ),
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
function standardizeConfig<TranslationValue extends Translation>(
  config: I18nManagerConstructorParams<TranslationValue>
) {
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
    cacheExpiryTime: config.cacheExpiryTime,
    batchConfig: config.batchConfig,
    runtimeTranslation: config.runtimeTranslation,
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
}) {
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
}) {
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
 * Resolve prefetch entry locales and keep entries matching the active locale.
 * @template TranslationType - The type of the translation
 * @param {PrefetchEntry<TranslationType>[]} prefetchEntries - The prefetch entries to filter
 * @param {string} locale - The locale to filter by
 * @returns {PrefetchEntry<TranslationType>[]} The filtered prefetch entries
 */
function resolvePrefetchEntriesByLocale<TranslationType extends Translation>(
  prefetchEntries: PrefetchEntry<TranslationType>[],
  locale: string,
  resolveLocale: (locale: string) => string
) {
  return prefetchEntries.flatMap((entry) => {
    const entryLocale = entry.options.$locale;
    if (entryLocale == null) return [entry];

    try {
      const resolvedLocale = resolveLocale(entryLocale);
      if (resolvedLocale !== locale) return [];
      return [
        {
          message: entry.message,
          options: {
            ...entry.options,
            $locale: resolvedLocale,
          },
        },
      ];
    } catch {
      return [];
    }
  });
}

/**
 * Helper function for creating a translation loader
 */
function createTranslationLoader<TranslationType extends Translation>(
  params: I18nManagerConstructorParams<TranslationType>
) {
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
