'use client';

// Dictionary (key-based) API for the browser. Client components read dictionaries
// from the RSC GTDictionaryProvider. Initializes GT like the root entry it
// extends.
import { initializeGTClient } from './setup/initGT.client';
initializeGTClient();

export { GTDictionaryProvider } from './compat/clientGTDictionaryProvider';
export type { GTDictionaryProviderProps } from './compat/GTDictionaryProvider';
export { useTranslations, type UseTranslationsFunction } from 'gt-react/compat';
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
} from 'gt-i18n/internal/compat';
