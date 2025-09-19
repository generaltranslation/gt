import { Dictionary, DictionaryEntry } from '../types/types';
import { get } from './indexDict';

export function isValidDictionaryEntry(
  value: unknown
): value is DictionaryEntry {
  if (typeof value !== 'object' || value === null) {
    return true;
  }

  if (Array.isArray(value)) {
    if (typeof value?.[0] === 'object' && value?.[0] !== null) {
      return false;
    }
    const provisionalMetadata = value?.[1];
    if (typeof provisionalMetadata === 'undefined') return true;
    if (provisionalMetadata && typeof provisionalMetadata === 'object')
      return true;
  }

  return false;
}

export function getDictionaryEntry<T extends Dictionary>(
  dictionary: T,
  id: string
): Dictionary | DictionaryEntry | undefined {
  let current: Dictionary | DictionaryEntry = dictionary;
  const dictionaryPath = id.split('.');
  for (const key of dictionaryPath) {
    if (typeof current !== 'object' && !Array.isArray(current)) {
      return undefined;
    }
    current = get(current as Dictionary, key);
  }
  return current;
}
