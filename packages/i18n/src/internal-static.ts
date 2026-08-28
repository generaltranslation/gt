export {
  getGT,
  getGTInternal,
  getMessages,
  getMessagesInternal,
  getTranslations,
  getTranslationsInternal,
  createLookupOptions,
  createClientI18nRuntime,
  renderDictionaryEntry,
  renderDictionaryObject,
  ReadonlyConditionStore,
  WritableConditionStore,
  getI18nCache,
  getI18nRuntime,
  isI18nCacheInitialized,
  setI18nCache,
  setI18nRuntime,
  validateDictionaryConfig,
  getVersionId,
  interpolateMessage,
  isEncodedTranslationOptions,
  extractVariables,
  getDictionaryListenerKey,
  getTranslateListenerKey,
  getDictionaryEntry,
  isDictionaryValue,
  getDictionaryValue,
  mergeDictionary,
  resolveDictionaryLookupOptions,
  createConditionStoreSingleton,
  createGlobalSingleton,
  getRuntimeEnvironment,
  hashMessage,
  getCookieValue,
  parseAcceptLanguage,
  createTranslationLoader,
  DEFAULT_CACHE_EXPIRY_TIME,
  dedupePending,
} from './internal';
function ProductionI18nCache(): never {
  throw new Error('I18nCache is not available in production browser builds.');
}

export { ProductionI18nCache as I18nCache };
export { getI18nConfig, I18nConfig, setI18nConfig };

export const GtInternalRuntimeTranslateJsx = () => {};
export const GtInternalRuntimeTranslateString = () => {};

export function initializeI18nConfig(
  params: I18nConfigParams = {}
): I18nConfig {
  const config = new I18nConfig(params);
  setI18nConfig(config);
  return config;
}
import { I18nConfig, type I18nConfigParams } from './i18n-config/I18nConfig';
import {
  getI18nConfig,
  setI18nConfig,
} from './i18n-config/singleton-operations';
