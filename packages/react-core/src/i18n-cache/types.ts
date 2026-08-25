import type { LookupOptions } from 'gt-i18n/internal/types';
import type {
  DictionaryEntry,
  DictionaryObject,
  Translation,
} from 'gt-i18n/types';

export type TranslateLookup<T extends Translation = Translation> = {
  locale: string;
  message: T;
  options: LookupOptions;
};

export type DictionaryLookup = {
  locale: string;
  id: string;
};

export type TranslateSnapshot<T extends Translation = Translation> =
  | T
  | undefined;
export type DictionaryEntrySnapshot = DictionaryEntry | undefined;
export type DictionaryObjectSnapshot = DictionaryObject | undefined;
