import type { Translation } from 'gt-i18n';
import type { LookupOptions } from 'gt-i18n/internal';

// ----- Listeners ----- //

export type Unsubscribe = () => void;
export type StoreListener = () => void;
export type TranslateEventListener = (lookup: TranslateLookup) => void;

// ----- Lookups ----- //

export type TranslateLookup<T extends Translation = Translation> = {
  locale: string;
  message: T;
  options: LookupOptions;
};

// ----- Snapshots ----- //

export type TranslateSnapshot<T extends Translation = Translation> =
  | T
  | undefined;
export type TranslateManySnapshot<T extends Translation = Translation> =
  readonly TranslateSnapshot<T>[];
