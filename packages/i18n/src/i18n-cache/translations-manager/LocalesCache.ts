import { DictionaryCache } from './DictionaryCache';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryKey,
  DictionaryLoader,
} from './DictionaryCache';
import { ResourceCache } from './ResourceCache';
import { TranslationsCache } from './TranslationsCache';
import type {
  Hash,
  TranslationBatchConfig,
  TranslationKey,
} from './TranslationsCache';
import type { CreateTranslateMany } from './utils/createTranslateMany';
import type { Translation } from './utils/types/translation-data';
import type { SafeTranslationsLoader } from './translations-loaders/types';
import type {
  I18nCacheLifecycleCallbacks,
  LifecycleCallback,
  LifecycleParam,
} from '../lifecycle-hooks/types';
import { getI18nConfig } from '../../i18n-config/singleton-operations';

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
  lifecycle: I18nCacheLifecycleCallbacks<TranslationValue>;
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
    lifecycle,
  }: LocalesCacheParams<TranslationValue>) {
    this.createTranslationsCache = createTranslationsCacheFactory({
      lifecycle,
      createTranslateMany,
      batchConfig,
    });
    this.createDictionaryCache = (locale, init) =>
      createDictionaryCache({
        locale,
        dictionary: init,
        translate: translateDictionaryEntry,
        lifecycle,
      });
    this.translations = new ResourceCache({
      ttl,
      load: async (locale) =>
        this.createTranslationsCache(locale, await loadTranslations(locale)),
      lifecycle: {
        onHit: lifecycle.onLocalesCacheHit,
        onMiss: lifecycle.onLocalesCacheMiss,
      },
    });

    this.dictionaries = new ResourceCache({
      ttl,
      load: async (locale) =>
        this.createDictionaryCache(locale, await loadDictionary(locale)),
      lifecycle: {
        onHit: lifecycle.onLocalesDictionaryCacheHit,
        onMiss: lifecycle.onLocalesDictionaryCacheMiss,
      },
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
  lifecycle,
  createTranslateMany,
  batchConfig,
}: {
  lifecycle: I18nCacheLifecycleCallbacks<TranslationValue>;
  createTranslateMany: CreateTranslateMany;
  batchConfig?: TranslationBatchConfig;
}) {
  return (locale: Locale, init: Record<Hash, TranslationValue>) =>
    new TranslationsCache<TranslationValue>({
      init,
      lifecycle: createTranslationsCacheLifecycle(locale, lifecycle),
      translateMany: createTranslateMany(locale),
      batchConfig,
    });
}

function createTranslationsCacheLifecycle<TranslationValue extends Translation>(
  locale: Locale,
  lifecycle: I18nCacheLifecycleCallbacks<TranslationValue>
): LifecycleParam<
  TranslationKey<TranslationValue>,
  Hash,
  TranslationValue,
  TranslationValue
> {
  return {
    onHit: withLocale(locale, lifecycle.onTranslationsCacheHit),
    onMiss: withLocale(locale, lifecycle.onTranslationsCacheMiss),
  };
}

function createDictionaryCache<TranslationValue extends Translation>({
  locale,
  dictionary,
  translate,
  lifecycle,
}: {
  locale: Locale;
  dictionary: Dictionary;
  translate: TranslateLocaleDictionaryEntry;
  lifecycle: I18nCacheLifecycleCallbacks<TranslationValue>;
}) {
  const {
    onDictionaryCacheHit,
    onDictionaryCacheMiss,
    onDictionaryObjectCacheHit,
  } = lifecycle;
  return new DictionaryCache({
    init: dictionary,
    runtimeTranslate: (key, sourceEntry) => translate(locale, key, sourceEntry),
    lifecycle: {
      onHit: withLocale(locale, onDictionaryCacheHit),
      onMiss: withLocale(locale, onDictionaryCacheMiss),
      onDictionaryObjectCacheHit: withLocale(
        locale,
        onDictionaryObjectCacheHit
      ),
    },
  });
}

function withLocale<InputKey, CacheKey, CacheValue, OutputValue>(
  locale: Locale,
  callback:
    | ((params: {
        locale: Locale;
        inputKey: InputKey;
        cacheKey: CacheKey;
        cacheValue: CacheValue;
        outputValue: OutputValue;
      }) => void)
    | undefined
): LifecycleCallback<InputKey, CacheKey, CacheValue, OutputValue> | undefined {
  return callback ? (params) => callback({ locale, ...params }) : undefined;
}
