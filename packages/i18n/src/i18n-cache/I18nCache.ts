import { publishValidationResults } from './validation/publishValidationResults';
import logger from '../logs/logger';
import { I18nCacheConfig, I18nCacheConstructorParams } from './types';
import { validateConfig } from './validation/validateConfig';
import { Translation } from './translations-manager/utils/types/translation-data';
import { LookupOptions } from '../translation-functions/types/options';
import { SafeTranslationsLoader } from './translations-manager/translations-loaders/types';
import { createTranslateManyFactory } from './translations-manager/utils/createTranslateMany';
import { routeCreateTranslationLoader } from './translations-manager/translations-loaders/routeCreateTranslationLoader';
import { getLoadTranslationsType } from './utils/getLoadTranslationsType';
import { LocalesCache } from './translations-manager/LocalesCache';
import type { Locale } from './translations-manager/LocalesCache';
import type { Hash } from './translations-manager/TranslationsCache';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryObject,
} from './translations-manager/DictionaryCache';
import { resolveDictionaryLookupOptions } from './translations-manager/utils/dictionary-helpers';
import { DictionarySourceNotFoundError } from './translations-manager/utils/DictionarySourceNotFoundError';
import { EventEmitter } from './event-subscription/EventEmitter';
import { TRANSLATIONS_CACHE_MISS_EVENT_NAME } from './event-subscription/types';
import type { I18nEvents } from './event-subscription/types';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
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

type DictionaryResolver = (id: string) => DictionaryEntry | undefined;

type DictionaryObjResolver = (id: string) => DictionaryObject | undefined;

type DictionaryResolvers = {
  lookupDictionary: DictionaryResolver;
  lookupDictionaryObj: DictionaryObjResolver;
};

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
 * Class for managing translation functionality
 * @template TranslationValue - The type of the translation that will be cached
 */
class I18nCache<
  TranslationValue extends Translation = Translation,
> extends EventEmitter<I18nEvents<TranslationValue>> {
  protected config: I18nCacheConfig;

  /**
   * Locale-scoped caches for translations and dictionaries
   */
  private localesCache: LocalesCache<TranslationValue>;

  /**
   * Creates an instance of I18nCache.
   * TODO: resolve gtConfig from just file path
   * @param params - The parameters for the I18nCache constructor
   * @param params.config - The configuration for the I18nCache
   */
  constructor(params: I18nCacheConstructorParams) {
    super();

    // Validation
    const validationResults = validateConfig(params);
    publishValidationResults(validationResults, 'I18nCache: ');

    this.config = standardizeConfig(params);

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
    // TODO: somewhere enforce that if you have a loadDictionary, you must have a dictionary
    const loadDictionary = params.loadDictionary ?? (() => Promise.resolve({}));
    const runtimeTranslationTimeout =
      this.config.runtimeTranslation?.timeout ?? DEFAULT_TRANSLATION_TIMEOUT;
    const runtimeTranslationMetadata =
      this.config.runtimeTranslation?.metadata ?? {};
    const createTranslateMany = createTranslateManyFactory(
      getI18nConfig().getGTClass(),
      runtimeTranslationTimeout,
      runtimeTranslationMetadata
    );

    // Setup locale-scoped caches
    this.localesCache = new LocalesCache<TranslationValue>({
      dictionary: params.dictionary,
      loadTranslations,
      loadDictionary,
      createTranslateMany,
      translateDictionaryEntry: (locale, id, sourceEntry) =>
        this.translateDictionaryEntry(locale, id, sourceEntry),
      ttl: this.config.cacheExpiryTime,
      batchConfig: this.config.batchConfig,
      onTranslationsCacheMiss: (locale, hash, translation) =>
        this.emit(TRANSLATIONS_CACHE_MISS_EVENT_NAME, {
          locale,
          hash,
          translation,
        }),
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
      event: I18nEvents<TranslationValue>[typeof TRANSLATIONS_CACHE_MISS_EVENT_NAME]
    ) => void,
    locale: Locale,
    hash: Hash
  ) {
    return this.subscribe(TRANSLATIONS_CACHE_MISS_EVENT_NAME, (event) => {
      if (event.locale !== locale || event.hash !== hash) {
        return;
      }
      listener(event);
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
    this.localesCache.updateTranslations(translationsSnapshot);
  }

  updateDictionaries(dictionarySnapshot: Record<Locale, Dictionary>): void {
    this.localesCache.updateDictionaries(dictionarySnapshot);
  }

  // ========== Translation Loading ========== //

  // ========== Translation Resolution ========== //

  /**
   * Used for checking the status of a translation load
   */
  hasTranslations(locale: string): boolean {
    try {
      const translationLocale = this._resolveCacheLocale(locale);
      if (!translationLocale) return false;
      return this.localesCache.getTranslations(translationLocale) !== undefined;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  /**
   * Loads in translations for a given locale
   * Edge case usage: access the translations object directly
   */
  async loadTranslations(
    locale: string
  ): Promise<Record<Hash, TranslationValue>> {
    try {
      // Validate
      const translationLocale = this._resolveCacheLocale(locale);
      if (!translationLocale) {
        return {};
      }

      const txCache =
        await this.localesCache.getOrLoadTranslations(translationLocale);

      // Get the translations
      const translations = txCache.getInternalCache();
      return translations;
    } catch (error) {
      this.handleError(error);
      return {};
    }
  }

  /**
   * Loads in the dictionary for a given locale
   * Edge case usage: access the dictionary object directly
   */
  async loadDictionary(locale: string): Promise<Dictionary> {
    try {
      // Validate
      const dictionaryLocale = this._resolveCacheLocale(locale);
      if (!dictionaryLocale) {
        return this.getDefaultDictionaryCache()?.getInternalCache() ?? {};
      }

      const dictionaryCache =
        await this.localesCache.getOrLoadDictionary(dictionaryLocale);

      return dictionaryCache.getInternalCache();
    } catch (error) {
      this.handleError(error);
      return {};
    }
  }

  /**
   * Look up a dictionary entry
   */
  lookupDictionary(locale: string, id: string): DictionaryEntry | undefined {
    try {
      const dictionaryLocale = this.resolveDictionaryCacheLocale(locale);
      const dictionaryEntry = this.localesCache
        .getDictionary(dictionaryLocale)
        ?.getEntry(id);

      return dictionaryEntry;
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
  }

  /**
   * Look up a dictionary entry or subtree
   */
  lookupDictionaryObj(
    locale: string,
    id: string
  ): DictionaryObject | undefined {
    try {
      const dictionaryLocale = this.resolveDictionaryCacheLocale(locale);
      return this.localesCache.getDictionary(dictionaryLocale)?.getValue(id);
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
  }

  async getLookupDictionary(locale: string): Promise<DictionaryResolvers> {
    try {
      const asyncBoundaryLocale = this._resolveCacheLocale(locale);
      const asyncBoundaryDictionaryCache = asyncBoundaryLocale
        ? await this.localesCache.getOrLoadDictionary(asyncBoundaryLocale)
        : this.getDefaultDictionaryCache();

      return {
        lookupDictionary: (id) => asyncBoundaryDictionaryCache?.getEntry(id),
        lookupDictionaryObj: (id) => asyncBoundaryDictionaryCache?.getValue(id),
      };
    } catch (error) {
      this.handleError(error);
      return {
        lookupDictionary: () => undefined,
        lookupDictionaryObj: () => undefined,
      };
    }
  }

  /**
   * Look up a dictionary entry
   * If it's not found, use the fallback (runtime translate)
   */
  async lookupDictionaryWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryEntry | undefined> {
    try {
      const dictionaryLocale = this._resolveCacheLocale(locale);
      if (!dictionaryLocale) {
        return this.getSourceDictionaryEntry(id);
      }

      const dictionaryCache =
        await this.localesCache.getOrLoadDictionary(dictionaryLocale);

      let dictionaryEntry = dictionaryCache.getEntry(id);
      if (dictionaryEntry === undefined) {
        dictionaryEntry = await dictionaryCache.materializeEntry(
          id,
          this.getSourceDictionaryEntry(id)
        );
      }
      return dictionaryEntry;
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
  }

  /**
   * Look up a dictionary entry or subtree
   * If it's not found, use the fallback (runtime translate)
   */
  async lookupDictionaryObjWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryObject | undefined> {
    try {
      const dictionaryLocale = this._resolveCacheLocale(locale);

      if (!dictionaryLocale) {
        return this.getSourceDictionaryObject(id);
      }

      const dictionaryCache =
        await this.localesCache.getOrLoadDictionary(dictionaryLocale);
      const targetObject = dictionaryCache.getValue(id);
      const sourceObject = this.getSourceDictionaryObject(id, {
        throwOnMissing: false,
      });
      if (sourceObject === undefined) {
        if (targetObject !== undefined) {
          return targetObject;
        }
        throw new DictionarySourceNotFoundError(id);
      }

      return await dictionaryCache.materializeValue(
        id,
        sourceObject,
        targetObject
      );
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
  }

  private async translateDictionaryEntry(
    locale: Locale,
    id: string,
    sourceEntry: DictionaryEntry
  ): Promise<string> {
    const translation = await this.lookupTranslationWithFallbackResolved(
      locale,
      sourceEntry.entry as TranslationValue,
      resolveDictionaryLookupOptions(sourceEntry.options)
    );
    if (typeof translation !== 'string') {
      throw new Error(
        `Dictionary entry "${id}" could not be translated into a string. Check the source entry and translation loader output.`
      );
    }
    return translation;
  }

  private getSourceDictionaryEntry(id: string): DictionaryEntry {
    const sourceEntry = this.getDefaultDictionaryCache()?.getEntry(id);
    if (sourceEntry === undefined) {
      throw new DictionarySourceNotFoundError(id);
    }
    return sourceEntry;
  }

  private getSourceDictionaryObject(
    id: string,
    { throwOnMissing = true }: { throwOnMissing?: boolean } = {}
  ): DictionaryObject | undefined {
    const sourceObject = this.getDefaultDictionaryCache()?.getValue(id);
    if (sourceObject === undefined && throwOnMissing) {
      throw new DictionarySourceNotFoundError(id);
    }
    return sourceObject;
  }

  private getDefaultDictionaryCache() {
    return this.localesCache.getDictionary(getI18nConfig().getDefaultLocale());
  }

  private resolveDictionaryCacheLocale(locale: string): Locale {
    return (
      this._resolveCacheLocale(locale) ?? getI18nConfig().getDefaultLocale()
    );
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
      if (!translationLocale) return message;

      // Get the locale cache
      const txCache = this.localesCache.getTranslations(translationLocale);
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
      return await this.lookupTranslationWithFallbackResolved(
        locale,
        message,
        options
      );
    } catch (error) {
      this.handleError(error);
      return undefined;
    }
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
    try {
      // Locale used for the async load
      const asyncBoundaryLocale = this._resolveCacheLocale(locale);

      // Early return if i18n is disabled or default locale
      if (!asyncBoundaryLocale) {
        return (message) => message;
      }

      const asyncBoundaryTxCache =
        await this.localesCache.getOrLoadTranslations(asyncBoundaryLocale);

      // Prefetch any entries during async block (dev hot reload only)
      const prefetchEntries = async (
        prefetchEntries: {
          message: TranslationValue;
          options: LookupOptions;
        }[] = []
      ) => {
        if (!getI18nConfig().isDevHotReloadEnabled()) return;

        // Invariant: all prefetchEntries must be the same locale
        // TODO: investigate why we have made this an invariant, we may be able to drop this requirement
        const resolvedPrefetchEntries = resolvePrefetchEntriesByLocale(
          prefetchEntries,
          asyncBoundaryLocale,
          (entryLocale) =>
            this._resolveCacheLocale(entryLocale) ??
            this._resolveLocale(entryLocale)
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
      };

      // Create translation resolver
      const lookupTranslation: TranslationResolver<TranslationValue> = (
        message,
        lookupOptions: LookupOptions = {} as LookupOptions
      ) => {
        try {
          const { translationLocale, options } = this.resolveLookupParams(
            lookupOptions.$locale ?? asyncBoundaryLocale,
            lookupOptions
          );

          // Default locale, return the message
          if (!translationLocale) return message;

          // Request locale overriden, to attempt a synchronous lookup if an alternate locale is requested
          let txCache = asyncBoundaryTxCache;
          if (translationLocale !== asyncBoundaryLocale) {
            const syncBoundaryTxCache =
              this.localesCache.getTranslations(translationLocale);
            if (!syncBoundaryTxCache) return undefined;
            txCache = syncBoundaryTxCache;
          }

          // Get the translation
          return txCache.get({
            message,
            options,
          });
        } catch (error) {
          this.handleError(error);
          return undefined;
        }
      };

      Object.assign(lookupTranslation, { prefetchEntries });
      return lookupTranslation;
    } catch (error) {
      this.handleError(error);
      return (message) => message;
    }
  }

  // ========== Metadata ========== //

  /**
   * Handle errors
   * Soft error in production, throw in development
   */
  private handleError(error: unknown) {
    if (error instanceof DictionarySourceNotFoundError) {
      throw error;
    }

    switch (getRuntimeEnvironment()) {
      case 'development':
        throw error;
      case 'production':
      default:
        logger.error('I18nCache: ' + error);
        break;
    }
  }

  private _resolveLocale(locale: string) {
    const i18nConfig = getI18nConfig();
    const resolvedLocale = i18nConfig.determineLocale(locale);
    if (!i18nConfig.isValidLocale(locale) || !resolvedLocale) {
      throw new Error(
        `Locale "${locale}" is not valid. Use a valid BCP 47 locale code or add a custom mapping.`
      );
    }
    return resolvedLocale;
  }

  /**
   * Resolve the locale key used to load/read locale caches.
   * Returns undefined when the requested locale can use source content.
   */
  private _resolveCacheLocale(locale: string) {
    const resolvedLocale = this._resolveLocale(locale);
    const i18nConfig = getI18nConfig();
    if (i18nConfig.requiresTranslation(resolvedLocale)) {
      return resolvedLocale;
    }

    const aliasLocale = i18nConfig.resolveAliasLocale(
      i18nConfig.standardizeLocale(locale)
    );
    if (i18nConfig.requiresTranslation(aliasLocale)) {
      return aliasLocale;
    }

    return undefined;
  }

  private resolveLookupParams(locale: string, options: LookupOptions) {
    const translationLocale = this._resolveCacheLocale(locale);
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
        this._resolveCacheLocale(options.$locale) ??
        this._resolveLocale(options.$locale),
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

    const txCache =
      await this.localesCache.getOrLoadTranslations(translationLocale);

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
 * Standardize the config
 * @param config - The config to standardize
 * @returns The standardized config
 */
function standardizeConfig(config: I18nCacheConstructorParams) {
  return {
    projectId: config.projectId,
    devApiKey: config.devApiKey,
    apiKey: config.apiKey,
    runtimeUrl: config.runtimeUrl,
    cacheExpiryTime: config.cacheExpiryTime,
    batchConfig: config.batchConfig,
    runtimeTranslation: config.runtimeTranslation,
    _versionId: config._versionId,
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
