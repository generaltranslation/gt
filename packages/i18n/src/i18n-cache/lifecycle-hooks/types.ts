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
  Dictionary,
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
 * Combined I18nCache cache lifecycle callbacks
 */
export type I18nCacheLifecycleCallbacks<TranslationValue extends Translation> =
  LocalesTranslationsCacheLifecycleCallbacks<TranslationValue> &
    LocalesDictionaryCacheLifecycleCallbacks;

// ===== Consumer API ===== //

/**
 * Simplified lifecycle callbacks for I18nCache consumers.
 * These provide a cleaner interface than the internal cache lifecycle types,
 * with locale and hash exposed directly instead of the full cache internals.
 *
 * @deprecated - move to subscription api instead
 */
export type LifecycleCallbacks<TranslationValue extends Translation> = {
  onTranslationsCacheHit?: (params: {
    locale: Locale;
    hash: Hash;
    translation: TranslationValue;
    /** @deprecated - use translation instead */
    value: TranslationValue;
  }) => void;
  onTranslationsCacheMiss?: (params: {
    locale: Locale;
    hash: Hash;
    translation: TranslationValue;
    /** @deprecated - use translation instead */
    value: TranslationValue;
  }) => void;
  onLocalesCacheHit?: (params: {
    locale: Locale;
    translations: Record<Hash, TranslationValue>;
    /** @deprecated - use translations instead */
    value: Record<Hash, TranslationValue>;
  }) => void;
  onLocalesCacheMiss?: (params: {
    locale: Locale;
    translations: Record<Hash, TranslationValue>;
    /** @deprecated - use translations instead */
    value: Record<Hash, TranslationValue>;
  }) => void;
  onDictionaryCacheHit?: (params: {
    locale: Locale;
    id: DictionaryPath;
    dictionaryEntry: DictionaryEntry;
  }) => void;
  onDictionaryCacheMiss?: (params: {
    locale: Locale;
    id: DictionaryPath;
    dictionaryEntry: DictionaryEntry;
  }) => void;
  onDictionaryObjectCacheHit?: (params: {
    locale: Locale;
    id: DictionaryPath;
    dictionaryValue: DictionaryValue;
  }) => void;
  onLocalesDictionaryCacheHit?: (params: {
    locale: Locale;
    dictionary: Dictionary;
  }) => void;
  onLocalesDictionaryCacheMiss?: (params: {
    locale: Locale;
    dictionary: Dictionary;
  }) => void;
};
