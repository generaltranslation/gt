"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = flattenDictionary;
var react_1 = __importDefault(require("react"));
var createDuplicateKeyError = function (key) {
    return "Duplicate key found in dictionary: \"".concat(key, "\"");
};
/**
 * Flattens a nested dictionary by concatenating nested keys.
 * Throws an error if two keys result in the same flattened key.
 * @param {Record<string, any>} dictionary - The dictionary to flatten.
 * @param {string} [prefix=''] - The prefix for nested keys.
 * @returns {Record<string, React.ReactNode>} The flattened dictionary object.
 * @throws {Error} If two keys result in the same flattened key.
 */
function flattenDictionary(dictionary, prefix) {
    if (prefix === void 0) { prefix = ""; }
    var flattened = {};
    for (var key in dictionary) {
        if (dictionary.hasOwnProperty(key)) {
            var newKey = prefix ? "".concat(prefix, ".").concat(key) : key;
            if (typeof dictionary[key] === "object" &&
                dictionary[key] !== null &&
                !Array.isArray(dictionary[key]) &&
                !react_1.default.isValidElement(dictionary[key])) {
                var nestedFlattened = flattenDictionary(dictionary[key], newKey);
                for (var flatKey in nestedFlattened) {
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