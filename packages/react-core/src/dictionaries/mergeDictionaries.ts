import { Dictionary, DictionaryEntry } from '../types/types';
import { get } from './indexDict';
import { isDictionaryEntry } from './isDictionaryEntry';

const isPrimitiveOrArray = (value: unknown): boolean =>
  typeof value === 'string' || Array.isArray(value);

const isObjectDictionary = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export default function mergeDictionaries(
  defaultLocaleDictionary: Dictionary,
  localeDictionary: Dictionary
): Dictionary {
  if (Array.isArray(defaultLocaleDictionary)) {
    return defaultLocaleDictionary.map((value, key) => {
      // Merge Dictionary Entry
      if (isDictionaryEntry(value)) {
        return (localeDictionary as (Dictionary | DictionaryEntry)[])[key];
      }
      // Merge Dictionary
      return mergeDictionaries(
        value as Dictionary,
        (localeDictionary as (Dictionary | DictionaryEntry)[])[
          key
        ] as Dictionary
      );
    });
  }
  // Merge primitive and array values
  const mergedDictionary: Dictionary = {
    ...Object.fromEntries(
      Object.entries(defaultLocaleDictionary).filter(([, value]) =>
        isPrimitiveOrArray(value)
      )
    ),
    ...Object.fromEntries(
      Object.entries(localeDictionary).filter(([, value]) =>
        isPrimitiveOrArray(value)
      )
    ),
  };

  // Get nested dictionaries
  const defaultDictionaryKeys = Object.entries(defaultLocaleDictionary)
    .filter(([, value]) => isObjectDictionary(value))
    .map(([key]) => key);

  const localeDictionaryKeys = Object.entries(localeDictionary)
    .filter(([, value]) => isObjectDictionary(value))
    .map(([key]) => key);

  // Merge nested dictionaries recursively
  const allKeys = new Set([...defaultDictionaryKeys, ...localeDictionaryKeys]);
  for (const key of allKeys) {
    mergedDictionary[key] = mergeDictionaries(
      (get(defaultLocaleDictionary, key) || {}) as Dictionary,
      (get(localeDictionary, key) || {}) as Dictionary
    );
  }

  return mergedDictionary;
}
