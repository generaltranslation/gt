'use client';

// Dictionary (key-based) API for the browser runtime.

export { BrowserDictionaryProvider as GTDictionaryProvider } from './compat/BrowserDictionaryProvider';
export type { GTDictionaryProviderProps } from './compat/GTDictionaryProviderProps';
export { useTranslations } from '@generaltranslation/react-core/compat';
export type { UseTranslationsFunction } from '@generaltranslation/react-core/compat';
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
