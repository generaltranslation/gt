// Classes
export { I18nManager } from './I18nManager';
export { createConditionStoreSingleton } from './condition-store/createConditionStoreSingleton';
export {
  createLocaleResolver,
  determineSupportedLocale,
  resolveSupportedLocale,
} from './condition-store/localeResolver';
export type { LocaleCandidates } from './condition-store/localeResolver';

// Functions
export {
  getCurrentLocale,
  getI18nManager,
  setI18nManager,
  setConditionStore,
} from './singleton-operations';
