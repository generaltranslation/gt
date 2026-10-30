import logger from '../logs/logger';
import { I18nCacheConfig, I18nCacheConstructorParams } from './types';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { defaultRuntimeApiUrl } from 'generaltranslation/internal';
import { Translation } from './translations-manager/utils/types/translation-data';
import { LookupOptions } from '../translation-functions/types/options';
import { SafeTranslationsLoader } from './translations-manager/translations-loaders/types';
import {
  createTranslateManyFactory,
  type CreateTranslateMany,
} from './translations-manager/utils/createTranslateMany';
import { routeCreateTranslationLoader } from './translations-manager/translations-loaders/routeCreateTranslationLoader';
import { getLoadTranslationsType } from './utils/getLoadTranslationsType';
import { ResourceCache } from './translations-manager/ResourceCache';
import { TranslationsCache } from './translations-manager/TranslationsCache';
import type { Hash, Locale } from './translations-manager/TranslationsCache';
import { handleCacheError } from './utils/handleCacheError';
import { getI18nConfig } from '../i18n-config/singleton-operations';

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
 * Callback function to prefetch entries during the async period
 */
type PrefetchEntriesType<TranslationType extends Translation> = (
  prefetchEntries: PrefetchEntry<TranslationType>[]
) => Promise<void>;

/**
 * Event fired when a runtime translation resolves a cache miss
 */
export type TranslationsCacheMissEvent<
  TranslationValue extends Translation = Translation,
> = {
  locale: Locale;
  hash: Hash;
  translation: TranslationValue;
};

/**
 * Class for managing translation functionality
 * @template TranslationValue - The type of the translation that will be cached
 */
class I18nCache<TranslationValue extends Translation = Translation> {
  protected config: I18nCacheConfig;

  /**
   * Single dev hot-reload listener for runtime-translation cache misses.
   * Subclasses that add cache-miss behavior should wrap any existing listener
   * instead of overwriting it.
   */
  protected onTranslationsCacheMiss?: (
    event: TranslationsCacheMissEvent<TranslationValue>
  ) => void;

  /**
   * Locale-keyed cache for translations
   */
  private translations: ResourceCache<
    Locale,
    TranslationsCache<TranslationValue>
  >;

  /**
   * Creates a locale-bound translateMany for runtime translation
   */
  private createTranslateMany: CreateTranslateMany;

  /**
   * Creates an instance of I18nCache.
   * TODO: resolve gtConfig from just file path
   * @param params - The parameters for the I18nCache constructor
   * @param params.config - The configuration for the I18nCache
   */
  constructor(params: I18nCacheConstructorParams) {
    // Validation
    validateCacheParams(params);

    this.config = {
      projectId: params.projectId,
      devApiKey: params.devApiKey,
      apiKey: params.apiKey,
      runtimeUrl: params.runtimeUrl,
      modelProvider: params.modelProvider,
      cacheExpiryTime: params.cacheExpiryTime,
      batchConfig: params.batchConfig,
      runtimeTranslation: params.runtimeTranslation,
      _versionId: params._versionId,
    };

    // Create cache miss handlers
    const loadTranslations = routeCreateTranslationLoader({
      loadTranslations: params.loadTranslations,
      type: getLoadTranslationsType(params),
      remoteTranslationLoaderParams: {
        cacheUrl: params.cacheUrl,
        projectId: params.projectId,
        _versionId: params._versionId,
        _branchId: params._branchId,
      },
    }) as SafeTranslationsLoader<TranslationValue>;
    // Without a project ID or API key, each runtime translation request rejects.
    const i18nConfig = getI18nConfig();
    this.createTranslateMany = createTranslateManyFactory(
      () => i18nConfig.getTranslationRuntime(),
      this.config.runtimeTranslation?.timeout ?? DEFAULT_TRANSLATION_TIMEOUT,
      {
        ...(this.config.modelProvider && {
          modelProvider: this.config.modelProvider,
        }),
        ...this.config.runtimeTranslation?.metadata,
      }
    );

    // Setup locale-keyed caches
    const ttl = this.config.cacheExpiryTime;
    this.translations = new ResourceCache<
      Locale,
      TranslationsCache<TranslationValue>
    >({
      ttl,
      load: async (locale) =>
        this.createTranslationsCache(locale, await loadTranslations(locale)),
    });
  }

  // ========== Cache Factories ========== //

  private createTranslationsCache(
    locale: Locale,
    init: Record<Hash, TranslationValue>
  ): TranslationsCache<TranslationValue> {
    return new TranslationsCache<TranslationValue>({
      init,
      translateMany: this.createTranslateMany(locale),
      batchConfig: this.config.batchConfig,
      onMiss: (hash, translation) =>
        this.onTranslationsCacheMiss?.({ locale, hash, translation }),
    });
  }

  // ========== Getters and Setters ========== //

  /**
   * Get the version ID
   */
  getVersionId(): string | undefined {
    return this.config._versionId;
  }

  // ========== Translation Updates ========== //

  updateTranslations(
    translationsSnapshot: Record<Locale, Record<Hash, TranslationValue>>
  ): void {
    for (const locale in translationsSnapshot) {
      const txCache = this.translations.get(locale);
      if (txCache) {
        txCache.update(translationsSnapshot[locale]);
      } else {
        this.translations.set(
          locale,
          this.createTranslationsCache(locale, translationsSnapshot[locale])
        );
      }
    }
  }

  // ========== Translation Resolution ========== //

  /**
   * Loads in translations for a given locale
   * Edge case usage: access the translations object directly
   */
  async loadTranslations(
    locale: string
  ): Promise<Record<Hash, TranslationValue>> {
    return this.guardAsync({}, async () => {
      // Validate
      const translationLocale = this.resolveCacheLocale(locale);
      if (!translationLocale) {
        return {};
      }

      const txCache = await this.translations.getOrLoad(translationLocale);

      // Get the translations
      return txCache.getInternalCache();
    });
  }

  /**
   * Just lookup a translation
   */
  lookupTranslation<T extends TranslationValue = TranslationValue>(
    locale: string,
    message: T,
    options: LookupOptions
  ): T | undefined {
    return this.guard<T | undefined>(undefined, () => {
      // Validate
      const { translationLocale, options: lookupOptions } =
        this.resolveLookupParams(locale, options);

      // Early return if in default locale
      if (!translationLocale) return message;

      // Get the translation from the locale cache
      return this.translations
        .get(translationLocale)
        ?.get({ message, options: lookupOptions });
    });
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
    return this.guardAsync<T | undefined>(undefined, () =>
      this.lookupTranslationWithFallbackResolved(locale, message, options)
    );
  }

  /**
   * Saves a current lookup translation function immune to expiry
   * Useful for operations involving lookup callbacks like useGT()
   * @param locale - The locale to get the lookup translation for
   * @returns A lookup translation function
   *
   * @important prefetchEntries must all be the same locale
   */
  async getLookupTranslation(locale: string): Promise<
    TranslationResolver<TranslationValue> & {
      prefetchEntries?: PrefetchEntriesType<TranslationValue>;
    }
  > {
    return this.guardAsync<TranslationResolver<TranslationValue>>(
      (message) => message,
      async () => {
        // Locale used for the async load
        const asyncBoundaryLocale = this.resolveCacheLocale(locale);

        // Early return if i18n is disabled or default locale
        if (!asyncBoundaryLocale) {
          return (message) => message;
        }

        const asyncBoundaryTxCache =
          await this.translations.getOrLoad(asyncBoundaryLocale);

        // Prefetch any entries during async block (dev hot reload only)
        const prefetchEntries = async (
          prefetchEntries: {
            message: TranslationValue;
            options: LookupOptions;
          }[] = []
        ) => {
          if (
            process.env.NODE_ENV !== 'production' &&
            getI18nConfig().isDevHotReloadEnabled()
          ) {
            // Invariant: all prefetchEntries must be the same locale
            // TODO: investigate why we have made this an invariant, we may be able to drop this requirement
            const resolvedPrefetchEntries = resolvePrefetchEntriesByLocale(
              prefetchEntries,
              asyncBoundaryLocale,
              (entryLocale) =>
                this.resolveCacheLocale(entryLocale) ??
                getI18nConfig().resolveLocale(entryLocale)
            );
            if (resolvedPrefetchEntries.length !== prefetchEntries.length) {
              logger.warn(
                `I18nCache: getLookupTranslation(): prefetchEntries must all be the same locale, ignoring all entries that are not for ${asyncBoundaryLocale}`
              );
            }

            await Promise.allSettled(
              resolvedPrefetchEntries
                .filter((entry) => asyncBoundaryTxCache.get(entry) == null)
                .map((entry) => asyncBoundaryTxCache.miss(entry))
            );
          }
        };

        // Create translation resolver
        const lookupTranslation: TranslationResolver<TranslationValue> = (
          message,
          lookupOptions: LookupOptions = {} as LookupOptions
        ) =>
          this.guard(undefined, () => {
            const { translationLocale, options } = this.resolveLookupParams(
              lookupOptions.$locale ?? asyncBoundaryLocale,
              lookupOptions
            );

            // Default locale, return the message
            if (!translationLocale) return message;

            // Request locale overriden, to attempt a synchronous lookup if an alternate locale is requested
            const txCache =
              translationLocale === asyncBoundaryLocale
                ? asyncBoundaryTxCache
                : this.translations.get(translationLocale);

            // Get the translation
            return txCache?.get({ message, options });
          });

        Object.assign(lookupTranslation, { prefetchEntries });
        return lookupTranslation;
      }
    );
  }

  // ========== Error Handling ========== //

  /**
   * Run a lookup, routing errors through handleError (log in production,
   * throw in development) and returning the fallback once handled.
   */
  private guard<T>(fallback: T, fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      this.handleError(error);
      return fallback;
    }
  }

  private async guardAsync<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error);
      return fallback;
    }
  }

  /**
   * Handle errors
   * Soft error in production, throw in development
   */
  private handleError(error: unknown) {
    handleCacheError('I18nCache', error);
  }

  /**
   * Resolve the locale key used to load/read locale caches.
   * Returns undefined when the requested locale can use source content.
   */
  resolveCacheLocale(locale: string): string | undefined {
    const i18nConfig = getI18nConfig();
    const resolvedLocale = i18nConfig.resolveLocale(locale);
    if (i18nConfig.requiresTranslation({ locale: resolvedLocale })) {
      return resolvedLocale;
    }

    // Explicit translation lookups may request a dialect outside the supported
    // app locales. Preserve that existing fallback independently of routing.
    const aliasLocale = i18nConfig.resolveAliasLocale(
      i18nConfig.standardizeLocale(locale)
    );
    if (i18nConfig.requiresTranslation({ locale: aliasLocale })) {
      return aliasLocale;
    }

    return undefined;
  }

  private resolveLookupParams(locale: string, options: LookupOptions) {
    const translationLocale = this.resolveCacheLocale(locale);
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
  ): LookupOptions {
    if (!options.$locale) {
      return options;
    }
    return {
      ...options,
      $locale:
        translationLocale ??
        this.resolveCacheLocale(options.$locale) ??
        getI18nConfig().resolveLocale(options.$locale),
    };
  }

  private async lookupTranslationWithFallbackResolved<
    T extends TranslationValue = TranslationValue,
  >(locale: string, message: T, options: LookupOptions): Promise<T> {
    const { translationLocale, options: lookupOptions } =
      this.resolveLookupParams(locale, options);

    if (!translationLocale) {
      return message;
    }

    const txCache = await this.translations.getOrLoad(translationLocale);

    let translation = txCache.get({ message, options: lookupOptions });
    if (translation == null) {
      translation = await txCache.miss({ message, options: lookupOptions });
    }
    return translation;
  }
}

export { I18nCache };

// ===== Helper Functions ===== //

/**
 * Validate constructor params: log warnings for suspicious configs and throw
 * on hard misconfigurations.
 */

function validateCacheParams(params: I18nCacheConstructorParams): void {
  // Runtime translation against a custom API URL still needs GT credentials
  if (params.runtimeUrl && params.runtimeUrl !== defaultRuntimeApiUrl) {
    if (!params.projectId) {
      logger.warn(
        'I18nCache: ' +
          createDiagnosticMessage({
            whatHappened: 'Runtime translation needs a projectId',
            fix: 'Add projectId to the I18nCache config or disable runtime translation',
          })
      );
    }
    if (!params.devApiKey && !params.apiKey) {
      logger.warn(
        'I18nCache: ' +
          createDiagnosticMessage({
            whatHappened: 'Runtime translation needs devApiKey or apiKey',
            fix: 'Add credentials to the I18nCache config or disable runtime translation',
          })
      );
    }
  }
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
