import type { Dictionary, DictionaryEntry } from '../types';
import { get, set } from './indexDict';
import { isDictionaryEntry } from './isDictionaryEntry';

const DANGEROUS_KEYS = ['constructor', 'prototype', '__proto__'];
function isDangerousKey(key: string): boolean {
  if (DANGEROUS_KEYS.includes(key)) {
    return true;
  }
  return false;
}

/**
 * @description Injects an entry into a translations object
 * @param translations - The translations object to inject the entry into
 * @param entry - The entry to inject
 * @param hash - The hash of the entry
 * @param sourceDictionary - The source dictionary to model the new dictionary after
 */
export function injectEntry(
  dictionaryEntry: DictionaryEntry,
  dictionary: Dictionary | DictionaryEntry,
  id: string,
  sourceDictionary: Dictionary | DictionaryEntry
) {
  // If the dictionary is a DictionaryEntry, return it
  if (isDictionaryEntry(dictionary)) {
    return dictionaryEntry;
  }

  // Iterate over all but last key
  const keys = id.split('.');
  keys.forEach((key) => {
    if (isDangerousKey(key)) {
      throw new Error(`Invalid key: ${key}`);
    }
  });
  dictionary ||= {};
  for (const key of keys.slice(0, -1)) {
    // Create new value if it doesn't exist
    if (get(dictionary, key) == null) {
      set(
        dictionary,
        key,
        Array.isArray(get(sourceDictionary as Dictionary, key))
          ? []
          : ({} as Dictionary)
      );
    }
    // Iterate
    dictionary = get(dictionary, key) as Dictionary;
    sourceDictionary = get(sourceDictionary as Dictionary, key) as Dictionary;
  }
  // Inject the entry into the last key
  const lastKey = keys[keys.length - 1];
  set(dictionary, lastKey, dictionaryEntry);
}
