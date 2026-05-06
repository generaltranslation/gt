import type { Translation } from '../translations-manager/utils/types/translation-data';
import type {
  TranslationKey,
  Hash,
} from '../translations-manager/TranslationsCache';
import type { Locale, CacheEntry } from '../translations-manager/LocalesCache';
import type {
  DictionaryKey,
  DictionaryPath,
  DictionaryValue,
  Dictionary,
  DictionaryEntry,
} from '../translations-manager/DictionaryCache';
import type { DictionaryCacheEntry } from '../translations-manager/LocalesDictionaryCache';

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
export type LocalesCacheLifecycleCallback<
  TranslationValue extends Translation,
> = LifecycleCallback<
  Locale,
  Locale,
  CacheEntry<TranslationValue>,
  CacheEntry<TranslationValue>['translationsCache']
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
export type LocalesCacheLifecycleCallbacks<
  TranslationValue extends Translation,
> = {
  onLocalesCacheHit?: LocalesCacheLifecycleCallback<TranslationValue>;
  onLocalesCacheMiss?: LocalesCacheLifecycleCallback<TranslationValue>;
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
  DictionaryCacheEntry,
  DictionaryCacheEntry['dictionaryCache']
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
 * Combined locales dictionary cache lifecycle callbacks
 */
export type LocalesDictionaryCacheLifecycleCallbacks = {
  onLocalesDictionaryCacheHit?: LocalesDictionaryCacheLifecycleCallback;
  onLocalesDictionaryCacheMiss?: LocalesDictionaryCacheLifecycleCallback;
  onDictionaryCacheHit?: DictionaryCacheLifecycleCallback;
  onDictionaryCacheMiss?: DictionaryCacheLifecycleCallback;
};

/**
 * Combined I18nManager cache lifecycle callbacks
 */
export type I18nManagerCacheLifecycleCallbacks<
  TranslationValue extends Translation,
> = LocalesCacheLifecycleCallbacks<TranslationValue> &
  LocalesDictionaryCacheLifecycleCallbacks;

// ===== Consumer API ===== //

/**
 * Simplified lifecycle callbacks for I18nManager consumers.
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
  onLocalesDictionaryCacheHit?: (params: {
    locale: Locale;
    dictionary: Dictionary;
  }) => void;
  onLocalesDictionaryCacheMiss?: (params: {
    locale: Locale;
    dictionary: Dictionary;
  }) => void;
};
