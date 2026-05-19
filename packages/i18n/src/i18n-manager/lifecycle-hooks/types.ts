import type { Translation } from '../translations-manager/utils/types/translation-data';
import type {
  TranslationKey,
  Hash,
  TranslationsCache,
} from '../translations-manager/TranslationsCache';
import type { Locale } from '../translations-manager/LocalesCache';
import type {
  DictionaryKey,
  DictionaryPath,
  DictionaryValue,
  DictionaryEntry,
  DictionaryCache,
} from '../translations-manager/DictionaryCache';
import type { ResourceCacheEntry } from '../translations-manager/ResourceCache';

// ===== Base Cache Lifecycle ===== //

/**
 * Lifecycle callback
 */
export type LifecycleCallback<InputKey, CacheKey, CacheValue, OutputValue> =
  (params: {
    inputKey: InputKey;
    cacheKey: CacheKey;
    cacheValue: CacheValue;
    outputValue: OutputValue;
  }) => void;

/**
 * Lifecycle param for the Cache constructor
 */
export type LifecycleParam<InputKey, CacheKey, CacheValue, OutputValue> = {
  onHit?: LifecycleCallback<InputKey, CacheKey, CacheValue, OutputValue>;
  onMiss?: LifecycleCallback<InputKey, CacheKey, CacheValue, OutputValue>;
};

// ===== Locales Cache Lifecycle ===== //

/**
 * Locales cache lifecycle callback
 */
export type LocalesTranslationsCacheLifecycleCallback<
  TranslationValue extends Translation,
> = LifecycleCallback<
  Locale,
  Locale,
  ResourceCacheEntry<TranslationsCache<TranslationValue>>,
  TranslationsCache<TranslationValue>
>;

/**
 * Translations cache lifecycle callback with locale embedded as first param.
 * Uses base Translation type to avoid generic variance issues.
 */
export type TranslationsCacheLifecycleCallback<
  TranslationValue extends Translation,
> = (params: {
  locale: Locale;
  inputKey: TranslationKey<TranslationValue>;
  cacheKey: Hash;
  cacheValue: TranslationValue;
  outputValue: TranslationValue;
}) => void;

/**
 * Combined locales cache lifecycle callbacks
 */
export type LocalesTranslationsCacheLifecycleCallbacks<
  TranslationValue extends Translation,
> = {
  onLocalesCacheHit?: LocalesTranslationsCacheLifecycleCallback<TranslationValue>;
  onLocalesCacheMiss?: LocalesTranslationsCacheLifecycleCallback<TranslationValue>;
  onTranslationsCacheHit?: TranslationsCacheLifecycleCallback<TranslationValue>;
  onTranslationsCacheMiss?: TranslationsCacheLifecycleCallback<TranslationValue>;
};

// ===== Locales Dictionary Cache Lifecycle ===== //

/**
 * Locales dictionary cache lifecycle callback
 */
export type LocalesDictionaryCacheLifecycleCallback = LifecycleCallback<
  Locale,
  Locale,
  ResourceCacheEntry<DictionaryCache>,
  DictionaryCache
>;

/**
 * Dictionary cache lifecycle callback with locale embedded as first param.
 */
export type DictionaryCacheLifecycleCallback = (params: {
  locale: Locale;
  inputKey: DictionaryKey;
  cacheKey: DictionaryPath;
  cacheValue: DictionaryValue;
  outputValue: DictionaryEntry;
}) => void;

/**
 * Dictionary object cache lifecycle callback with locale embedded as first param.
 */
export type DictionaryObjectCacheLifecycleCallback = (params: {
  locale: Locale;
  inputKey: DictionaryKey;
  cacheKey: DictionaryPath;
  cacheValue: DictionaryValue;
  outputValue: DictionaryValue;
}) => void;

/**
 * Combined locales dictionary cache lifecycle callbacks
 */
export type LocalesDictionaryCacheLifecycleCallbacks = {
  onLocalesDictionaryCacheHit?: LocalesDictionaryCacheLifecycleCallback;
  onLocalesDictionaryCacheMiss?: LocalesDictionaryCacheLifecycleCallback;
  onDictionaryCacheHit?: DictionaryCacheLifecycleCallback;
  onDictionaryCacheMiss?: DictionaryCacheLifecycleCallback;
  onDictionaryObjectCacheHit?: DictionaryObjectCacheLifecycleCallback;
};

/**
 * Combined I18nManager cache lifecycle callbacks
 */
export type I18nManagerCacheLifecycleCallbacks<
  TranslationValue extends Translation,
> = LocalesTranslationsCacheLifecycleCallbacks<TranslationValue> &
  LocalesDictionaryCacheLifecycleCallbacks;
