import logger from '../logs/logger';
import { I18nCacheConfig, I18nCacheConstructorParams } from './types';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { defaultRuntimeApiUrl } from 'generaltranslation/internal';
import type { Content } from '@generaltranslation/format';
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
import type {
  Hash,
  Locale,
  TranslationKey,
} from './translations-manager/TranslationsCache';
import { handleCacheError } from './utils/handleCacheError';
import { getI18nConfig } from '../i18n-config/singleton-operations';

/**
 * Default translation timeout in milliseconds for a runtime translation request
 */
const DEFAULT_TRANSLATION_TIMEOUT = 12_000; // 12 seconds

/**
 * A translation resolver is a function that synchronously resolves a translation
 * @template U - The type of the translation (default: Content)
 * @param {U} content - The content to get the translation for
 * @param {LookupOptions} [options] - The options for the translation
 * @returns {U | undefined} The translation for the given content and options or undefined if the translation is not found
 */
type TranslationResolver<U extends Content = Content> = <T extends U = U>(
  content: T,
  options?: LookupOptions
) => T | undefined;

/**
 * Callback function to prefetch entries during the async period
 */
type PrefetchEntriesType<TranslationType extends Content> = (
  prefetchEntries: TranslationKey<TranslationType>[]
) => Promise<void>;

/**
 * Event fired when a runtime translation resolves a cache miss
 */
export type TranslationsCacheMissEvent<
  TranslationValue extends Content = Content,
> = {
  locale: Locale;
  hash: Hash;
  translation: TranslationValue;
};

/**
 * Class for managing translation functionality
 * @template TranslationValue - The type of the translation that will be cached
 */
class I18nCache<TranslationValue extends Content = Content> {
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
      if (locale === getI18nConfig().getDefaultLocale()) {
        return {};
      }

      const txCache = await this.translations.getOrLoad(locale);

      // Get the translations
      return txCache.getInternalCache();
    });
  }

  /**
   * Just lookup a translation
   */
  lookupTranslation<T extends TranslationValue = TranslationValue>(
    locale: string,
    content: T,
    options: LookupOptions
  ): T | undefined {
    return this.guard<T | undefined>(undefined, () => {
      if (locale === getI18nConfig().getDefaultLocale()) return content;
      return this.translations.get(locale)?.get({ content, options });
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
    content: T,
    options: LookupOptions
  ): Promise<T | undefined> {
    return this.guardAsync<T | undefined>(undefined, () =>
      this.lookupTranslationWithFallbackResolved(locale, content, options)
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
      (content) => content,
      async () => {
        const defaultLocale = getI18nConfig().getDefaultLocale();

        // Early return if i18n is disabled or default locale
        if (locale === defaultLocale) {
          return (content) => content;
        }

        const asyncBoundaryTxCache = await this.translations.getOrLoad(locale);

        // Prefetch any entries during async block (dev hot reload only)
        const prefetchEntries = async (
          prefetchEntries: TranslationKey<TranslationValue>[] = []
        ) => {
          if (
            process.env.NODE_ENV !== 'production' &&
            getI18nConfig().isDevHotReloadEnabled()
          ) {
            // Invariant: all prefetchEntries must be the same locale
            // TODO: investigate why we have made this an invariant, we may be able to drop this requirement
            const resolvedPrefetchEntries = prefetchEntries.filter(
              ({ options }) =>
                options.$locale == null || options.$locale === locale
            );
            if (resolvedPrefetchEntries.length !== prefetchEntries.length) {
              logger.warn(
                `I18nCache: getLookupTranslation(): prefetchEntries must all be the same locale, ignoring all entries that are not for ${locale}`
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
          content,
          lookupOptions: LookupOptions = {} as LookupOptions
        ) =>
          this.guard(undefined, () => {
            const translationLocale = lookupOptions.$locale ?? locale;

            // Default locale, return the content
            if (translationLocale === defaultLocale) return content;

            // Request locale overriden, to attempt a synchronous lookup if an alternate locale is requested
            const txCache =
              translationLocale === locale
                ? asyncBoundaryTxCache
                : this.translations.get(translationLocale);

            // Get the translation
            return txCache?.get({ content, options: lookupOptions });
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

  private async lookupTranslationWithFallbackResolved<
    T extends TranslationValue = TranslationValue,
  >(locale: string, content: T, options: LookupOptions): Promise<T> {
    if (locale === getI18nConfig().getDefaultLocale()) {
      return content;
    }

    const txCache = await this.translations.getOrLoad(locale);

    let translation = txCache.get({ content, options });
    if (translation == null) {
      translation = await txCache.miss({ content, options });
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
    if (!params.apiKey) {
      logger.warn(
        'I18nCache: ' +
          createDiagnosticMessage({
            whatHappened: 'Runtime translation needs an apiKey',
            fix: 'Add credentials to the I18nCache config or disable runtime translation',
          })
      );
    }
  }
}
