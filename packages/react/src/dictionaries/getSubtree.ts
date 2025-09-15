import { Dictionary, DictionaryEntry } from '../types/types';

export function getSubtree<T extends Dictionary>(
  dictionary: T,
  id: string
): Dictionary | DictionaryEntry | undefined {
  let current: Dictionary | DictionaryEntry = dictionary;
  const dictionaryPath = id.split('.');
  for (const key of dictionaryPath) {
    current = (current as Dictionary)[key];
  }
  return current;
}
