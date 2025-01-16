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
import React from 'react';
import { flattenDictionary, extractEntryMetadata, } from 'gt-react/internal';
import getI18NConfig from '../config/getI18NConfig';
import getLocale from '../request/getLocale';
import getMetadata from '../request/getMetadata';
import { splitStringToContent } from 'generaltranslation';
import getDictionary, { getDictionaryEntry } from '../dictionary/getDictionary';
import ClientProvider from './ClientProvider';
import { createDictionarySubsetError } from '../errors/createErrors';
import { GTTranslationError, } from '../types/types';
/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} id - ID of a nested dictionary, so that only a subset of a large dictionary needs to be sent to the client.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export default function GTProvider(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var getId, I18NConfig, locale, additionalMetadata, defaultLocale, renderSettings, regionalTranslationRequired, translationRequired, translationsPromise, dictionarySubset, dictionaryEntries, dictionary, translations, existingTranslations, _c;
        var _this = this;
        var children = _b.children, id = _b.id;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    getId = function (suffix) {
                        return id ? "".concat(id, ".").concat(suffix) : suffix;
                    };
                    I18NConfig = getI18NConfig();
                    return [4 /*yield*/, getLocale()];
                case 1:
                    locale = _d.sent();
                    return [4 /*yield*/, getMetadata()];
                case 2:
                    additionalMetadata = _d.sent();
                    defaultLocale = I18NConfig.getDefaultLocale();
                    renderSettings = I18NConfig.getRenderSettings();
                    regionalTranslationRequired = I18NConfig.requiresRegionalTranslation(locale);
                    translationRequired = I18NConfig.requiresTranslation(locale) || regionalTranslationRequired;
                    if (translationRequired)
                        translationsPromise = I18NConfig.getTranslations(locale);
                    dictionarySubset = (id ? getDictionaryEntry(id) : getDictionary()) || {};
                    if (typeof dictionarySubset !== 'object' || Array.isArray(dictionarySubset))
                        throw new Error(createDictionarySubsetError(id !== null && id !== void 0 ? id : '', "<GTProvider>"));
                    dictionaryEntries = flattenDictionary(dictionarySubset);
                    dictionary = {};
                    translations = {};
                    if (!(translationsPromise)) return [3 /*break*/, 4];
                    return [4 /*yield*/, translationsPromise];
                case 3:
                    _c = _d.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _c = {};
                    _d.label = 5;
                case 5:
                    existingTranslations = _c;
                    // Check and standardize flattened dictionary entries before passing them to the client
                    return [4 /*yield*/, Promise.all(Object.entries(dictionaryEntries !== null && dictionaryEntries !== void 0 ? dictionaryEntries : {}).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var entryId, _c, entry, metadata, taggedEntry, contentArray, _d, _, hash_1, translation_1, translationPromise_1, _e, _f, _g, error_1, result, _h, entryAsObjects, hash, translation, translationPromise, _j, _k, _l, loadingFallback, errorFallback;
                            var _m, _o, _p, _q;
                            var suffix = _b[0], dictionaryEntry = _b[1];
                            return __generator(this, function (_r) {
                                switch (_r.label) {
                                    case 0:
                                        entryId = getId(suffix);
                                        _c = extractEntryMetadata(dictionaryEntry), entry = _c.entry, metadata = _c.metadata;
                                        if (typeof entry === 'undefined')
                                            return [2 /*return*/];
                                        taggedEntry = I18NConfig.addGTIdentifier(entry, entryId);
                                        // If no translation is required, return
                                        if (!translationRequired)
                                            return [2 /*return*/, dictionary[entryId] = [taggedEntry, __assign({}, metadata)]];
                                        if (!(typeof taggedEntry === 'string')) return [3 /*break*/, 5];
                                        contentArray = splitStringToContent(taggedEntry);
                                        _d = I18NConfig.serializeAndHash(contentArray, metadata === null || metadata === void 0 ? void 0 : metadata.context, entryId), _ = _d[0], hash_1 = _d[1];
                                        dictionary[entryId] = [taggedEntry, __assign(__assign({}, metadata), { hash: hash_1 })];
                                        translation_1 = existingTranslations === null || existingTranslations === void 0 ? void 0 : existingTranslations[entryId];
                                        if (translation_1 === null || translation_1 === void 0 ? void 0 : translation_1[hash_1])
                                            return [2 /*return*/, (translations[entryId] = (_m = {}, _m[hash_1] = translation_1[hash_1], _m))];
                                        translationPromise_1 = I18NConfig.translateContent({
                                            source: contentArray,
                                            targetLocale: locale,
                                            options: __assign({ id: entryId, hash: hash_1 }, additionalMetadata),
                                        });
                                        if (renderSettings.method === "skeleton") {
                                            return [2 /*return*/, translations[entryId] = {
                                                    promise: translationPromise_1,
                                                    hash: hash_1,
                                                    type: 'content'
                                                }];
                                        }
                                        if (renderSettings.method === "replace") {
                                            return [2 /*return*/, translations[entryId] = {
                                                    promise: translationPromise_1,
                                                    hash: hash_1,
                                                    type: 'content'
                                                }];
                                        }
                                        if (renderSettings.method === "default") {
                                            return [2 /*return*/, translations[entryId] = {
                                                    promise: translationPromise_1,
                                                    hash: hash_1,
                                                    type: 'content'
                                                }];
                                        }
                                        if (!(renderSettings.method === "hang")) return [3 /*break*/, 4];
                                        _r.label = 1;
                                    case 1:
                                        _r.trys.push([1, 3, , 4]);
                                        _e = translations;
                                        _f = entryId;
                                        _o = {};
                                        _g = hash_1;
                                        return [4 /*yield*/, translationPromise_1];
                                    case 2:
                                        _e[_f] = (_o[_g] = _r.sent(),
                                            _o);
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_1 = _r.sent();
                                        result = void 0;
                                        if (error_1 instanceof GTTranslationError) {
                                            result = error_1.toTranslationError();
                                        }
                                        else {
                                            result = {
                                                error: "An unknonwn error occured",
                                                code: 500
                                            };
                                        }
                                        translations[entryId] = result;
                                        return [3 /*break*/, 4];
                                    case 4: 
                                    // Subtle rendering
                                    return [2 /*return*/, undefined];
                                    case 5:
                                        _h = I18NConfig.serializeAndHash(taggedEntry, metadata === null || metadata === void 0 ? void 0 : metadata.context, entryId), entryAsObjects = _h[0], hash = _h[1];
                                        dictionary[entryId] = [taggedEntry, __assign(__assign({}, metadata), { hash: hash })];
                                        translation = existingTranslations === null || existingTranslations === void 0 ? void 0 : existingTranslations[entryId];
                                        if (translation === null || translation === void 0 ? void 0 : translation[hash])
                                            return [2 /*return*/, (translations[entryId] = (_p = {}, _p[hash] = translation[hash], _p))];
                                        translationPromise = I18NConfig.translateChildren({
                                            source: entryAsObjects,
                                            targetLocale: locale,
                                            metadata: __assign(__assign({ id: entryId, hash: hash }, additionalMetadata), (renderSettings.timeout && { timeout: renderSettings.timeout })),
                                        });
                                        if (renderSettings.method === "subtle")
                                            return [2 /*return*/, undefined];
                                        if (!(renderSettings.method === "hang")) return [3 /*break*/, 7];
                                        _j = translations;
                                        _k = entryId;
                                        _q = {};
                                        _l = hash;
                                        return [4 /*yield*/, translationPromise];
                                    case 6: return [2 /*return*/, (_j[_k] = (_q[_l] = _r.sent(), _q))];
                                    case 7:
                                        if (renderSettings.method === 'skeleton') {
                                            loadingFallback = _jsx(React.Fragment, {}, "skeleton_".concat(entryId));
                                        }
                                        return [2 /*return*/, (translations[entryId] = {
                                                promise: translationPromise,
                                                hash: hash,
                                                type: 'jsx',
                                            })];
                                }
                            });
                        }); }))];
                case 6:
                    // Check and standardize flattened dictionary entries before passing them to the client
                    _d.sent();
                    return [2 /*return*/, (_jsx(ClientProvider, __assign({ dictionary: dictionary, initialTranslations: __assign(__assign({}, existingTranslations), translations), locale: locale, defaultLocale: defaultLocale, translationRequired: translationRequired, regionalTranslationRequired: regionalTranslationRequired, requiredPrefix: id, renderSettings: I18NConfig.getRenderSettings() }, I18NConfig.getClientSideConfig(), { children: children })))];
            }
        });
    });
}
//# sourceMappingURL=GTProvider.js.map