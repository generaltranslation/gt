// Classes
export { I18nManager } from "./I18nManager";
export { createConditionStoreSingleton } from "./condition-store/createConditionStoreSingleton";
export { ReadonlyConditionStore } from "./condition-store/ReadonlyConditionStore";
export type { ReadonlyConditionStoreParams } from "./condition-store/ReadonlyConditionStore";
export { WritableConditionStore } from "./condition-store/WritableConditionStore";
export type { WritableConditionStoreParams } from "./condition-store/WritableConditionStore";
export {
  createLocaleResolver,
  determineSupportedLocale,
  resolveSupportedLocale,
} from "./condition-store/localeResolver";
export type { LocaleCandidates } from "./condition-store/localeResolver";

// Events
export {
  DICTIONARY_CACHE_MISS_EVENT_NAME,
  LOCALES_CACHE_MISS_EVENT_NAME,
  LOCALES_DICTIONARY_CACHE_MISS_EVENT_NAME,
  TRANSLATIONS_CACHE_MISS_EVENT_NAME,
} from "./event-subscription/types";

// Functions
export {
  getI18nManager,
  setI18nManager,
  setConditionStore,
} from "./singleton-operations";
