// I18nManager
export type {
  I18nManagerConstructorParams,
  TranslationsLoader,
  I18nManagerConfig,
  LifecycleCallbacks,
  ConditionStoreConfig,
  ConditionStore,
  WritableConditionStore,
  ScopedConditionStore,
  Dictionary,
  DictionaryLoader,
} from './i18n-manager/types';
export type { LocaleCandidates } from './i18n-manager/condition-store/localeResolver';
export type {
  DictionaryValue,
  DictionaryPath,
  DictionaryKey,
} from './i18n-manager/translations-manager/DictionaryCache';

// Translation Options (Function types exported by /types)
export type * from './translation-functions/types/options';

// Config
export type * from './config/types';
