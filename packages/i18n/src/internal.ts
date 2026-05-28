export * from './translation-functions/internal';
export * from './i18n-cache';
export * from './translation-functions/utils/interpolation/interpolateIcuMessage';
export * from './helpers';
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
