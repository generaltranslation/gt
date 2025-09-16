import { Dictionary, DictionaryEntry } from '../types/types';
import { isDictionaryEntry } from './isDictionaryEntry';

/**
 * @description Injects an entry into a translations object
 * @param translations - The translations object to inject the entry into
 * @param entry - The entry to inject
 * @param hash - The hash of the entry
 */
export function injectEntry(
  dictionaryEntry: DictionaryEntry,
  dictionary: Dictionary | DictionaryEntry,
  id: string
) {
  // If the dictionary is a DictionaryEntry, return it
  if (isDictionaryEntry(dictionary)) {
    return dictionaryEntry;
  }

  // Iterate over all but last key
  const keys = id.split('.');
  dictionary ||= {};
  for (const key of keys.slice(0, -1)) {
    // Create new value if it doesn't exist
    if (dictionary[key] == null) {
      dictionary[key] = {} as Dictionary;
    }
    // Iterate
    dictionary = dictionary[key] as Dictionary;
  }
  // Inject the entry into the last key
  const lastKey = keys[keys.length - 1];
  dictionary[lastKey] = dictionaryEntry;
}
