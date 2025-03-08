import {
  Dictionary,
  FlattenedDictionary,
  FlattenedJSONDictionary,
  JSONDictionary,
} from '../../types/data';

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
        typeof dictionary[key] === 'object' &&
        dictionary[key] !== null &&
        !Array.isArray(dictionary[key])
      ) {
        const nestedFlattened = flattenDictionary(dictionary[key], newKey);
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
        flattened[newKey] = dictionary[key];
      }
    }
  }
  return flattened;
}

/**
 * Flattens a nested dictionary containing only string values
 * Throws an error if two keys result in the same flattened key.
 * @param {JSONDictionary} dictionary - The dictionary to flatten.
 * @param {string} [prefix=''] - The prefix for nested keys.
 * @returns {FlattenedJSONDictionary} The flattened dictionary with string values.
 * @throws {Error} If two keys result in the same flattened key.
 * @throws {Error} If a value is an array.
 */
export function flattenJsonDictionary(
  dictionary: JSONDictionary,
  prefix: string = ''
): FlattenedJSONDictionary {
  const flattened: FlattenedJSONDictionary = {};
  for (const key in dictionary) {
    if (dictionary.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      const value = dictionary[key];

      if (Array.isArray(value)) {
        throw new Error(
          `Arrays are not supported in JSON dictionary at key: "${newKey}"`
        );
      } else if (typeof value === 'object' && value !== null) {
        // Recursively flatten nested objects
        const nestedFlattened = flattenJsonDictionary(value, newKey);
        for (const flatKey in nestedFlattened) {
          if (flattened.hasOwnProperty(flatKey)) {
            throw new Error(createDuplicateKeyError(flatKey));
          }
          flattened[flatKey] = nestedFlattened[flatKey];
        }
      } else if (typeof value === 'string') {
        // Handle string values
        if (flattened.hasOwnProperty(newKey)) {
          throw new Error(createDuplicateKeyError(newKey));
        }
        flattened[newKey] = value;
      }
    }
  }
  return flattened;
}
