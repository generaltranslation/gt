import type { Translation } from '../translations-manager/utils/types/translation-data';
import type {
  TranslationKey,
  Hash,
} from '../translations-manager/TranslationsCache';
import type { Locale, CacheEntry } from '../translations-manager/LocalesCache';

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

// ===== Consumer API ===== //

/**
 * Simplified lifecycle callbacks for I18nManager consumers.
 * These provide a cleaner interface than the internal cache lifecycle types,
 * with locale and hash exposed directly instead of the full cache internals.
 */
export type LifecycleCallbacks<TranslationValue extends Translation> = {
  onTranslationsCacheHit?: (params: {
    locale: Locale;
    hash: Hash;
    value: TranslationValue;
  }) => void;
  onTranslationsCacheMiss?: (params: {
    locale: Locale;
    hash: Hash;
    value: TranslationValue;
  }) => void;
  onLocalesCacheHit?: (params: {
    locale: Locale;
    value: Record<Hash, TranslationValue>;
  }) => void;
  onLocalesCacheMiss?: (params: {
    locale: Locale;
    value: Record<Hash, TranslationValue>;
  }) => void;
};
