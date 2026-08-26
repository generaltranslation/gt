import type { Dictionary, Hash, Locale } from 'gt-i18n/internal/types';
import type { LookupOptions } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import type { StringContent } from 'generaltranslation/types';
import {
  lookupDictionaryEntry,
  lookupDictionaryObject,
} from '../i18n-store/utils/dictionaries';
import type {
  DictionaryEntrySnapshot,
  DictionaryObjectSnapshot,
} from '../i18n-store/storeTypes';
import { lookupTranslation } from '../i18n-store/utils/translations';

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

export function lookupClientTranslation(
  locale: string,
  message: StringContent,
  options: LookupOptions
): StringContent | undefined {
  return lookupTranslation(translationsSnapshot, {
    locale,
    message,
    options,
  });
}

export function lookupClientDictionaryEntry(
  locale: string,
  id: string
): DictionaryEntrySnapshot {
  return lookupDictionaryEntry(dictionariesSnapshot, { locale, id });
}

export function lookupClientDictionaryObject(
  locale: string,
  id: string
): DictionaryObjectSnapshot {
  return lookupDictionaryObject(dictionariesSnapshot, { locale, id });
}

export type { DictionariesSnapshot, TranslationsSnapshot };
