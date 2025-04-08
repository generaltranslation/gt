import { Dictionary } from '../../types/types';

const isPrimitiveOrArray = (value: unknown): boolean =>
  typeof value === 'string' || Array.isArray(value);

const isObjectDictionary = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export default function mergeDictionaries(
  defaultLocaleDictionary: Dictionary,
  localeDictionary: Dictionary
): Dictionary {
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
      (defaultLocaleDictionary[key] || {}) as Dictionary,
      (localeDictionary[key] || {}) as Dictionary
    );
  }

  return mergedDictionary;
}
