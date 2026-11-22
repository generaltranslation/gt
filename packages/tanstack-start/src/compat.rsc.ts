// Dictionary (key-based) API for server components. The dictionary and its
// loader come from the gtTanstackStart() Vite plugin.
import { use } from 'react';
import type { TFunctionType } from 'gt-i18n/internal/compat';
import { getServerConditionStore } from 'gt-tanstack-start/internal/initializeGT.server';
import { ensureDictionaryManager } from './compat/dictionaryManager.server';
import { createGetTranslations } from './compat/runtime';

/**
 * Return a dictionary translation function for the current locale. Use it in
 * loaders, `head` data, server functions and async server components.
 */
export const getTranslations = /* @__PURE__ */ createGetTranslations(
  getServerConditionStore,
  ensureDictionaryManager
);

/** Returns a dictionary translation function for the request locale once its dictionaries load. */
export function useTranslations(rootId?: string): TFunctionType {
  return use(getTranslations(rootId));
}

export { setupRouterGTIntegration } from './rsc/setupRouterGTIntegration';
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
