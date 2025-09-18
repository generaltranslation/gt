import { get } from '../dictionaries/indexDict';
import {
  Dictionary,
  DictionaryEntry,
  FlattenedDictionary,
} from '../types/types';

const createDuplicateKeyError = (key: string) =>
  `Duplicate key found in dictionary: "${key}"`;

/**
 * Flattens a nested dictionary by concatenating nested keys.
 * Throws an error if two keys result in the same flattened key.
 * @param {Record<string, any>} dictionary - The dictionary to flatten.
 * @param {string} [prefix=''] - The prefix for nested keys.
 * @returns {Record<string, React.ReactNode>} The flattened dictionary object.
 * @throws {Error} If two keys result in the same flattened key.
 */
export default function flattenDictionary(
  dictionary: Dictionary,
  prefix: string = ''
): FlattenedDictionary {
  const flattened: FlattenedDictionary = {};
  for (const key in dictionary) {
    if (dictionary.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (
        typeof get(dictionary, key) === 'object' &&
        get(dictionary, key) !== null &&
        !Array.isArray(get(dictionary, key))
      ) {
        const nestedFlattened = flattenDictionary(
          get(dictionary, key) as Dictionary,
          newKey
        );
        for (const flatKey in nestedFlattened) {
          if (flattened.hasOwnProperty(flatKey)) {
            throw new Error(createDuplicateKeyError(flatKey));
          }
          flattened[flatKey] = nestedFlattened[flatKey];
        }
      } else {
        if (flattened.hasOwnProperty(newKey)) {
          throw new Error(createDuplicateKeyError(newKey));
        }
        flattened[newKey] = get(dictionary, key) as DictionaryEntry;
      }
    }
  }
  return flattened;
}
