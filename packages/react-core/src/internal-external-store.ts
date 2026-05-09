export {
  useCustomMapping,
  useDefaultLocale,
  useDictionaryEntry,
  useDictionaryObject,
  useEnableI18n,
  useI18nExternalStore,
  useI18nManager,
  useLocales,
  useTranslate,
  useTranslateMany,
} from './external-store/hooks/i18n-manager-hooks';
export {
  I18nExternalStore,
  type I18nExternalStoreParams,
} from './external-store/store/I18nExternalStore';
export {
  ProviderConditionStore,
  type ProviderConditionStoreParams,
} from './external-store/store/ProviderConditionStore';
export {
  getI18nExternalStore,
  setI18nExternalStore,
} from './external-store/store/singleton-operations';
export type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  I18nExternalConditionStore,
  ListenerSet,
  StoreListener,
  TranslateLookup,
  TranslateManySnapshot,
  TranslateSnapshot,
  Unsubscribe,
} from './external-store/store/storeTypes';
