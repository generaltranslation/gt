import type { Locale } from 'gt-i18n/internal';
import {
  getDictionaryEntry,
  isDictionaryValue,
  type Dictionary,
  type DictionaryObject,
} from 'gt-i18n/internal/compat';
import type {
  DictionaryEntrySnapshot,
  DictionaryLookup,
  DictionaryObjectSnapshot,
} from './types';

export function lookupDictionaryEntry(
  dictionariesSnapshot: Record<Locale, Dictionary> | undefined,
  lookup: DictionaryLookup
): DictionaryEntrySnapshot {
  return getDictionaryEntry(
    lookupDictionaryValue(dictionariesSnapshot, lookup)
  );
}

export function lookupDictionaryObject(
  dictionariesSnapshot: Record<Locale, Dictionary> | undefined,
  lookup: DictionaryLookup
): DictionaryObjectSnapshot {
  return lookupDictionaryValue(dictionariesSnapshot, lookup);
}

function lookupDictionaryValue(
  dictionariesSnapshot: Record<Locale, Dictionary> | undefined,
  { locale, id }: DictionaryLookup
): DictionaryObjectSnapshot {
  const dictionary = dictionariesSnapshot?.[locale];
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
