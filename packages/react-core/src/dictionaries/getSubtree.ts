import { Dictionary, DictionaryEntry } from '../types-dir/types';
import { get, set } from './indexDict';

export function getSubtree<T extends Dictionary>({
  dictionary,
  id,
}: {
  dictionary: T;
  id: string;
}): Dictionary | DictionaryEntry | undefined {
  if (id === '') {
    return dictionary;
  }

  let current: Dictionary | DictionaryEntry = dictionary;
  const dictionaryPath = id.split('.');
  for (const key of dictionaryPath) {
    current = get(current as Dictionary, key);
  }
  return current;
}

/**
 * @description A function that gets a subtree from a dictionary
 * @param dictionary - new dictionary to get the subtree from
 * @param id - id of the subtree to get
 * @param sourceDictionary - source dictionary to model off of
 * @returns
 */
export function getSubtreeWithCreation<T extends Dictionary>({
  dictionary,
  id,
  sourceDictionary,
}: {
  dictionary: T;
  id: string;
  sourceDictionary: T;
}): Dictionary | DictionaryEntry | undefined {
  if (id === '') {
    return dictionary;
  }

  let current: Dictionary | DictionaryEntry = dictionary;
  const sourceCurrent: Dictionary | DictionaryEntry = sourceDictionary;
  const dictionaryPath = id.split('.');
  for (const key of dictionaryPath) {
    if (get(current as Dictionary, key) === undefined) {
      // We know this wont be type Dictionary because we should have already checked for that
      if (Array.isArray(get(sourceCurrent as Dictionary, key))) {
        set(current as Dictionary, key, [] as Dictionary);
      } else {
        set(current as Dictionary, key, {} as Dictionary);
      }
    }
    current = get(current as Dictionary, key);
  }
  return current;
}
