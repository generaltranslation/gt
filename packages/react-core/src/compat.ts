// Compat: dictionary (key-based) API entrypoint. Only compat modules import
// it, so native CommonJS entries never load the dictionary runtime. It mixes
// context-backed hooks and components, so it is not RSC-safe.

export { CompatStore } from './compat/CompatStore';
export { DictionaryProvider } from './compat/DictionaryProvider';
export type { DictionaryProviderProps } from './compat/DictionaryProvider';
export { useTranslations } from './compat/useTranslations';
export type { UseTranslationsFunction } from './compat/useTranslations';
export type {
  DictionaryLookup,
  OnMissingDictionaryObj,
  OnMissingDictionaryEntry,
} from './compat/types';
