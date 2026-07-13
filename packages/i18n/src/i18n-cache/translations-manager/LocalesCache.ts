import { DictionaryCache } from './DictionaryCache';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryKey,
  DictionaryLoader,
} from './DictionaryCache';
import { ResourceCache } from './ResourceCache';
import { TranslationsCache } from './TranslationsCache';
import type { Hash, TranslationBatchConfig } from './TranslationsCache';
import type { CreateTranslateMany } from './utils/createTranslateMany';
import type { Translation } from './utils/types/translation-data';
import type { SafeTranslationsLoader } from './translations-loaders/types';
import { getI18nConfig } from '../../i18n-config/singleton-operations';

/**
 * Called when a translation is resolved through a runtime cache miss, with the
 * resolving locale attached.
 */
export type LocalesTranslationsCacheMissCallback<
  TranslationValue extends Translation,
> = (locale: Locale, hash: Hash, translation: TranslationValue) => void;

/**
 * Just being explicit about the purpose of this type
 */
export type Locale = string;

type TranslateLocaleDictionaryEntry = (
  locale: Locale,
  key: DictionaryKey,
  sourceEntry: DictionaryEntry
) => Promise<string>;

type LocalesCacheParams<TranslationValue extends Translation> = {
  ttl?: number | null;
  batchConfig?: TranslationBatchConfig;
  dictionary?: Dictionary;
  createTranslateMany: CreateTranslateMany;
  loadTranslations: SafeTranslationsLoader<TranslationValue>;
  loadDictionary: DictionaryLoader;
  translateDictionaryEntry: TranslateLocaleDictionaryEntry;
  onTranslationsCacheMiss?: LocalesTranslationsCacheMissCallback<TranslationValue>;
};

export class LocalesCache<TranslationValue extends Translation> {
  private readonly translations: ResourceCache<
    Locale,
    TranslationsCache<TranslationValue>
  >;
  private readonly dictionaries: ResourceCache<Locale, DictionaryCache>;
  private readonly createTranslationsCache: (
    locale: Locale,
    init: Record<Hash, TranslationValue>
  ) => TranslationsCache<TranslationValue>;
  private readonly createDictionaryCache: (
    locale: Locale,
    init: Dictionary
  ) => DictionaryCache;

  constructor({
    ttl,
    batchConfig,
    dictionary = {},
    loadTranslations,
    loadDictionary,
    createTranslateMany,
    translateDictionaryEntry,
    onTranslationsCacheMiss,
  }: LocalesCacheParams<TranslationValue>) {
    this.createTranslationsCache = createTranslationsCacheFactory({
      onTranslationsCacheMiss,
      createTranslateMany,
      batchConfig,
    });
    this.createDictionaryCache = (locale, init) =>
      new DictionaryCache({
        init,
        runtimeTranslate: (key, sourceEntry) =>
          translateDictionaryEntry(locale, key, sourceEntry),
      });
    this.translations = new ResourceCache({
      ttl,
      load: async (locale) =>
        this.createTranslationsCache(locale, await loadTranslations(locale)),
    });

    this.dictionaries = new ResourceCache({
      ttl,
      load: async (locale) =>
        this.createDictionaryCache(locale, await loadDictionary(locale)),
    });

    const defaultLocale = getI18nConfig().getDefaultLocale();
    this.dictionaries.set(
      defaultLocale,
      this.createDictionaryCache(defaultLocale, dictionary),
      { expiresAt: -1 }
    );
  }

  public getTranslations(
    locale: Locale
  ): TranslationsCache<TranslationValue> | undefined {
    return this.translations.get(locale);
  }

  public getOrLoadTranslations(
    locale: Locale
  ): Promise<TranslationsCache<TranslationValue>> {
    return this.translations.getOrLoad(locale);
  }

  public getDictionary(locale: Locale): DictionaryCache | undefined {
    return this.dictionaries.get(locale);
  }

  public getOrLoadDictionary(locale: Locale): Promise<DictionaryCache> {
    return this.dictionaries.getOrLoad(locale);
  }

  public updateTranslations(
    translations: Record<Locale, Record<Hash, TranslationValue>>
  ): void {
    for (const locale in translations) {
      const translationsCache = this.translations.get(locale);
      if (translationsCache) {
        translationsCache.update(translations[locale]);
      } else {
        this.translations.set(
          locale,
          this.createTranslationsCache(locale, translations[locale])
        );
      }
    }
  }

  public updateDictionaries(dictionaries: Record<Locale, Dictionary>): void {
    for (const locale in dictionaries) {
      const dictionaryCache = this.dictionaries.get(locale);
      if (dictionaryCache) {
        dictionaryCache.update(dictionaries[locale]);
      } else {
        this.dictionaries.set(
          locale,
          this.createDictionaryCache(locale, dictionaries[locale])
        );
      }
    }
  }
}

function createTranslationsCacheFactory<TranslationValue extends Translation>({
  onTranslationsCacheMiss,
  createTranslateMany,
  batchConfig,
}: {
  onTranslationsCacheMiss?: LocalesTranslationsCacheMissCallback<TranslationValue>;
  createTranslateMany: CreateTranslateMany;
  batchConfig?: TranslationBatchConfig;
}) {
  return (locale: Locale, init: Record<Hash, TranslationValue>) =>
    new TranslationsCache<TranslationValue>({
      init,
      onMiss: onTranslationsCacheMiss
        ? (hash, translation) =>
            onTranslationsCacheMiss(locale, hash, translation)
        : undefined,
      translateMany: createTranslateMany(locale),
      batchConfig,
    });
}
