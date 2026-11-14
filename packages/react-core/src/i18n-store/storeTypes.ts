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

// ----- Snapshots ----- //

export type TranslateSnapshot<T extends Content = Content> = T | undefined;
export type TranslateManySnapshot<T extends Content = Content> =
  readonly TranslateSnapshot<T>[];
