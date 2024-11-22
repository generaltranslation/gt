"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGT = getGT;
exports.gt = gt;
var jsx_runtime_1 = require("react/jsx-runtime");
var internal_1 = require("gt-react/internal");
var T_1 = __importDefault(require("./inline/T"));
var getDictionary_1 = require("../dictionary/getDictionary");
var tx_1 = __importDefault(require("./strings/tx"));
/**
 * Gets the translation function `t`, which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = getGT('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = getGT();
 * console.log(t('hello')); // Translates item 'hello'
 */
function getGT(id) {
    var getID = function (suffix) {
        return id ? "".concat(id, ".").concat(suffix) : suffix;
    };
    return function (id, options, f) {
        id = getID(id);
        // Get entry
        var _a = (0, internal_1.extractEntryMetadata)((0, getDictionary_1.getDictionaryEntry)(id)), entry = _a.entry, metadata = _a.metadata;
        // Get variables and variable options
        var variables;
        var variablesOptions;
        if (options) {
            variables = options;
            if (metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions) {
                variablesOptions = metadata.variablesOptions;
            }
        }
        // Handle if the entry is a function
        if (typeof f === 'function') {
            entry = f(options);
        }
        else if (typeof entry === 'function') {
            entry = entry(options);
        }
        if (!entry) {
            console.warn("No entry found for id: \"".concat(id, "\""));
            return undefined;
        }
        if (typeof entry === 'string') {
            return (0, tx_1.default)(entry, {
                id: id,
                variables: variables,
                variablesOptions: variablesOptions
            });
        }
        return ((0, jsx_runtime_1.jsx)(T_1.default, __assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
    };
}
/**
 * Gets the translation function `t`, which is used to translate a JSX element from the dictionary.
 * For translating strings directly, see `getGT()` or `useGT()`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = gt('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = gt();
 * console.log(t('hello')); // Translates item 'hello'
 */
function gt(id) {
    var getID = function (suffix) {
        return id ? "".concat(id, ".").concat(suffix) : suffix;
    };
    /**
    * Translates a dictionary item based on its `id` and options, ensuring that it is a JSX element.
    *
    * @param {string} [id] - The ID of the item in the dictionary to translate.
    * @param {Record<string, any>} [options={}] - Variables or parameters (e.g., `n`) passed into the translation for dynamic content.
    * @param {Function} [f] - Advanced feature. `f` is executed with `options` as parameters, and its result is translated based on the dictionary value of `id`. You likely don't need this parameter unless you using `getGT` on the client-side.
    *
    * @returns {JSX.Element}
    */
    function t(id, options, f) {
        if (options === void 0) { options = {}; }
        id = getID(id);
        // Get entry
        var _a = (0, internal_1.extractEntryMetadata)((0, getDictionary_1.getDictionaryEntry)(id)), entry = _a.entry, metadata = _a.metadata;
        // Get variables and variable options
        var variables;
        var variablesOptions;
        if (options) {
            variables = options;
            if (metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions) {
                variablesOptions = metadata.variablesOptions;
            }
        }
        // Handle if the entry is a function
        if (typeof f === 'function') {
            entry = f(options);
        }
        else if (typeof entry === 'function') {
            entry = entry(options);
        }
        if (!entry) {
            console.warn("No entry found for id: \"".concat(id, "\""));
            return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, {});
        }
        return ((0, jsx_runtime_1.jsx)(T_1.default, __assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
    }
    return t;
}
//# sourceMappingURL=getGT.js.map