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
  I18nManagerCacheLifecycleCallbacks,
  LifecycleCallback,
  LifecycleParam,
} from '../lifecycle-hooks/types';

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
  defaultLocale: Locale;
  dictionary?: Dictionary;
  createTranslateMany: CreateTranslateMany;
  loadTranslations: SafeTranslationsLoader<TranslationValue>;
  loadDictionary: DictionaryLoader;
  translateDictionaryEntry: TranslateLocaleDictionaryEntry;
  lifecycle: I18nManagerCacheLifecycleCallbacks<TranslationValue>;
};

export class LocalesCache<TranslationValue extends Translation> {
  private readonly translations: ResourceCache<
    Locale,
    TranslationsCache<TranslationValue>
  >;
  private readonly dictionaries: ResourceCache<Locale, DictionaryCache>;
  private readonly createDictionaryCache: (
    locale: Locale,
    dictionary: Dictionary
  ) => DictionaryCache;

  constructor({
    ttl,
    batchConfig,
    defaultLocale,
    dictionary,
    loadTranslations,
    loadDictionary,
    createTranslateMany,
    translateDictionaryEntry,
    lifecycle,
  }: LocalesCacheParams<TranslationValue>) {
    const createLocaleDictionaryCache = (
      locale: Locale,
      dictionary: Dictionary
    ) =>
      createDictionaryCache({
        locale,
        dictionary,
        translate: translateDictionaryEntry,
        lifecycle,
      });
    this.createDictionaryCache = createLocaleDictionaryCache;

    this.translations = new ResourceCache({
      ttl,
      load: async (locale) =>
        new TranslationsCache<TranslationValue>({
          init: await loadTranslations(locale),
          lifecycle: createTranslationsCacheLifecycle(locale, lifecycle),
          translateMany: createTranslateMany(locale),
          batchConfig,
        }),
      lifecycle: {
        onHit: lifecycle.onLocalesCacheHit,
        onMiss: lifecycle.onLocalesCacheMiss,
      },
    });

    this.dictionaries = new ResourceCache({
      ttl,
      load: async (locale) =>
        createLocaleDictionaryCache(
          locale,
          (await loadDictionary(locale)) ?? {}
        ),
      lifecycle: {
        onHit: lifecycle.onLocalesDictionaryCacheHit,
        onMiss: lifecycle.onLocalesDictionaryCacheMiss,
      },
    });

    if (dictionary !== undefined) {
      this.dictionaries.set(
        defaultLocale,
        createLocaleDictionaryCache(defaultLocale, dictionary),
        { expiresAt: -1 }
      );
    }
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

  public setDictionary(
    locale: Locale,
    dictionary: Dictionary,
    expiresAt?: number
  ): void {
    this.dictionaries.set(
      locale,
      this.createDictionaryCache(locale, dictionary),
      { expiresAt }
    );
  }
}

function createTranslationsCacheLifecycle<TranslationValue extends Translation>(
  locale: Locale,
  lifecycle: I18nManagerCacheLifecycleCallbacks<TranslationValue>
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
  lifecycle: I18nManagerCacheLifecycleCallbacks<TranslationValue>;
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
