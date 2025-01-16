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
import { jsx as _jsx } from "react/jsx-runtime";
import { extractEntryMetadata, flattenDictionary } from "gt-react/internal";
import T from "./inline/T";
import getDictionary, { getDictionaryEntry } from "../dictionary/getDictionary";
import { getLocale } from "../server";
import getI18NConfig from "../config/getI18NConfig";
import { renderContentToString, splitStringToContent } from "generaltranslation";
import getMetadata from "../request/getMetadata";
import { createDictionarySubsetError, createNoEntryWarning } from "../errors/createErrors";
import React, { isValidElement } from "react";
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
export function getGT(id) {
    return __awaiter(this, void 0, void 0, function () {
        var getId, I18NConfig, defaultLocale, locale, translationRequired, filteredTranslations, translationsPromise, additionalMetadata_1, renderSettings_1, dictionarySubset, dictionaryEntries, translations_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    getId = function (suffix) {
                        return id ? "".concat(id, ".").concat(suffix) : suffix;
                    };
                    I18NConfig = getI18NConfig();
                    defaultLocale = I18NConfig.getDefaultLocale();
                    return [4 /*yield*/, getLocale()];
                case 1:
                    locale = _a.sent();
                    translationRequired = I18NConfig.requiresTranslation(locale);
                    filteredTranslations = {};
                    if (!translationRequired) return [3 /*break*/, 5];
                    translationsPromise = I18NConfig.getTranslations(locale);
                    return [4 /*yield*/, getMetadata()];
                case 2:
                    additionalMetadata_1 = _a.sent();
                    renderSettings_1 = I18NConfig.getRenderSettings();
                    dictionarySubset = (id ? getDictionaryEntry(id) : getDictionary()) || {};
                    if (typeof dictionarySubset !== 'object' || Array.isArray(dictionarySubset))
                        throw new Error(createDictionarySubsetError(id !== null && id !== void 0 ? id : '', "getGT"));
                    dictionaryEntries = flattenDictionary(dictionarySubset);
                    return [4 /*yield*/, translationsPromise];
                case 3:
                    translations_1 = _a.sent();
                    // Translate all strings in advance
                    return [4 /*yield*/, Promise.all(Object.entries(dictionaryEntries !== null && dictionaryEntries !== void 0 ? dictionaryEntries : {}).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var _c, entry, metadata, contentArray, entryId, _d, _, hash, translation, translationPromise, _e, _f;
                            var _g;
                            var suffix = _b[0], dictionaryEntry = _b[1];
                            return __generator(this, function (_h) {
                                switch (_h.label) {
                                    case 0:
                                        _c = extractEntryMetadata(dictionaryEntry), entry = _c.entry, metadata = _c.metadata;
                                        if (typeof entry !== 'string')
                                            return [2 /*return*/];
                                        contentArray = splitStringToContent(entry);
                                        entryId = getId(suffix);
                                        _d = I18NConfig.serializeAndHash(contentArray, metadata === null || metadata === void 0 ? void 0 : metadata.context, entryId), _ = _d[0], hash = _d[1];
                                        translation = (_g = translations_1[entryId]) === null || _g === void 0 ? void 0 : _g[hash];
                                        if (translation)
                                            return [2 /*return*/, filteredTranslations[entryId] = translation]; // NOTHING MORE TO DO
                                        translationPromise = I18NConfig.translateContent({
                                            source: contentArray,
                                            targetLocale: locale,
                                            options: __assign({ id: entryId, hash: hash }, additionalMetadata_1),
                                        });
                                        if (!(renderSettings_1.method !== "subtle")) return [3 /*break*/, 2];
                                        _e = filteredTranslations;
                                        _f = entryId;
                                        return [4 /*yield*/, translationPromise];
                                    case 1: return [2 /*return*/, _e[_f] = _h.sent()];
                                    case 2: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 4:
                    // Translate all strings in advance
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/, function (id, options) {
                        id = getId(id);
                        // Get entry
                        var dictionaryEntry = getDictionaryEntry(id);
                        if (dictionaryEntry === undefined || dictionaryEntry === null ||
                            (typeof dictionaryEntry === 'object' && !isValidElement(dictionaryEntry) && !Array.isArray(dictionaryEntry))) {
                            console.warn(createNoEntryWarning(id));
                            return undefined;
                        }
                        ;
                        var _a = extractEntryMetadata(dictionaryEntry), entry = _a.entry, metadata = _a.metadata;
                        // Get variables and variable options
                        var variables = options;
                        var variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
                        if (typeof entry === 'string') {
                            var contentArray = filteredTranslations[id] || splitStringToContent(entry);
                            return renderContentToString(contentArray, [locale, defaultLocale], variables, variablesOptions);
                        }
                        return (_jsx(T, __assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
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
export function useElement(id) {
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
        var dictionaryEntry = getDictionaryEntry(id);
        if (dictionaryEntry === undefined || dictionaryEntry === null ||
            (typeof dictionaryEntry === 'object' && !isValidElement(dictionaryEntry) && !Array.isArray(dictionaryEntry))) {
            console.warn(createNoEntryWarning(id));
            return _jsx(React.Fragment, {});
        }
        ;
        var _a = extractEntryMetadata(dictionaryEntry), entry = _a.entry, metadata = _a.metadata;
        // Get variables and variable options
        var variables = options;
        var variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
        return (_jsx(T, __assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
    }
    return t;
}
//# sourceMappingURL=getGT.js.map