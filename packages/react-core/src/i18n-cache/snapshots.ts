import {
  getDictionaryEntry,
  hashMessage,
  isDictionaryValue,
} from 'gt-i18n/internal';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Dictionary, DictionaryObject, Translation } from 'gt-i18n/types';
import type { ReactI18nCache } from './ReactI18nCache';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
  TranslateLookup,
  TranslateSnapshot,
} from './types';

export function getTranslationSnapshot<T extends Translation>(
  cache: ReactI18nCache,
  translations: Record<Locale, Record<Hash, Translation>> | undefined,
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const hash = hashMessage(lookup.message, lookup.options);
  return (
    (translations?.[lookup.locale]?.[hash] as TranslateSnapshot<T>) ??
    cache.lookupTranslation<T>(lookup.locale, lookup.message, lookup.options)
  );
}

export function getDictionaryEntrySnapshot(
  cache: ReactI18nCache,
  dictionaries: Record<Locale, Dictionary> | undefined,
  lookup: DictionaryLookup
): DictionaryEntrySnapshot {
  return (
    getDictionaryEntry(lookupDictionaryValue(dictionaries, lookup)) ??
    cache.lookupDictionary(lookup.locale, lookup.id)
  );
}

export function getDictionaryObjectSnapshot(
  cache: ReactI18nCache,
  dictionaries: Record<Locale, Dictionary> | undefined,
  lookup: DictionaryLookup
): DictionaryObjectSnapshot {
  return (
    lookupDictionaryValue(dictionaries, lookup) ??
    cache.lookupDictionaryObj(lookup.locale, lookup.id)
  );
}

function lookupDictionaryValue(
  dictionaries: Record<Locale, Dictionary> | undefined,
  { locale, id }: DictionaryLookup
): DictionaryObjectSnapshot {
  const dictionary = dictionaries?.[locale];
  if (!dictionary) return undefined;
  if (!id) return dictionary;

  let current: DictionaryObject | undefined = dictionary;
  for (const segment of id.split('.')) {
    if (!isSafeDictionaryPathSegment(segment)) return undefined;
    if (!isDictionaryValue(current)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function isSafeDictionaryPathSegment(segment: string): boolean {
  return (
    segment !== '__proto__' &&
    segment !== 'constructor' &&
    segment !== 'prototype'
  );
}
