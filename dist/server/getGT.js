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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGT = getGT;
exports.useElement = useElement;
var jsx_runtime_1 = require("react/jsx-runtime");
var internal_1 = require("gt-react/internal");
var T_1 = __importDefault(require("./inline/T"));
var getDictionary_1 = __importStar(require("../dictionary/getDictionary"));
var server_1 = require("../server");
var getI18NConfig_1 = __importDefault(require("../config/getI18NConfig"));
var generaltranslation_1 = require("generaltranslation");
var getMetadata_1 = __importDefault(require("../request/getMetadata"));
var createErrors_1 = require("../errors/createErrors");
var react_1 = __importStar(require("react"));
/**
 * Returns the translation function `t()`, which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = await getGT('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = await getGT();
 * console.log(t('hello')); // Translates item 'hello'
 */
function getGT(id) {
    return __awaiter(this, void 0, void 0, function () {
        var getId, I18NConfig, defaultLocale, locale, translationRequired, filteredTranslations, translationsPromise, additionalMetadata_1, dictionarySubset, flattenedDictionaryEntries, translations_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    getId = function (suffix) {
                        return id ? "".concat(id, ".").concat(suffix) : suffix;
                    };
                    I18NConfig = (0, getI18NConfig_1.default)();
                    defaultLocale = I18NConfig.getDefaultLocale();
                    return [4 /*yield*/, (0, server_1.getLocale)()];
                case 1:
                    locale = _a.sent();
                    translationRequired = I18NConfig.requiresTranslation(locale);
                    filteredTranslations = {};
                    if (!translationRequired) return [3 /*break*/, 5];
                    translationsPromise = I18NConfig.getCachedTranslations(locale);
                    return [4 /*yield*/, (0, getMetadata_1.default)()];
                case 2:
                    additionalMetadata_1 = _a.sent();
                    dictionarySubset = (id ? (0, getDictionary_1.getDictionaryEntry)(id) : (0, getDictionary_1.default)()) || {};
                    if (typeof dictionarySubset !== 'object' || Array.isArray(dictionarySubset)) // check that it is a Dictionary, not a Dictionary Entry
                        throw new Error((0, createErrors_1.createDictionarySubsetError)(id !== null && id !== void 0 ? id : '', 'getGT'));
                    flattenedDictionaryEntries = (0, internal_1.flattenDictionary)(dictionarySubset);
                    return [4 /*yield*/, translationsPromise];
                case 3:
                    translations_1 = _a.sent();
                    // Translate all strings in sub dictionary (block until completed)
                    return [4 /*yield*/, Promise.all(Object.entries(flattenedDictionaryEntries !== null && flattenedDictionaryEntries !== void 0 ? flattenedDictionaryEntries : {}).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var _c, entry, metadata, contentArray, hash, entryId, translationEntry, translationPromise, _d, _e, error_1;
                            var _f;
                            var suffix = _b[0], dictionaryEntry = _b[1];
                            return __generator(this, function (_g) {
                                switch (_g.label) {
                                    case 0:
                                        _c = (0, internal_1.extractEntryMetadata)(dictionaryEntry), entry = _c.entry, metadata = _c.metadata;
                                        // only tx strings
                                        if (typeof entry !== 'string')
                                            return [2 /*return*/];
                                        contentArray = (0, generaltranslation_1.splitStringToContent)(entry);
                                        hash = I18NConfig.hashContent(contentArray, metadata === null || metadata === void 0 ? void 0 : metadata.context);
                                        entryId = getId(suffix);
                                        translationEntry = (_f = translations_1[entryId]) === null || _f === void 0 ? void 0 : _f[hash];
                                        if (translationEntry) {
                                            // success
                                            if (translationEntry.state === 'success')
                                                return [2 /*return*/, (filteredTranslations[entryId] = translationEntry.target)];
                                            // error
                                            return [2 /*return*/];
                                        }
                                        translationPromise = I18NConfig.translateContent({
                                            source: contentArray,
                                            targetLocale: locale,
                                            options: __assign({ id: entryId, hash: hash }, additionalMetadata_1),
                                        });
                                        _g.label = 1;
                                    case 1:
                                        _g.trys.push([1, 3, , 4]);
                                        _d = filteredTranslations;
                                        _e = entryId;
                                        return [4 /*yield*/, translationPromise];
                                    case 2:
                                        _d[_e] = _g.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_1 = _g.sent();
                                        console.error((0, createErrors_1.createDictionaryStringTranslationError)(entryId), error_1);
                                        return [2 /*return*/];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 4:
                    // Translate all strings in sub dictionary (block until completed)
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/, function (id, options) {
                        // Get entry
                        id = getId(id);
                        var dictionaryEntry = (0, getDictionary_1.getDictionaryEntry)(id);
                        if (!dictionaryEntry === undefined || // no entry found
                            (typeof dictionaryEntry === 'object' && !(0, react_1.isValidElement)(dictionaryEntry) && !Array.isArray(dictionaryEntry)) // make sure is DictionaryEntry, not Dictionary
                        ) {
                            console.warn((0, createErrors_1.createNoEntryWarning)(id));
                            return undefined;
                        }
                        var _a = (0, internal_1.extractEntryMetadata)(dictionaryEntry), entry = _a.entry, metadata = _a.metadata;
                        // Get variables and variable options
                        var variables = options;
                        var variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
                        // Render strings
                        if (typeof entry === 'string') {
                            var contentArray = filteredTranslations[id] || (0, generaltranslation_1.splitStringToContent)(entry);
                            return (0, generaltranslation_1.renderContentToString)(contentArray, [locale, defaultLocale], variables, variablesOptions);
                        }
                        // Translate on demand
                        return ((0, jsx_runtime_1.jsx)(T_1.default, __assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
                    }];
            }
        });
    });
}
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
            (typeof dictionaryEntry === 'object' && !(0, react_1.isValidElement)(dictionaryEntry) && !Array.isArray(dictionaryEntry)) // make sure is DictionaryEntry, not Dictionary
        ) {
            console.warn((0, createErrors_1.createNoEntryWarning)(id));
            return (0, jsx_runtime_1.jsx)(react_1.default.Fragment, {});
        }
        var _a = (0, internal_1.extractEntryMetadata)(dictionaryEntry), entry = _a.entry, metadata = _a.metadata;
        // Get variables and variable options
        var variables = options;
        var variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
        // Translate on demand
        return ((0, jsx_runtime_1.jsx)(T_1.default, __assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
    }
    return t;
}
//# sourceMappingURL=getGT.js.map