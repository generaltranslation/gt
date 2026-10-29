'use client';

// Dictionary (key-based) API for the browser runtime.

export { BrowserGTProvider as GTProvider } from './compat/BrowserGTProvider';
export type { GTProviderProps } from './compat/GTProviderProps';
export { useTranslations } from '@generaltranslation/react-core/hooks';
export type { UseTranslationsFunction } from '@generaltranslation/react-core/hooks';
export { initializeDictionaryManager as initializeGTDictionary } from 'gt-i18n/internal';
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
} from 'gt-i18n/internal';
