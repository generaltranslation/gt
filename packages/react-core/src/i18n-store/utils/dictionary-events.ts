import { getDictionaryListenerKey } from 'gt-i18n/internal';
import type { DictionaryLookup } from '../storeTypes';

function getDictionaryLookupFromKey(lookupKey: string): DictionaryLookup {
  const separatorIndex = lookupKey.indexOf(':');
  return {
    locale: lookupKey.slice(0, separatorIndex),
    id: lookupKey.slice(separatorIndex + 1),
  };
}

export function dictionaryEntryEventMatchesLookup(
  event: DictionaryLookup,
  lookupKey: string
): boolean {
  return getDictionaryListenerKey(event) === lookupKey;
}

export function dictionaryObjectEventMatchesLookup(
  event: DictionaryLookup,
  lookupKey: string
): boolean {
  const { locale, id } = getDictionaryLookupFromKey(lookupKey);
  if (locale !== event.locale) {
    return false;
  }
  return id === '' || event.id === id || event.id.startsWith(`${id}.`);
}
