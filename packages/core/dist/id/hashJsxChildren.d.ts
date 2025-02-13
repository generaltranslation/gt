import { JsxChildren } from '../types';
/**
 * Calculates a unique hash for a given string using sha256.
 *
 * @param {string} string - The string to be hashed.
 * @param {string} id - An optional identifier to be appended to the string before hashing.
 * @returns {string} - The resulting hash as a hexadecimal string.
 */
export declare function hashString(string: string, id?: string): string;
/**
 * Calculates a unique ID for the given children objects by hashing their sanitized JSON string representation.
 *
 * @param {any} childrenAsObjects - The children objects to be hashed.
 * @param {string} id - An optional identifier to be appended to the jsx children before hashing.
 * @param {string} context - The context for the children
 * @param {function} hashFunction custom hash function
 * @returns {string} - The unique has of the children.
 */
export declare function hashJsxChildren({ source, context, id, hashFunction, }: {
    source: JsxChildren;
    context?: string;
    id?: string;
    hashFunction?: (string: string, id?: string) => string;
}): string;
