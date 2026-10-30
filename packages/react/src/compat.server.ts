'use client';

// Dictionary (key-based) API for server-rendered React runtimes. Like the
// root server entry, it must be consumed as a client boundary by React Server
// Component frameworks.

export { ServerGTProvider as GTProvider } from './compat/ServerGTProvider';
export type { GTProviderProps } from './compat/GTProviderProps';
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
