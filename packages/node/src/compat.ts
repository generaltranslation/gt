// Dictionary (key-based) API. Call initializeGT() before
// initializeGTDictionary().

export {
  getTranslations,
  initializeDictionaryManager as initializeGTDictionary,
} from 'gt-i18n/internal';
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
