// Dictionary (key-based) API. The dictionary and its loader come from the
// gtTanstackStart() Vite plugin.
import { getServerConditionStore } from './setup/initializeGT.server';
import { ensureDictionaryManager } from './compat/dictionaryManager.server';
import { createGetTranslations } from './compat/runtime';

/**
 * Return a dictionary translation function for the current locale. Use it in
 * loaders, `head` data and server functions; in components, use
 * `useTranslations()`.
 */
export const getTranslations = /* @__PURE__ */ createGetTranslations(
  getServerConditionStore,
  ensureDictionaryManager
);

export { useTranslations, type UseTranslationsFunction } from 'gt-react/compat';
export { setupRouterGTDictionaryIntegration } from './compat/setupRouterGTDictionaryIntegration.server';
export type {
  Dictionary,
  DictionaryEntry,
  DictionaryEntryOptions,
  DictionaryKey,
  DictionaryLeaf,
  DictionaryLoader,
  DictionaryObject,
  DictionaryObjectTranslation,
  DictionaryPath,
  DictionaryValue,
  TFunctionType,
} from 'gt-i18n/internal/compat';
