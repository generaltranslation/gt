import { JsxChildren } from "../types";
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
 * @param {function} hashFunction custom hash function
 * @returns {string} - The unique has of the children.
 */
export declare function hashJsxChildren({ source, context, hashFunction, }: {
    source: JsxChildren;
    context?: string;
    hashFunction?: (string: string) => string;
}): string;
