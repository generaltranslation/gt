import { JsxChildren } from '../types';
/**
 * Calculates a unique hash for a given string using sha256.
 *
 * @param {string} string - The string to be hashed.
 * @returns {string} - The resulting hash as a hexadecimal string.
 */
export declare function hashString(string: string): string;
/**
 * Calculates a unique ID for the given children objects by hashing their sanitized JSON string representation.
 *
 * @param {any} childrenAsObjects - The children objects to be hashed.
 * @param {string} context - The context for the children
 * @param {string} id - The id for the JSX Children object
 * @param {function} hashFunction custom hash function
 * @returns {string} - The unique has of the children.
 */
export declare function hashJsxChildren({ source, context, id, dataFormat, }: {
    source: JsxChildren;
    context?: string;
    id?: string;
    dataFormat?: string;
}, hashFunction?: (string: string) => string): string;
