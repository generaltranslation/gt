import { Dictionary, FlattenedDictionary, FlattenedJSONDictionary, JSONDictionary } from '../../types/data';
/**
 * Flattens a nested dictionary by concatenating nested keys.
 * Throws an error if two keys result in the same flattened key.
 * @param {Record<string, any>} dictionary - The dictionary to flatten.
 * @param {string} [prefix=''] - The prefix for nested keys.
 * @returns {Record<string, React.ReactNode>} The flattened dictionary object.
 * @throws {Error} If two keys result in the same flattened key.
 */
export default function flattenDictionary(dictionary: Dictionary, prefix?: string): FlattenedDictionary;
/**
 * Flattens a nested dictionary containing only string values
 * Throws an error if two keys result in the same flattened key.
 * @param {JSONDictionary} dictionary - The dictionary to flatten.
 * @param {string} [prefix=''] - The prefix for nested keys.
 * @returns {FlattenedJSONDictionary} The flattened dictionary with string values.
 * @throws {Error} If two keys result in the same flattened key.
 * @throws {Error} If a value is an array.
 */
export declare function flattenJsonDictionary(dictionary: JSONDictionary, prefix?: string): FlattenedJSONDictionary;
