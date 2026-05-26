import type {
  DictionaryEntry,
  DictionaryObject,
  LookupOptions,
  Translation,
} from 'gt-i18n/types';

// ----- Listeners ----- //

export type Unsubscribe = () => void;
export type StoreListener = () => void;
export type ListenerSet = Set<StoreListener>;

// ----- Lookups ----- //

export type TranslateLookup<T extends Translation = Translation> = {
  locale: string;
  message: T;
  options: LookupOptions;
};

export type DictionaryLookup = {
  locale: string;
  id: string;
};
// ----- Snapshots ----- //

export type TranslateSnapshot<T extends Translation = Translation> =
  | T
  | undefined;
export type TranslateManySnapshot<T extends Translation = Translation> =
  readonly TranslateSnapshot<T>[];
export type DictionaryEntrySnapshot = DictionaryEntry | undefined;
export type DictionaryObjectSnapshot = DictionaryObject | undefined;
