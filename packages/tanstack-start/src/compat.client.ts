// Dictionary (key-based) API. The dictionary and its loader come from the
// gtTanstackStart() Vite plugin.
import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { ensureDictionaryManager } from './compat/dictionaryManager.client';
import { createGetTranslations } from './compat/runtime';

/**
 * Return a dictionary translation function for the current locale. Use it in
 * loaders, `head` data and server functions; in components, use
 * `useTranslations()`.
 */
export const getTranslations = /* @__PURE__ */ createGetTranslations(
  getReadonlyConditionStore,
  ensureDictionaryManager
);

export { useTranslations } from 'gt-react/compat';
export { setupRouterGTIntegration } from './compat/setupRouterGTIntegration.client';
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
