import type { DictionaryEntry, DictionaryObject } from 'gt-i18n';
import type { LookupOptions } from 'gt-i18n/internal';
import type { Content } from '@generaltranslation/format';

// ----- Listeners ----- //

export type Unsubscribe = () => void;
export type StoreListener = () => void;
export type TranslateEventListener = (lookup: TranslateLookup) => void;

// ----- Lookups ----- //

export type TranslateLookup<T extends Content = Content> = {
  locale: string;
  content: T;
  options: LookupOptions;
};

export type DictionaryLookup = {
  locale: string;
  id: string;
};
// ----- Snapshots ----- //

export type TranslateSnapshot<T extends Content = Content> = T | undefined;
export type TranslateManySnapshot<T extends Content = Content> =
  readonly TranslateSnapshot<T>[];
export type DictionaryEntrySnapshot = DictionaryEntry | undefined;
export type DictionaryObjectSnapshot = DictionaryObject | undefined;
