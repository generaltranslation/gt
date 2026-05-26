// I18nCache
export type {
  I18nCacheConstructorParams,
  TranslationsLoader,
  I18nCacheConfig,
  LifecycleCallbacks,
  LocaleResolverConfig,
  ReadonlyConditionStoreInterface,
  WritableConditionStoreInterface,
  ScopedConditionStoreInterface,
  Dictionary,
  DictionaryLoader,
  DictionaryConfig,
} from './i18n-cache/types';
/** @deprecated use I18nCacheConstructorParams instead */
export type { I18nCacheConstructorParams as I18nManagerConstructorParams } from './i18n-cache/types';
/** @deprecated use I18nCacheConfig instead */
export type { I18nCacheConfig as I18nManagerConfig } from './i18n-cache/types';
export type { LocaleCandidates } from './condition-store/localeResolver';
export type {
  DictionaryValue,
  DictionaryEntry,
  DictionaryLeaf,
  DictionaryObject,
  DictionaryOptions,
  DictionaryPath,
  DictionaryKey,
} from './i18n-cache/translations-manager/DictionaryCache';
export type { ReadonlyConditionStoreParams } from './condition-store/ReadonlyConditionStore';
export type { WritableConditionStoreParams } from './condition-store/WritableConditionStore';

// Translation Options (Function types exported by /types)
export type * from './translation-functions/types/options';
export type { InlineTranslationOptionsFields } from './translation-functions/types/options';

// Config
export type * from './config/types';

// Internal types
export type { Hash } from './i18n-cache/translations-manager/TranslationsCache';
export type { Locale } from './i18n-cache/translations-manager/LocalesCache';
