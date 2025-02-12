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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = useElement;
var jsx_runtime_1 = require("react/jsx-runtime");
var internal_1 = require("gt-react/internal");
var T_1 = __importDefault(require("./inline/T"));
var getDictionary_1 = require("../dictionary/getDictionary");
var createErrors_1 = require("../errors/createErrors");
var react_1 = __importStar(require("react"));
/**
 * Returns the translation function `t()`, which is used to translate an item from the dictionary.
 *
 * **`t()` returns only JSX elements.** For returning strings as well, see `await getGT()` or `useGT()`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useElement('user');
 * console.log(t('name')); // Translates item 'user.name', returns as JSX
 *
 * const t = useElement();
 * console.log(t('hello')); // Translates item 'hello', returns as JSX
 */
function useElement(id) {
    var getId = function (suffix) {
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
    function t(id, options) {
        if (options === void 0) { options = {}; }
        id = getId(id);
        // Get entry
        var dictionaryEntry = (0, getDictionary_1.getDictionaryEntry)(id);
        if (dictionaryEntry === undefined || // no entry found
            (typeof dictionaryEntry === 'object' &&
                !(0, react_1.isValidElement)(dictionaryEntry) &&
                !Array.isArray(dictionaryEntry)) // make sure is DictionaryEntry, not Dictionary
        ) {
            console.warn((0, createErrors_1.createNoEntryWarning)(id));
            return (0, jsx_runtime_1.jsx)(react_1.default.Fragment, {});
        }
        var _a = (0, internal_1.extractEntryMetadata)(dictionaryEntry), entry = _a.entry, metadata = _a.metadata;
        // Reject empty fragments
        if ((0, internal_1.isEmptyReactFragment)(entry)) {
            console.warn("gt-next warn: Empty fragment found in dictionary with id: ".concat(id));
            return entry;
        }
        // Get variables and variable options
        var variables = options;
        var variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
        // Translate on demand
        return ((0, jsx_runtime_1.jsx)(T_1.default, __assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
    }
    return t;
}
//# sourceMappingURL=useElement.js.map