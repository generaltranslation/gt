import type { DictionaryEntry, DictionaryObject } from 'gt-i18n';

export type DictionaryLookup = {
  locale: string;
  id: string;
};

export type DictionaryStoreListener = (event: DictionaryLookup) => void;

export type DictionaryEntrySnapshot = DictionaryEntry | undefined;
export type DictionaryObjectSnapshot = DictionaryObject | undefined;

export type OnMissingDictionaryEntry = (lookup: DictionaryLookup) => void;
// TODO: rename to OnMissingDictionaryObject
export type OnMissingDictionaryObj = (lookup: DictionaryLookup) => void;
