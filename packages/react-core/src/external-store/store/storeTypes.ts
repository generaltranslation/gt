import type {
  DictionaryEntry,
  DictionaryObject,
  LookupOptions,
  Translation,
} from 'gt-i18n/types';

export type Unsubscribe = () => void;
export type StoreListener = () => void;
export type ListenerSet = Set<StoreListener>;

export type I18nExternalConditionStore = {
  getLocale(): string;
  subscribeToLocale(listener: StoreListener): Unsubscribe;
  setLocale?(locale: string): void;
  getRegion?(): string | undefined;
  subscribeToRegion?(listener: StoreListener): Unsubscribe;
  setRegion?(region: string | undefined): void;
};

export type TranslationLookup<T extends Translation = Translation> = {
  locale: string;
  message: T;
  options: LookupOptions;
};

export type DictionaryLookup = {
  locale: string;
  id: string;
};

export type TranslationSnapshot<T extends Translation = Translation> =
  | T
  | undefined;
export type DictionaryEntrySnapshot = DictionaryEntry | undefined;
export type DictionaryObjectSnapshot = DictionaryObject | undefined;
