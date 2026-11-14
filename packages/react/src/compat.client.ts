'use client';

// Dictionary (key-based) API for the browser runtime.

export { BrowserGTProvider as GTProvider } from './compat/BrowserGTProvider';
export type { GTProviderProps } from './compat/GTProviderProps';
export { useTranslations } from '@generaltranslation/react-core/compat';
export { initializeDictionaryManager as initializeGTDictionary } from 'gt-i18n/internal/compat';
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
