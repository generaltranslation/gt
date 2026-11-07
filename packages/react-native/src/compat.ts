// Dictionary (key-based) API.

export { GTProvider, type GTProviderProps } from './compat/GTProvider';
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
