import { LocaleConfig, standardizeLocale } from 'generaltranslation/core';
import logger from '../logs/logger';
import { LookupOptions } from '../translation-functions/types/options';
import type { I18nManager } from './I18nManager';
import type { I18nManagerConfig } from './types';
import { Locale, LocalesCache } from './translations-manager/LocalesCache';
import { Hash } from './translations-manager/TranslationsCache';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryKey,
  DictionaryObject,
} from './translations-manager/DictionaryCache';
import { LocalesDictionaryCache } from './translations-manager/LocalesDictionaryCache';
import { resolveDictionaryLookupOptions } from './translations-manager/utils/dictionary-helpers';
import { DictionarySourceNotFoundError } from './translations-manager/utils/DictionarySourceNotFoundError';
import { Translation } from './translations-manager/utils/types/translation-data';

/**
 * A translation resolver is a function that synchronously resolves a translation
 * @template U - The type of the translation (default: Translation)
 * @param {U} message - The message to get the translation for
 * @param {LookupOptions} [options] - The options for the translation
 * @returns {U | undefined} The translation for the given message and options or undefined if the translation is not found
 */
export type TranslationResolver<U extends Translation = Translation> = <
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

type LookupMethodsInternals<
  TranslationValue extends Translation = Translation,
> = {
  config: I18nManagerConfig;
  localesCache: LocalesCache<TranslationValue>;
  localesDictionaryCache: LocalesDictionaryCache;
  localeConfig: LocaleConfig;
  requiresTranslation(locale: string): boolean;
  resolveLocale(locale: string): string;
  resolveCacheLocale(locale: string): string | undefined;
  resolveLookupParams(
    locale: string,
    options: LookupOptions
  ): {
    translationLocale: string | undefined;
    options: LookupOptions;
  };
  resolveLookupOptions(
    options?: LookupOptions,
    translationLocale?: string
  ): LookupOptions;
  lookupTranslation<T extends TranslationValue = TranslationValue>(
    locale: string,
    message: T,
    options: LookupOptions
  ): T | undefined;
  loadTranslations(locale: string): Promise<Record<Hash, TranslationValue>>;
  getLookupTranslation(
    locale: string,
    prefetchEntries?: PrefetchEntry<TranslationValue>[]
  ): Promise<TranslationResolver<TranslationValue>>;
  lookupTranslationWithFallbackResolved<
    T extends TranslationValue = TranslationValue,
  >(
    locale: string,
    message: T,
    options: LookupOptions
  ): Promise<T>;
  dictionaryRuntimeTranslate(
    locale: Locale,
    id: DictionaryKey,
    sourceEntry: DictionaryEntry
  ): Promise<string>;
  handleError(error: unknown): void;
};

export type LookupMethodsContext<
  TranslationValue extends Translation = Translation,
> = Omit<
  I18nManager<TranslationValue>,
  keyof LookupMethodsInternals<TranslationValue>
> &
  LookupMethodsInternals<TranslationValue>;

export function bindLookupMethods<
  TranslationValue extends Translation = Translation,
>(manager: I18nManager<TranslationValue>) {
  const context = manager as unknown as LookupMethodsContext<TranslationValue>;
  const bindMethod = <Args extends unknown[], Return>(
    method: (
      this: LookupMethodsContext<TranslationValue>,
      ...args: Args
    ) => Return
  ) => method.bind(context);

  context.loadTranslations = bindMethod(loadTranslations<TranslationValue>);
  context.loadDictionary = bindMethod(loadDictionary<TranslationValue>);
  context.lookupDictionary = bindMethod(lookupDictionary<TranslationValue>);
  context.lookupDictionaryObj = bindMethod(
    lookupDictionaryObj<TranslationValue>
  );
  context.lookupDictionaryWithFallback = bindMethod(
    lookupDictionaryWithFallback<TranslationValue>
  );
  context.lookupDictionaryObjWithFallback = bindMethod(
    lookupDictionaryObjWithFallback<TranslationValue>
  );
  context.lookupTranslation = bindMethod(
    lookupTranslation<TranslationValue>
  ) as typeof context.lookupTranslation;
  context.lookupTranslationWithFallback = bindMethod(
    lookupTranslationWithFallback<TranslationValue>
  ) as typeof context.lookupTranslationWithFallback;
  context.getLookupTranslation = bindMethod(
    getLookupTranslation<TranslationValue>
  );
  context.resolveTranslationSync = bindMethod(
    resolveTranslationSync<TranslationValue>
  ) as typeof context.resolveTranslationSync;
  context.getTranslations = bindMethod(getTranslations<TranslationValue>);
  context.getTranslationResolver = bindMethod(
    getTranslationResolver<TranslationValue>
  );
  context.resolveCacheLocale = bindMethod(resolveCacheLocale<TranslationValue>);
  context.resolveLookupParams = bindMethod(
    resolveLookupParams<TranslationValue>
  );
  context.resolveLookupOptions = bindMethod(
    resolveLookupOptions<TranslationValue>
  );
  context.lookupTranslationWithFallbackResolved = bindMethod(
    lookupTranslationWithFallbackResolved<TranslationValue>
  ) as typeof context.lookupTranslationWithFallbackResolved;
  context.dictionaryRuntimeTranslate = bindMethod(
    dictionaryRuntimeTranslate<TranslationValue>
  );
}

/**
 * Loads in translations for a given locale
 * Edge case usage: access the translations object directly
 */
export async function loadTranslations<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string
): Promise<Record<Hash, TranslationValue>> {
  try {
    // Validate
    const translationLocale = this.resolveCacheLocale(locale);
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
 * Loads in the dictionary for a given locale
 * Edge case usage: access the dictionary object directly
 */
export async function loadDictionary<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string
): Promise<Dictionary> {
  try {
    // Validate
    const dictionaryLocale = this.resolveCacheLocale(locale);
    if (!dictionaryLocale) {
      return (
        this.localesDictionaryCache
          .get(this.config.defaultLocale)
          ?.getInternalCache() ?? {}
      );
    }

    // Get the locale dictionary cache
    let dictionaryCache = this.localesDictionaryCache.get(dictionaryLocale);
    if (!dictionaryCache) {
      dictionaryCache =
        await this.localesDictionaryCache.miss(dictionaryLocale);
    }

    // Get the dictionary
    const dictionary = dictionaryCache.getInternalCache();
    return dictionary;
  } catch (error) {
    this.handleError(error);
    return {};
  }
}

/**
 * Look up a dictionary entry
 */
export function lookupDictionary<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string,
  id: string
): DictionaryEntry | undefined {
  try {
    const dictionaryLocale =
      this.resolveCacheLocale(locale) ?? this.config.defaultLocale;
    const dictionaryEntry = this.localesDictionaryCache
      .get(dictionaryLocale)
      ?.get(id);

    return dictionaryEntry;
  } catch (error) {
    this.handleError(error);
    return undefined;
  }
}

/**
 * Look up a dictionary entry or subtree
 */
export function lookupDictionaryObj<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string,
  id: string
): DictionaryObject | undefined {
  try {
    const dictionaryLocale =
      this.resolveCacheLocale(locale) ?? this.config.defaultLocale;
    return this.localesDictionaryCache.get(dictionaryLocale)?.getObj(id);
  } catch (error) {
    this.handleError(error);
    return undefined;
  }
}

/**
 * Look up a dictionary entry
 * If it's not found, use the fallback (runtime translate)
 */
export async function lookupDictionaryWithFallback<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string,
  id: string
): Promise<DictionaryEntry | undefined> {
  try {
    const dictionaryLocale = this.resolveCacheLocale(locale);
    if (!dictionaryLocale) {
      const sourceEntry = this.localesDictionaryCache
        .get(this.config.defaultLocale)
        ?.get(id);
      if (sourceEntry === undefined) {
        throw new DictionarySourceNotFoundError(id);
      }
      return sourceEntry;
    }

    let dictionaryCache = this.localesDictionaryCache.get(dictionaryLocale);
    if (!dictionaryCache) {
      dictionaryCache =
        await this.localesDictionaryCache.miss(dictionaryLocale);
    }

    let dictionaryEntry = dictionaryCache.get(id);
    if (dictionaryEntry === undefined) {
      const sourceEntry = this.localesDictionaryCache
        .get(this.config.defaultLocale)
        ?.get(id);
      if (sourceEntry === undefined) {
        throw new DictionarySourceNotFoundError(id);
      }
      dictionaryEntry = await dictionaryCache.miss(id, sourceEntry);
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
export async function lookupDictionaryObjWithFallback<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string,
  id: string
): Promise<DictionaryObject | undefined> {
  try {
    const dictionaryLocale = this.resolveCacheLocale(locale);
    if (!dictionaryLocale) {
      const sourceObject = this.localesDictionaryCache
        .get(this.config.defaultLocale)
        ?.getObj(id);
      if (sourceObject === undefined) {
        throw new DictionarySourceNotFoundError(id);
      }
      return sourceObject;
    }

    let dictionaryCache = this.localesDictionaryCache.get(dictionaryLocale);
    if (!dictionaryCache) {
      dictionaryCache =
        await this.localesDictionaryCache.miss(dictionaryLocale);
    }

    let dictionaryObject = dictionaryCache.getObj(id);
    if (dictionaryObject === undefined) {
      const sourceObject = this.localesDictionaryCache
        .get(this.config.defaultLocale)
        ?.getObj(id);
      if (sourceObject === undefined) {
        throw new DictionarySourceNotFoundError(id);
      }
      dictionaryObject = await dictionaryCache.missObj(id, sourceObject);
    }
    return dictionaryObject;
  } catch (error) {
    this.handleError(error);
    return undefined;
  }
}

/**
 * Just lookup a translation
 */
export function lookupTranslation<
  TranslationValue extends Translation = Translation,
  T extends TranslationValue = TranslationValue,
>(
  this: LookupMethodsContext<TranslationValue>,
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
export async function lookupTranslationWithFallback<
  TranslationValue extends Translation = Translation,
  T extends TranslationValue = TranslationValue,
>(
  this: LookupMethodsContext<TranslationValue>,
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
 * @param prefetchEntries - Any entries we want to prefetch during the async period
 * @returns A lookup translation function
 *
 * @important prefetchEntries must all be the same locale
 */
export async function getLookupTranslation<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string,
  prefetchEntries: {
    message: TranslationValue;
    options: LookupOptions;
  }[] = []
): Promise<TranslationResolver<TranslationValue>> {
  try {
    // Validate
    const translationLocale = this.resolveCacheLocale(locale);

    // Early return if i18n is disabled or default locale
    if (!translationLocale) {
      return (message) => message;
    }

    // Invariant: all prefetchEntries must be the same locale
    const resolvedPrefetchEntries = resolvePrefetchEntriesByLocale(
      prefetchEntries,
      translationLocale,
      (entryLocale) =>
        this.resolveCacheLocale(entryLocale) ?? this.resolveLocale(entryLocale)
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

/**
 * Get the translations (error on unloaded translations)
 * @param {string} message - The message to get the translation for
 * @param {LookupOptions} [options] - The options for the translation
 * @returns {TranslationValue | undefined} The translation for the given message and options synchronously
 * @deprecated use lookupTranslation instead
 */
export function resolveTranslationSync<
  TranslationValue extends Translation = Translation,
  T extends TranslationValue = TranslationValue,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string,
  message: T,
  options: LookupOptions
) {
  return this.lookupTranslation(locale, message, options);
}

/**
 * Get the translations
 * @deprecated use loadTranslations instead
 */
export async function getTranslations<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
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
export async function getTranslationResolver<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string
): Promise<TranslationResolver<TranslationValue>> {
  return this.getLookupTranslation(locale);
}

/**
 * Resolve the locale key used to load/read locale caches.
 * Returns undefined when the requested locale can use source content.
 */
export function resolveCacheLocale<
  TranslationValue extends Translation = Translation,
>(this: LookupMethodsContext<TranslationValue>, locale: string) {
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

export function resolveLookupParams<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string,
  options: LookupOptions
) {
  const translationLocale = this.resolveCacheLocale(locale);
  return {
    translationLocale,
    options: translationLocale
      ? this.resolveLookupOptions(options, translationLocale)
      : options,
  };
}

export function resolveLookupOptions<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
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
      this.resolveCacheLocale(options.$locale) ??
      this.resolveLocale(options.$locale),
  };
}

export async function lookupTranslationWithFallbackResolved<
  TranslationValue extends Translation = Translation,
  T extends TranslationValue = TranslationValue,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: string,
  message: T,
  options: LookupOptions
): Promise<T> {
  const { translationLocale, options: lookupOptions } =
    this.resolveLookupParams(locale, options);

  if (!translationLocale) {
    return message;
  }

  let txCache = this.localesCache.get(translationLocale);
  if (!txCache) txCache = await this.localesCache.miss(translationLocale);

  let translation = txCache.get({ message, options: lookupOptions });
  if (translation == null) {
    translation = await txCache.miss({ message, options: lookupOptions });
  }
  return translation;
}

/**
 * Runtime lookup function for dictionaries
 */
export async function dictionaryRuntimeTranslate<
  TranslationValue extends Translation = Translation,
>(
  this: LookupMethodsContext<TranslationValue>,
  locale: Locale,
  id: DictionaryKey,
  sourceEntry: DictionaryEntry
): Promise<string> {
  // Runtime translation
  const translation = await this.lookupTranslationWithFallbackResolved(
    locale,
    sourceEntry.entry as TranslationValue,
    resolveDictionaryLookupOptions(sourceEntry.options)
  );
  if (typeof translation !== 'string') {
    throw new Error(
      `I18nManager: dictionaryRuntimeTranslate(): unable to translate dictionary entry ${id}`
    );
  }

  return translation;
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
