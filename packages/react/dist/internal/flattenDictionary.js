"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = flattenDictionary;
const react_1 = __importDefault(require("react"));
const createDuplicateKeyError = (key) => `Duplicate key found in dictionary: "${key}"`;
/**
 * Flattens a nested dictionary by concatenating nested keys.
 * Throws an error if two keys result in the same flattened key.
 * @param {Record<string, any>} dictionary - The dictionary to flatten.
 * @param {string} [prefix=''] - The prefix for nested keys.
 * @returns {Record<string, React.ReactNode>} The flattened dictionary object.
 * @throws {Error} If two keys result in the same flattened key.
 */
function flattenDictionary(dictionary, prefix = "") {
    const flattened = {};
    for (const key in dictionary) {
        if (dictionary.hasOwnProperty(key)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof dictionary[key] === "object" &&
                dictionary[key] !== null &&
                !Array.isArray(dictionary[key]) &&
                !react_1.default.isValidElement(dictionary[key])) {
                const nestedFlattened = flattenDictionary(dictionary[key], newKey);
                for (const flatKey in nestedFlattened) {
                    if (flattened.hasOwnProperty(flatKey)) {
                        throw new Error(createDuplicateKeyError(flatKey));
                    }
                    flattened[flatKey] = nestedFlattened[flatKey];
                }
            }
            else {
                if (flattened.hasOwnProperty(newKey)) {
                    throw new Error(createDuplicateKeyError(newKey));
                }
                flattened[newKey] = dictionary[key];
            }
        }
    }
    return flattened;
}
//# sourceMappingURL=flattenDictionary.js.map