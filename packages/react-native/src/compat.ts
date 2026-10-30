// Dictionary (key-based) API.

export { GTProvider, type GTProviderProps } from './compat/GTProvider';
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
