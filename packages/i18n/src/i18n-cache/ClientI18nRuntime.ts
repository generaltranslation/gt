import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { hashMessage } from '../utils/hashMessage';
import type { LookupOptions } from '../translation-functions/types/options';
import { ResourceCache } from './translations-manager/ResourceCache';
import { createTranslationLoader } from './translations-manager/translations-loaders/routeCreateTranslationLoader';
import type { SafeTranslationsLoader } from './translations-manager/translations-loaders/types';
import {
  cloneDictionaryValue,
  getDictionaryEntry,
  getDictionaryValueAtPath,
} from './translations-manager/utils/dictionary-helpers';
import type { Translation } from './translations-manager/utils/types/translation-data';
import type {
  Dictionary,
  I18nCacheConstructorParams,
  I18nRuntime,
  TranslationResolver,
} from './types';
import type {
  DictionaryEntry,
  DictionaryObject,
} from './translations-manager/DictionaryCache';
import type { Hash, Locale } from './translations-manager/TranslationsCache';
import { validateDictionaryConfig } from './validateDictionaryConfig';

const invalidLocale = Symbol('invalidLocale');

/**
 * Production browser runtime. It implements the shared lookup contract without
 * pulling in runtime translation, batching, subscriptions, or React state.
 */
class ClientI18nRuntime implements I18nRuntime {
  private versionId: string | undefined;
  private translations: ResourceCache<Locale, Record<Hash, Translation>>;
  private dictionaries: ResourceCache<Locale, Dictionary>;

  constructor(config: I18nCacheConstructorParams) {
    validateDictionaryConfig(config);
    this.versionId = config._versionId;
    const loadTranslations = createTranslationLoader(
      config
    ) as SafeTranslationsLoader<Translation>;
    const loadDictionary = config.loadDictionary ?? (async () => ({}));

    this.translations = new ResourceCache({
      ttl: config.cacheExpiryTime,
      load: async (locale) => structuredClone(await loadTranslations(locale)),
    });
    this.dictionaries = new ResourceCache({
      ttl: config.cacheExpiryTime,
      load: async (locale) => structuredClone(await loadDictionary(locale)),
    });
    this.dictionaries.set(
      getI18nConfig().getDefaultLocale(),
      structuredClone(config.dictionary ?? {}),
      { expiresAt: -1 }
    );
  }

  getVersionId(): string | undefined {
    return this.versionId;
  }

  async loadTranslations(locale: string): Promise<Record<Hash, Translation>> {
    const cacheLocale = this.resolveTranslationLocale(locale);
    if (!cacheLocale || cacheLocale === invalidLocale) return {};
    return structuredClone(
      (await this.load(this.translations, cacheLocale, 'translations')) ?? {}
    );
  }

  async loadDictionary(locale: string): Promise<Dictionary> {
    const cacheLocale = this.resolveDictionaryLocale(locale);
    if (!cacheLocale) return {};
    return cloneDictionaryValue(
      (await this.load(this.dictionaries, cacheLocale, 'dictionary')) ?? {}
    );
  }

  lookupTranslation<T extends Translation>(
    locale: string,
    message: T,
    options: LookupOptions
  ): T | undefined {
    const cacheLocale = this.resolveTranslationLocale(locale);
    if (cacheLocale === invalidLocale) return;
    if (!cacheLocale) return message;
    return this.lookupTranslationIn(
      this.translations.get(cacheLocale),
      message,
      options,
      cacheLocale
    );
  }

  lookupDictionary(locale: string, id: string): DictionaryEntry | undefined {
    const value = this.lookupDictionaryObj(locale, id);
    return value === undefined ? undefined : getDictionaryEntry(value);
  }

  lookupDictionaryObj(
    locale: string,
    id: string
  ): DictionaryObject | undefined {
    const cacheLocale = this.resolveDictionaryLocale(locale);
    if (!cacheLocale) return;
    const dictionary = this.dictionaries.get(cacheLocale);
    if (!dictionary) return;
    return this.lookupDictionaryValue(dictionary, id);
  }

  async getLookupTranslation(locale: string): Promise<TranslationResolver> {
    const cacheLocale = this.resolveTranslationLocale(locale);
    if (!cacheLocale || cacheLocale === invalidLocale) {
      return (message) => message;
    }
    const translations = await this.load(
      this.translations,
      cacheLocale,
      'translations'
    );
    if (!translations) return (message) => message;

    return (message, options = {} as LookupOptions) => {
      const lookupLocale = options.$locale ?? locale;
      const lookupCacheLocale = this.resolveTranslationLocale(lookupLocale);
      if (lookupCacheLocale === invalidLocale) return;
      if (!lookupCacheLocale) return message;
      return this.lookupTranslationIn(
        lookupCacheLocale === cacheLocale
          ? translations
          : this.translations.get(lookupCacheLocale),
        message,
        options,
        lookupCacheLocale
      );
    };
  }

  async getLookupDictionary(locale: string) {
    const cacheLocale = this.resolveDictionaryLocale(locale);
    const dictionary = cacheLocale
      ? await this.load(this.dictionaries, cacheLocale, 'dictionary')
      : undefined;
    return {
      lookupDictionary: (id: string) => {
        const value = dictionary
          ? this.lookupDictionaryValue(dictionary, id)
          : undefined;
        return value === undefined ? undefined : getDictionaryEntry(value);
      },
      lookupDictionaryObj: (id: string) =>
        dictionary ? this.lookupDictionaryValue(dictionary, id) : undefined,
    };
  }

  private lookupTranslationIn<T extends Translation>(
    translations: Record<Hash, Translation> | undefined,
    message: T,
    options: LookupOptions,
    locale: Locale
  ): T | undefined {
    const resolvedOptions = options.$locale
      ? { ...options, $locale: locale }
      : options;
    return this.guard(
      () =>
        translations?.[
          options.$_hash ?? hashMessage(message, resolvedOptions)
        ] as T | undefined
    );
  }

  private lookupDictionaryValue(
    dictionary: Dictionary,
    id: string
  ): DictionaryObject | undefined {
    return this.guard(() =>
      cloneDictionaryValue(getDictionaryValueAtPath(dictionary, id))
    );
  }

  private resolveTranslationLocale(
    locale: string
  ): Locale | undefined | typeof invalidLocale {
    try {
      return getI18nConfig().resolveTranslationLocale(locale);
    } catch (error) {
      this.reportLocaleError(locale, error);
      return invalidLocale;
    }
  }

  private resolveDictionaryLocale(locale: string): Locale | undefined {
    const translationLocale = this.resolveTranslationLocale(locale);
    if (translationLocale === invalidLocale) return;
    return translationLocale ?? getI18nConfig().getDefaultLocale();
  }

  private async load<Value>(
    cache: ResourceCache<Locale, Value>,
    locale: Locale,
    resource: 'translations' | 'dictionary'
  ): Promise<Value | undefined> {
    try {
      return await cache.getOrLoad(locale);
    } catch (error) {
      console.warn(
        createDiagnosticMessage({
          source: 'gt-i18n',
          severity: 'Warning',
          whatHappened: `Could not load ${resource} for locale "${locale}", so source content is used`,
          why: `the ${resource} loader failed`,
          fix: `Check your ${
            resource === 'translations' ? 'loadTranslations' : 'loadDictionary'
          } configuration and generated files.`,
          details: formatDiagnosticErrorDetails(error),
        })
      );
    }
  }

  private reportLocaleError(locale: string, error: unknown): void {
    console.error(
      createDiagnosticMessage({
        source: 'gt-i18n',
        severity: 'Error',
        whatHappened: `Could not resolve locale "${locale}", so source content is used`,
        why: 'locale resolution failed',
        fix: 'Check the configured locales and custom locale mappings.',
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }

  private guard<Value>(lookup: () => Value): Value | undefined {
    try {
      return lookup();
    } catch (error) {
      console.error(
        createDiagnosticMessage({
          source: 'gt-i18n',
          severity: 'Error',
          whatHappened:
            'A client i18n lookup failed, so source content is used',
          details: formatDiagnosticErrorDetails(error),
        })
      );
    }
  }
}

export function createClientI18nRuntime(
  config: I18nCacheConstructorParams
): I18nRuntime {
  return new ClientI18nRuntime(config);
}
