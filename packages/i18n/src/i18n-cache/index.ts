// Classes
export { I18nCache } from './I18nCache';
/** @deprecated use I18nCache instead */
export { I18nCache as I18nManager } from './I18nCache';
export { ReadonlyConditionStore } from '../condition-store/ReadonlyConditionStore';
export type { ReadonlyConditionStoreParams } from '../condition-store/ReadonlyConditionStore';
export { WritableConditionStore } from '../condition-store/WritableConditionStore';
export type { WritableConditionStoreParams } from '../condition-store/WritableConditionStore';
export {
  createLocaleResolver,
  determineSupportedLocale,
  resolveSupportedLocale,
} from '../condition-store/localeResolver';
export type { LocaleCandidates } from '../condition-store/localeResolver';

// Events
export {
  DICTIONARY_CACHE_MISS_EVENT_NAME,
  LOCALES_CACHE_MISS_EVENT_NAME,
  LOCALES_DICTIONARY_CACHE_MISS_EVENT_NAME,
  TRANSLATIONS_CACHE_MISS_EVENT_NAME,
} from './event-subscription/types';

// Functions
export { getI18nCache, setI18nCache } from './singleton-operations';
/** @deprecated use getI18nCache instead */
export { getI18nCache as getI18nManager } from './singleton-operations';
/** @deprecated use setI18nCache instead */
export { setI18nCache as setI18nManager } from './singleton-operations';
