'use client';
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
import { useCallback, useLayoutEffect, useState, } from 'react';
import { GTContext, useDynamicTranslation } from 'gt-react/client';
import { renderDefaultChildren, renderTranslatedChildren, renderSkeleton } from 'gt-react/internal';
import { extractEntryMetadata } from 'gt-react/internal';
import { renderContentToString } from 'generaltranslation';
import renderVariable from '../server/rendering/renderVariable';
import { createNoEntryWarning, createRequiredPrefixError } from '../errors/createErrors';
import { isTranslationPromise } from '../utils/checkTypes';
// meant to be used inside the server-side <GTProvider>
export default function ClientProvider(_a) {
    var _this = this;
    var children = _a.children, dictionary = _a.dictionary, initialTranslations = _a.initialTranslations, locale = _a.locale, defaultLocale = _a.defaultLocale, translationRequired = _a.translationRequired, regionalTranslationRequired = _a.regionalTranslationRequired, requiredPrefix = _a.requiredPrefix, renderSettings = _a.renderSettings, projectId = _a.projectId, devApiKey = _a.devApiKey, runtimeUrl = _a.runtimeUrl;
    var _b = useState(null), translations = _b[0], setTranslations = _b[1];
    useLayoutEffect(function () {
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var awaitedTranslations;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        awaitedTranslations = {};
                        return [4 /*yield*/, Promise.all(Object.entries(initialTranslations).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                var translation, error_1;
                                var _c;
                                var id = _b[0], translationEntry = _b[1];
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0:
                                            if (!isTranslationPromise(translationEntry)) return [3 /*break*/, 4];
                                            _d.label = 1;
                                        case 1:
                                            _d.trys.push([1, 3, , 4]);
                                            return [4 /*yield*/, translationEntry.promise];
                                        case 2:
                                            translation = _d.sent();
                                            awaitedTranslations[id] = (_c = {}, _c[translationEntry.hash] = translation, _c);
                                            return [3 /*break*/, 4];
                                        case 3:
                                            error_1 = _d.sent();
                                            awaitedTranslations[id] = {
                                                error: "An error occurred.",
                                                code: 500
                                            };
                                            return [3 /*break*/, 4];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        setTranslations(function (prev) { return (__assign(__assign({}, prev), awaitedTranslations)); });
                        return [2 /*return*/];
                }
            });
        }); })();
        setTranslations(function (prev) { return (__assign(__assign({}, initialTranslations), prev)); });
    }, []);
    // For dictionaries
    var translate = useCallback(function (id, options) {
        var _a, _b, _c;
        if (options === void 0) { options = {}; }
        if (requiredPrefix && !(id === null || id === void 0 ? void 0 : id.startsWith(requiredPrefix)))
            throw new Error(createRequiredPrefixError(id, requiredPrefix));
        var dictionaryEntry = dictionary[id];
        if (dictionaryEntry === undefined || dictionaryEntry === null ||
            (typeof dictionaryEntry === 'object' && !Array.isArray(dictionaryEntry))) {
            console.warn(createNoEntryWarning(id));
            return undefined;
        }
        ;
        // Get the entry from the dictionary
        var _d = extractEntryMetadata(dictionaryEntry), entry = _d.entry, metadata = _d.metadata;
        // Initialize and populate variables and variables' metadata
        var variables = options;
        var variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
        // ----- RENDER METHODS ----- //
        var renderString = function (content) {
            return renderContentToString(content, [locale, defaultLocale], variables, variablesOptions);
        };
        var renderDefaultLocale = function () {
            if (typeof entry === 'string')
                return renderString(entry);
            return renderDefaultChildren({
                children: entry,
                variables: variables,
                variablesOptions: variablesOptions,
                defaultLocale: defaultLocale,
                renderVariable: renderVariable
            });
        };
        var renderLoadingSkeleton = function () {
            if (typeof entry === 'string')
                return renderString('');
            return renderSkeleton({
                children: entry,
                variables: variables,
                defaultLocale: defaultLocale,
                renderVariable: renderVariable
            });
        };
        var renderLoadingHang = function () {
            // TODO: double check that this has the desired behavior
            if (typeof entry === 'string')
                return renderString('');
            return undefined;
        };
        var renderLoadingDefault = function () {
            if (regionalTranslationRequired)
                return renderDefaultLocale();
            return renderLoadingSkeleton();
        };
        // render translated content
        var renderTranslation = function (target) {
            if (typeof entry === 'string')
                return renderString(target);
            return renderTranslatedChildren({
                source: entry,
                target: target,
                variables: variables,
                variablesOptions: variablesOptions,
                locales: [locale, defaultLocale],
                renderVariable: renderVariable
            });
        };
        // ----- RENDER BEHAVIOR ----- //
        // No tx required, so render default locale
        if (!translationRequired)
            return renderDefaultLocale();
        // error behavior -> fallback to default language
        if ((_a = translations === null || translations === void 0 ? void 0 : translations[id]) === null || _a === void 0 ? void 0 : _a.error) {
            return renderDefaultLocale();
        }
        // loading behavior
        if (!translations || ((_b = translations[id]) === null || _b === void 0 ? void 0 : _b.promise) || !((_c = translations[id]) === null || _c === void 0 ? void 0 : _c[metadata === null || metadata === void 0 ? void 0 : metadata.hash])) {
            if (renderSettings.method === 'skeleton') {
                return renderLoadingSkeleton();
            }
            if (renderSettings.method === 'replace') {
                return renderDefaultLocale();
            }
            if (renderSettings.method === 'hang') {
                return renderLoadingHang();
            }
            if (renderSettings.method === 'subtle') {
                return renderDefaultLocale();
            }
            return renderLoadingDefault();
        }
        var translation = translations === null || translations === void 0 ? void 0 : translations[id];
        return renderTranslation(translation === null || translation === void 0 ? void 0 : translation[metadata === null || metadata === void 0 ? void 0 : metadata.hash]);
    }, [dictionary, translations]);
    // For <T> components
    var _c = useDynamicTranslation({
        targetLocale: locale,
        projectId: projectId,
        devApiKey: devApiKey,
        runtimeUrl: runtimeUrl,
        setTranslations: setTranslations,
        defaultLocale: defaultLocale
    }), translateChildren = _c.translateChildren, translateContent = _c.translateContent;
    return (_jsx(GTContext.Provider, { value: {
            translate: translate,
            translateChildren: translateChildren,
            translateContent: translateContent,
            locale: locale,
            defaultLocale: defaultLocale,
            translations: translations,
            translationRequired: translationRequired,
            regionalTranslationRequired: regionalTranslationRequired,
            renderSettings: renderSettings,
        }, children: translations && children }));
}
//# sourceMappingURL=ClientProvider.js.map