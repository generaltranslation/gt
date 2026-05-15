export * from "./translation-functions/internal";
export * from "./i18n-manager";
export * from "./translation-functions/utils/interpolation/interpolateIcuMessage";
export * from "./helpers";
export { interpolateMessage } from "./translation-functions/utils/interpolation/interpolateMessage";
export { createLookupOptions } from "./translation-functions/internal/helpers";
export { isEncodedTranslationOptions } from "./translation-functions/utils/isEncodedTranslationOptions";
export { extractVariables } from "./utils/extractVariables";
export {
  getDictionaryListenerKey,
  getTranslateListenerKey,
} from "./utils/listenerKeys";
export type {
  DictionaryListenerLookup,
  TranslateListenerLookup,
} from "./utils/listenerKeys";
export {
  getDictionaryEntry,
  isDictionaryValue,
  getDictionaryValue,
  resolveDictionaryLookupOptions,
} from "./i18n-manager/translations-manager/utils/dictionary-helpers";

export {
  getI18nManager,
  setI18nManager,
} from "./i18n-manager/singleton-operations";
export { createConditionStoreSingleton } from "./i18n-manager/condition-store/createConditionStoreSingleton";
