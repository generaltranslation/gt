import { createDiagnosticMessage } from 'generaltranslation/internal';
import { I18nConfig, type I18nConfigParams } from './i18n-config/I18nConfig';
import {
  getI18nConfig,
  setI18nConfig,
} from './i18n-config/singleton-operations';

const i18nCacheUnavailableError = createDiagnosticMessage({
  source: 'gt-i18n',
  severity: 'Error',
  whatHappened: 'I18nCache is not available in production browser builds',
  why: 'production browser builds use the lightweight client runtime',
  fix: 'Use translations supplied by your framework provider instead.',
});

const runtimeTranslationUnavailableError = createDiagnosticMessage({
  source: 'gt-i18n',
  severity: 'Error',
  whatHappened:
    'Runtime translation is not available in production browser builds',
  why: 'it requires the full i18n cache and service runtime',
  fix: 'Use preloaded translations or perform runtime translation on the server.',
});

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
  throw new Error(i18nCacheUnavailableError);
}

export { ProductionI18nCache as I18nCache };
export { getI18nConfig, I18nConfig, setI18nConfig };

async function unavailableRuntimeTranslation(): Promise<never> {
  throw new Error(runtimeTranslationUnavailableError);
}

export const tx: typeof import('./translation-functions/internal/tx').tx =
  unavailableRuntimeTranslation;
export const txInternal: typeof import('./translation-functions/internal/tx').txInternal =
  unavailableRuntimeTranslation;

export const GtInternalRuntimeTranslateJsx = () => {};
export const GtInternalRuntimeTranslateString = () => {};

export function initializeI18nConfig(
  params: I18nConfigParams = {}
): I18nConfig {
  const config = new I18nConfig(params);
  setI18nConfig(config);
  return config;
}
