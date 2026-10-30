export { getGT, getGTInternal } from './translation-functions/internal/getGT';
export {
  getMessages,
  getMessagesInternal,
} from './translation-functions/internal/getMessages';
export { tx, txInternal } from './translation-functions/internal/tx';
export {
  GtInternalRuntimeTranslateString,
  GtInternalRuntimeTranslateJsx,
} from './translation-functions/internal/runtime-translate';
export { createLookupOptions } from './translation-functions/internal/helpers';
export { I18nCache } from './i18n-cache/I18nCache';
export type { TranslationsCacheMissEvent } from './i18n-cache/I18nCache';
export { ReadonlyConditionStore } from './condition-store/ReadonlyConditionStore';
export type { ReadonlyConditionStoreParams } from './condition-store/ReadonlyConditionStore';
export { WritableConditionStore } from './condition-store/WritableConditionStore';
export type { WritableConditionStoreParams } from './condition-store/WritableConditionStore';
export type { LocaleCandidates } from './i18n-config/I18nConfig';
export { getI18nCache, setI18nCache } from './i18n-cache/singleton-operations';
export { interpolateMessage } from './translation-functions/utils/interpolation/interpolateMessage';
export { extractVariables } from './utils/extractVariables';
export { getTranslateListenerKey } from './utils/listenerKeys';
export type { TranslateListenerLookup } from './utils/listenerKeys';

export {
  getI18nConfig,
  initializeI18nConfig,
  setI18nConfig,
} from './i18n-config/singleton-operations';
export { I18nConfig } from './i18n-config/I18nConfig';
export type { I18nConfigParams } from './i18n-config/I18nConfig';
export { createConditionStoreSingleton } from './condition-store/createConditionStoreSingleton';
export { createGlobalSingleton } from './globals/createGlobalSingleton';
export type { GlobalSingleton } from './globals/createGlobalSingleton';
export { getRuntimeEnvironment } from './utils/getRuntimeEnvironment';
export { hashMessage } from './utils/hashMessage';
export { parseAcceptLanguage } from './utils/request';

export type {
  I18nCacheConstructorParams,
  I18nCacheConfig,
  LocaleResolverConfig,
  ReadonlyConditionStoreInterface,
  WritableConditionStoreInterface,
  ScopedConditionStoreInterface,
  AsyncReadonlyConditionStoreInterface,
} from './i18n-cache/types';
export type { TranslationsLoader } from './i18n-cache/translations-manager/translations-loaders/types';
export type {
  LookupOptions,
  NormalizedLookupOptions,
  TranslationMetadata,
  TranslationOptions,
} from './translation-functions/types/options';
export type {
  Hash,
  Locale,
} from './i18n-cache/translations-manager/TranslationsCache';

// ===== Compat: dictionary (key-based) API ===== //
export {
  getTranslations,
  getTranslationsInternal,
} from './compat/getTranslations';
export { renderDictionaryEntry } from './compat/renderDictionaryEntry';
export { renderDictionaryObject } from './compat/renderDictionaryObject';
export { getDictionaryListenerKey } from './compat/listenerKeys';
export type { DictionaryListenerLookup } from './compat/listenerKeys';
export {
  getDictionaryEntry,
  isDictionaryValue,
  getDictionaryValue,
  resolveDictionaryLookupOptions,
} from './compat/dictionary-helpers';
export { DictionaryManager } from './compat/DictionaryManager';
export type { DictionaryManagerParams } from './compat/DictionaryManager';
export {
  getDictionaryManager,
  setDictionaryManager,
  isDictionaryManagerInitialized,
  initializeDictionaryManager,
} from './compat/singleton-operations';
export type {
  DictionaryConfig,
  DictionaryLoader,
  DictionaryLookupOptions,
} from './compat/types';
