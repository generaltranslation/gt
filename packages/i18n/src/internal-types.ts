// I18nManager
export type {
  I18nManagerConstructorParams,
  TranslationsLoader,
  I18nManagerConfig,
  LifecycleCallbacks,
  LocaleResolverConfig,
  ReadonlyConditionStoreInterface,
  WritableConditionStoreInterface,
  ScopedConditionStoreInterface,
  Dictionary,
  DictionaryLoader,
  DictionaryConfig,
} from './i18n-manager/types';
export type { LocaleCandidates } from './condition-store/localeResolver';
export type {
  DictionaryValue,
  DictionaryEntry,
  DictionaryLeaf,
  DictionaryObject,
  DictionaryOptions,
  DictionaryPath,
  DictionaryKey,
} from './i18n-manager/translations-manager/DictionaryCache';
export type { ReadonlyConditionStoreParams } from './condition-store/ReadonlyConditionStore';
export type { WritableConditionStoreParams } from './condition-store/WritableConditionStore';

// Translation Options (Function types exported by /types)
export type * from './translation-functions/types/options';
export type { InlineTranslationOptionsFields } from './translation-functions/types/options';

// Config
export type * from './config/types';

// Internal types
export type { Hash } from './i18n-manager/translations-manager/TranslationsCache';
export type { Locale } from './i18n-manager/translations-manager/LocalesCache';
