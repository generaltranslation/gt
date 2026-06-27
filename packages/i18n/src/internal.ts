export { getGT, getGTInternal } from './translation-functions/internal/getGT';
export {
  getMessages,
  getMessagesInternal,
} from './translation-functions/internal/getMessages';
export {
  getTranslations,
  getTranslationsInternal,
} from './translation-functions/internal/getTranslations';
export { tx, txInternal } from './translation-functions/internal/tx';
export {
  GtInternalRuntimeTranslateString,
  GtInternalRuntimeTranslateJsx,
} from './translation-functions/internal/runtime-translate';
export {
  resolveTranslationSync,
  resolveTranslationSyncWithFallback,
} from './translation-functions/internal/sync-translation-resolution';
export { resolveJsxTranslation } from './translation-functions/internal/jsx-resolution';
export {
  resolveJsx,
  resolveJsxWithFallback,
  resolveJsxWithRuntimeFallback,
  resolveStringContent,
  resolveStringContentWithFallback,
  resolveStringContentWithRuntimeFallback,
  createLookupOptions,
} from './translation-functions/internal/helpers';
export { renderDictionaryEntry } from './translation-functions/internal/renderDictionaryEntry';
export { renderDictionaryObject } from './translation-functions/internal/renderDictionaryObject';
export { I18nCache } from './i18n-cache/I18nCache';
export { ReadonlyConditionStore } from './condition-store/ReadonlyConditionStore';
export type { ReadonlyConditionStoreParams } from './condition-store/ReadonlyConditionStore';
export { WritableConditionStore } from './condition-store/WritableConditionStore';
export type { WritableConditionStoreParams } from './condition-store/WritableConditionStore';
export {
  createLocaleResolver,
  determineSupportedLocale,
  resolveSupportedLocale,
} from './condition-store/localeResolver';
export type { LocaleCandidates } from './i18n-config/I18nConfig';
export {
  DICTIONARY_CACHE_MISS_EVENT_NAME,
  LOCALES_CACHE_MISS_EVENT_NAME,
  LOCALES_DICTIONARY_CACHE_MISS_EVENT_NAME,
  TRANSLATIONS_CACHE_MISS_EVENT_NAME,
} from './i18n-cache/event-subscription/types';
export { getI18nCache, setI18nCache } from './i18n-cache/singleton-operations';
export { interpolateIcuMessage } from './translation-functions/utils/interpolation/interpolateIcuMessage';
export {
  getLocale,
  getRegion,
  getLocales,
  getDefaultLocale,
  getLocaleProperties,
  getGTClass,
} from './helpers/locale';
export { getVersionId } from './helpers/versionId';
export { interpolateMessage } from './translation-functions/utils/interpolation/interpolateMessage';
export { createLookupOptions } from './translation-functions/internal/helpers';
export { isEncodedTranslationOptions } from './translation-functions/utils/isEncodedTranslationOptions';
export { extractVariables } from './utils/extractVariables';
export {
  getDictionaryListenerKey,
  getTranslateListenerKey,
} from './utils/listenerKeys';
export type {
  DictionaryListenerLookup,
  TranslateListenerLookup,
} from './utils/listenerKeys';
export {
  getDictionaryEntry,
  isDictionaryValue,
  getDictionaryValue,
  resolveDictionaryLookupOptions,
} from './i18n-cache/translations-manager/utils/dictionary-helpers';
export {
  getGTServicesEnabled,
  setupGTServicesEnabled,
} from './globals/getGTServicesEnabled';

/** @deprecated use I18nCache instead */
export { I18nCache as I18nManager } from './i18n-cache/I18nCache';
export { getI18nCache, setI18nCache } from './i18n-cache/singleton-operations';
export {
  getI18nConfig,
  initializeI18nConfig,
  isI18nConfigInitialized,
  setI18nConfig,
} from './i18n-config/singleton-operations';
export { I18nConfig } from './i18n-config/I18nConfig';
export type { I18nConfigParams } from './i18n-config/I18nConfig';
/** @deprecated use getI18nCache instead */
export { getI18nCache as getI18nManager } from './i18n-cache/singleton-operations';
/** @deprecated use setI18nCache instead */
export { setI18nCache as setI18nManager } from './i18n-cache/singleton-operations';
export { createConditionStoreSingleton } from './condition-store/createConditionStoreSingleton';
export { getRuntimeEnvironment } from './utils/getRuntimeEnvironment';
export { hashMessage } from './utils/hashMessage';
