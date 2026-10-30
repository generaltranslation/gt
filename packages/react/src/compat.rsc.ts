// Dictionary (key-based) API for React Server Components.

import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { getTranslations, type TFunctionType } from 'gt-i18n/internal/compat';
import { use } from 'react';
import type { GTDictionaryProviderProps } from './compat/GTDictionaryProviderProps';

export function GTDictionaryProvider(_props: GTDictionaryProviderProps): never {
  throw new Error(
    createDiagnosticMessage({
      source: 'gt-react',
      severity: 'Error',
      whatHappened:
        'GTDictionaryProvider cannot be consumed via the RSC entry point',
      fix: "Import GTDictionaryProvider from 'gt-react/compat' in a client or server runtime entry point instead.",
    })
  );
}

export function useTranslations(rootId?: string): TFunctionType {
  return use(getTranslations(rootId));
}

export { initializeDictionaryManager as initializeGTDictionary } from 'gt-i18n/internal/compat';
export type { GTDictionaryProviderProps } from './compat/GTDictionaryProviderProps';
export type {
  DictionaryManagerParams as InitializeGTDictionaryParams,
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
