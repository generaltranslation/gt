import type { Dictionary, DictionaryEntry } from '../types';

const isPrimitiveOrArray = (value: unknown): boolean =>
  typeof value === 'string' || Array.isArray(value);

const isObjectDictionary = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDictionaryEntry = (
  value: Dictionary | DictionaryEntry | undefined
): value is DictionaryEntry => {
  if (value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return true;
  }

  if (Array.isArray(value)) {
    if (value.length !== 1 && value.length !== 2) {
      return false;
    }

    if (typeof value[0] !== 'string') {
      return false;
    }

    return (
      value.length === 1 ||
      (typeof value[1] === 'object' &&
        value[1] !== null &&
        ('$context' in value[1] ||
          '$maxChars' in value[1] ||
          '$_hash' in value[1]))
    );
  }

  return false;
};

const get = (dictionary: Dictionary, id: string | number) => {
  if (dictionary == null) {
    throw new Error('Cannot index into an undefined dictionary');
  }
  if (Array.isArray(dictionary)) {
    return dictionary[id as unknown as number];
  }
  return dictionary[id as string];
};

export default function mergeDictionaries(
  defaultLocaleDictionary: Dictionary,
  localeDictionary: Dictionary
): Dictionary {
  if (Array.isArray(defaultLocaleDictionary)) {
    return defaultLocaleDictionary.map((value, key) => {
      if (isDictionaryEntry(value)) {
        return (localeDictionary as (Dictionary | DictionaryEntry)[])[key];
      }
      return mergeDictionaries(
        value as Dictionary,
        (localeDictionary as (Dictionary | DictionaryEntry)[])[
          key
        ] as Dictionary
      );
    });
  }

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

  const defaultDictionaryKeys = Object.entries(defaultLocaleDictionary)
    .filter(([, value]) => isObjectDictionary(value))
    .map(([key]) => key);

  const localeDictionaryKeys = Object.entries(localeDictionary)
    .filter(([, value]) => isObjectDictionary(value))
    .map(([key]) => key);

  const allKeys = new Set([...defaultDictionaryKeys, ...localeDictionaryKeys]);
  for (const key of allKeys) {
    mergedDictionary[key] = mergeDictionaries(
      (get(defaultLocaleDictionary, key) || {}) as Dictionary,
      (get(localeDictionary, key) || {}) as Dictionary
    );
  }

  return mergedDictionary;
}
