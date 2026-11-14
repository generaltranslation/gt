'use client';

// The dictionary (key-based) API for server rendering, including the Pages
// Router: GTProvider and the page props helpers add dictionaries for
// useTranslations(). Initializes GT like the root entry it extends.
import { initializeGT } from './setup/initGT';
initializeGT();

export { GTProvider, type GTProviderProps } from 'gt-react/compat';
export {
  withGTServerSideProps,
  withGTStaticProps,
  type WithGTServerSideProps,
  type WithGTStaticProps,
} from './compat/pages';
export { useTranslations } from 'gt-react/compat';
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
