// Dictionary (key-based) API for React Server Components. Initializes GT
// like the root entry it extends.
import { initializeGTServer } from './setup/initGT.server';
initializeGTServer();

export {
  GTDictionaryProvider,
  type GTDictionaryProviderProps,
} from './compat/GTDictionaryProvider';
export { useTranslations } from './compat/getTranslations';
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
