import { getI18nConfig } from '../i18n-config/singleton-operations';
import type { LookupOptions } from '../translation-functions/types/options';
import { DictionaryCache } from './translations-manager/DictionaryCache';
import { TranslationsCache } from './translations-manager/TranslationsCache';
import type { Translation } from './translations-manager/utils/types/translation-data';
import {
  getDictionaryValue,
  resolveDictionaryLookupOptions,
} from './translations-manager/utils/dictionary-helpers';
import { DictionarySourceNotFoundError } from './translations-manager/utils/DictionarySourceNotFoundError';
import type {
  DictionaryEntry,
  DictionaryObject,
} from './translations-manager/utils/types/dictionary';
import { createTranslateManyFactory } from './translations-manager/utils/createTranslateMany';
import type { I18nCacheConstructorParams } from './types';
import type { SnapshotStoreInstance } from './SnapshotStore';
import { defaultRuntimeTranslationTimeout } from './settings';
import { createGTRuntime } from '../runtime/createGTRuntime';
import {
  resolveCacheLocale,
  resolveLookupParams,
} from './utils/resolveCacheLocale';

export interface MissingTranslationResolver {
  lookupTranslationWithFallback<T extends Translation>(
    locale: string,
    message: T,
    options: LookupOptions
  ): Promise<T | undefined>;
  lookupDictionaryWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryEntry | undefined>;
  lookupDictionaryObjWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryObject | undefined>;
}

export type RuntimeTranslationResolverParams = Pick<
  I18nCacheConstructorParams,
  | 'projectId'
  | 'runtimeUrl'
  | 'apiKey'
  | 'devApiKey'
  | 'batchConfig'
  | 'runtimeTranslation'
  | 'modelProvider'
>;

/** Resolves hydrated-client misses without resource loading or cache expiry. */
export class RuntimeTranslationResolver implements MissingTranslationResolver {
  private readonly translations = new Map<
    string,
    TranslationsCache<Translation>
  >();
  private readonly dictionaries = new Map<string, DictionaryCache>();
  private readonly createTranslateMany;

  constructor(
    private readonly snapshots: SnapshotStoreInstance,
    private readonly params: RuntimeTranslationResolverParams
  ) {
    this.createTranslateMany = createTranslateManyFactory(
      createGTRuntime(getI18nConfig(), params),
      params.runtimeTranslation?.timeout ?? defaultRuntimeTranslationTimeout,
      {
        ...(params.modelProvider && { modelProvider: params.modelProvider }),
        ...params.runtimeTranslation?.metadata,
      }
    );
  }

  async lookupTranslationWithFallback<T extends Translation>(
    locale: string,
    message: T,
    options: LookupOptions
  ): Promise<T | undefined> {
    const { translationLocale, options: lookupOptions } = resolveLookupParams(
      locale,
      options
    );
    if (!translationLocale) return message;

    const translation = this.snapshots.lookupTranslation(
      translationLocale,
      message,
      lookupOptions
    );
    if (translation != null) return translation;

    return this.getTranslationsCache(translationLocale).miss({
      message,
      options: lookupOptions,
    });
  }

  async lookupDictionaryWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryEntry | undefined> {
    const dictionaryLocale = resolveCacheLocale(locale);
    if (!dictionaryLocale) return this.getSourceDictionaryEntry(id);

    const existing = this.snapshots.lookupDictionary(dictionaryLocale, id);
    if (existing) return existing;

    const entry = await this.getDictionaryCache(
      dictionaryLocale
    ).materializeEntry(id, this.getSourceDictionaryEntry(id));
    this.snapshots.updateDictionaryValue(
      dictionaryLocale,
      id,
      getDictionaryValue(entry)
    );
    return entry;
  }

  async lookupDictionaryObjWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryObject | undefined> {
    const dictionaryLocale = resolveCacheLocale(locale);
    if (!dictionaryLocale) return this.getSourceDictionaryObject(id);

    const targetObject = this.snapshots.lookupDictionaryObj(
      dictionaryLocale,
      id
    );
    const sourceObject = this.getSourceDictionaryObject(id, false);
    if (sourceObject === undefined) {
      if (targetObject !== undefined) return targetObject;
      throw new DictionarySourceNotFoundError(id);
    }

    const dictionaryObject = await this.getDictionaryCache(
      dictionaryLocale
    ).materializeValue(id, sourceObject, targetObject);
    this.snapshots.updateDictionaryValue(
      dictionaryLocale,
      id,
      dictionaryObject
    );
    return dictionaryObject;
  }

  private getTranslationsCache(locale: string): TranslationsCache<Translation> {
    let cache = this.translations.get(locale);
    if (!cache) {
      cache = new TranslationsCache({
        init: {},
        translateMany: this.createTranslateMany(locale),
        batchConfig: this.params.batchConfig,
        onMiss: (hash, translation) => {
          this.snapshots.updateTranslations({
            [locale]: { [hash]: translation },
          });
        },
      });
      this.translations.set(locale, cache);
    }
    return cache;
  }

  private getDictionaryCache(locale: string): DictionaryCache {
    let cache = this.dictionaries.get(locale);
    if (!cache) {
      cache = new DictionaryCache({
        init: this.snapshots.getDictionary(locale) ?? {},
        runtimeTranslate: async (id, sourceEntry) => {
          const translation = await this.lookupTranslationWithFallback(
            locale,
            sourceEntry.entry,
            resolveDictionaryLookupOptions(sourceEntry.options)
          );
          if (typeof translation !== 'string') {
            throw new Error(
              `Dictionary entry "${id}" could not be translated into a string. Check the source entry and runtime translation output.`
            );
          }
          return translation;
        },
      });
      this.dictionaries.set(locale, cache);
    }
    return cache;
  }

  private getSourceDictionaryEntry(id: string): DictionaryEntry {
    const entry = this.snapshots.lookupDictionary(
      getI18nConfig().getDefaultLocale(),
      id
    );
    if (!entry) throw new DictionarySourceNotFoundError(id);
    return entry;
  }

  private getSourceDictionaryObject(
    id: string,
    throwOnMissing = true
  ): DictionaryObject | undefined {
    const object = this.snapshots.lookupDictionaryObj(
      getI18nConfig().getDefaultLocale(),
      id
    );
    if (object === undefined && throwOnMissing) {
      throw new DictionarySourceNotFoundError(id);
    }
    return object;
  }
}
