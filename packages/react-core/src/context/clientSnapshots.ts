import type { Dictionary, Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

type TranslationsSnapshot = Record<Locale, Record<Hash, Translation>>;
type DictionariesSnapshot = Record<Locale, Dictionary>;

let translationsSnapshot: TranslationsSnapshot = {};
let dictionariesSnapshot: DictionariesSnapshot = {};

export function getClientTranslationsSnapshot(): TranslationsSnapshot {
  return translationsSnapshot;
}

export function getClientDictionariesSnapshot(): DictionariesSnapshot {
  return dictionariesSnapshot;
}

export function setClientSnapshots(
  translations: TranslationsSnapshot,
  dictionaries: DictionariesSnapshot = {}
): void {
  translationsSnapshot = translations;
  dictionariesSnapshot = dictionaries;
}

export type { DictionariesSnapshot, TranslationsSnapshot };
