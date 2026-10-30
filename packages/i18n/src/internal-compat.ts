// Compat: dictionary (key-based) API internals. Only compat modules import
// this entry, so native CommonJS entries never load the dictionary runtime.

export {
  getTranslations,
  getTranslationsInternal,
} from './compat/getTranslations';
export { renderDictionaryEntry } from './compat/renderDictionaryEntry';
export { renderDictionaryObject } from './compat/renderDictionaryObject';
export { getDictionaryListenerKey } from './compat/listenerKeys';
export type { DictionaryListenerLookup } from './compat/listenerKeys';
export {
  getDictionaryEntry,
  isDictionaryValue,
  getDictionaryValue,
  resolveDictionaryLookupOptions,
} from './compat/dictionary-helpers';
export { DictionaryManager } from './compat/DictionaryManager';
export type { DictionaryManagerParams } from './compat/DictionaryManager';
export {
  getDictionaryManager,
  setDictionaryManager,
  isDictionaryManagerInitialized,
  initializeDictionaryManager,
} from './compat/singleton-operations';
export type {
  Dictionary,
  DictionaryConfig,
  DictionaryEntry,
  DictionaryEntryOptions,
  DictionaryKey,
  DictionaryLeaf,
  DictionaryLoader,
  DictionaryLookupOptions,
  DictionaryObject,
  DictionaryObjectTranslation,
  DictionaryPath,
  DictionaryValue,
  TFunctionType,
} from './compat/types';
