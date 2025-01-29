"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ClientProvider;
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var client_1 = require("gt-react/client");
var internal_1 = require("gt-react/internal");
var generaltranslation_1 = require("generaltranslation");
var react_2 = __importDefault(require("react"));
var supported_locales_1 = require("@generaltranslation/supported-locales");
var types_1 = require("../types/types");
var extractTaggedEntryMetadata_1 = __importDefault(require("../utils/extractTaggedEntryMetadata"));
// meant to be used inside the server-side <GTProvider>
function ClientProvider(_a) {
    var _this = this;
    var children = _a.children, dictionary = _a.dictionary, initialTranslations = _a.initialTranslations, translationPromises = _a.translationPromises, locale = _a.locale, defaultLocale = _a.defaultLocale, translationRequired = _a.translationRequired, dialectTranslationRequired = _a.dialectTranslationRequired, _b = _a.locales, locales = _b === void 0 ? (0, supported_locales_1.listSupportedLocales)() : _b, requiredPrefix = _a.requiredPrefix, renderSettings = _a.renderSettings, projectId = _a.projectId, devApiKey = _a.devApiKey, runtimeUrl = _a.runtimeUrl, _c = _a.runtimeTranslations, runtimeTranslations = _c === void 0 ? false : _c;
    /**
     * (a) Cache has already been checked by server at this point
     * (b) All string dictionary translations have been resolved at this point
     * (c) JSX dictionary entries are either (1) resolved (so success/error) or (2) not resolved/not yet requested.
     *     They will NOT be loading at this point.
     */
    var _d = (0, react_1.useState)(null), translations = _d[0], setTranslations = _d[1];
    (0, react_1.useLayoutEffect)(function () {
        setTranslations(function (prev) { return (__assign(__assign({}, prev), initialTranslations)); });
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var resolvedTranslations;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        resolvedTranslations = {};
                        return [4 /*yield*/, Promise.all(Object.entries(translationPromises).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                var metadata, hash, result, error_1;
                                var _c, _d;
                                var id = _b[0], promise = _b[1];
                                return __generator(this, function (_e) {
                                    switch (_e.label) {
                                        case 0:
                                            metadata = (0, extractTaggedEntryMetadata_1.default)(dictionary[id]).metadata;
                                            hash = metadata === null || metadata === void 0 ? void 0 : metadata.hash;
                                            _e.label = 1;
                                        case 1:
                                            _e.trys.push([1, 3, , 4]);
                                            _c = { state: 'success' };
                                            return [4 /*yield*/, promise];
                                        case 2:
                                            result = (_c.target = _e.sent(), _c);
                                            return [3 /*break*/, 4];
                                        case 3:
                                            error_1 = _e.sent();
                                            console.error(error_1);
                                            // set all promise ids to error in translations
                                            if (error_1 instanceof types_1.GTTranslationError) {
                                                result = error_1.toTranslationError();
                                            }
                                            else {
                                                result = { state: 'error', error: 'An error occured', code: 500 };
                                            }
                                            return [3 /*break*/, 4];
                                        case 4:
                                            resolvedTranslations[id] = (_d = {}, _d[hash] = result, _d);
                                            return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        // add resolved translations to state
                        setTranslations(function (prev) { return (__assign(__assign({}, prev), resolvedTranslations)); });
                        return [2 /*return*/];
                }
            });
        }); })();
    }, [initialTranslations, translationPromises]);
    // for dictionaries (strings are actually already resolved, but JSX needs tx still)
    var translateDictionaryEntry = (0, react_1.useCallback)(function (id, options) {
        // ----- SETUP ----- //
        var _a;
        if (options === void 0) { options = {}; }
        // Get the dictionary entry
        var dictionaryEntry = dictionary[id]; // this is a flattened dictionary
        if ((!dictionaryEntry && dictionaryEntry !== '') || // entry not found
            (typeof dictionaryEntry === 'object' &&
                !(0, react_1.isValidElement)(dictionaryEntry) &&
                !Array.isArray(dictionaryEntry))) {
            return undefined; // dictionary entry not found
        }
        // Parse the dictionary entry
        var _b = (0, extractTaggedEntryMetadata_1.default)(dictionaryEntry), entry = _b.entry, metadata = _b.metadata;
        var variables = options;
        var variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
        var hash = metadata === null || metadata === void 0 ? void 0 : metadata.hash;
        var translationEntry = (_a = translations === null || translations === void 0 ? void 0 : translations[id]) === null || _a === void 0 ? void 0 : _a[hash];
        // ----- RENDER STRINGS ----- //
        if (typeof entry === 'string') {
            // render strings
            // Reject empty strings
            if (!entry.length) {
                console.warn("gt-next warn: Empty string found in dictionary with id: ".concat(id));
                return entry;
            }
            // no translation required
            var content = (0, generaltranslation_1.splitStringToContent)(entry);
            if (!translationRequired) {
                return (0, generaltranslation_1.renderContentToString)(content, locales, variables, variablesOptions);
            }
            // error behavior (strings shouldn't be in a loading state here)
            if ((translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) !== 'success') {
                return (0, generaltranslation_1.renderContentToString)(content, locales, variables, variablesOptions);
            }
            // render translated content
            return (0, generaltranslation_1.renderContentToString)(translationEntry.target, [locale, defaultLocale], variables, variablesOptions);
        }
        // ----- RENDER METHODS FOR JSX ----- //
        var taggedChildren = entry;
        // for default/fallback rendering
        var renderDefaultLocale = function () {
            return (0, internal_1.renderDefaultChildren)({
                children: taggedChildren,
                variables: variables,
                variablesOptions: variablesOptions,
                defaultLocale: defaultLocale,
                renderVariable: internal_1.renderVariable,
            });
        };
        var renderLoadingDefault = function () {
            if (dialectTranslationRequired) {
                return renderDefaultLocale();
            }
            return (0, internal_1.renderSkeleton)();
        };
        var renderTranslation = function (target) {
            return (0, internal_1.renderTranslatedChildren)({
                source: taggedChildren,
                target: target,
                variables: variables,
                variablesOptions: variablesOptions,
                locales: [locale, defaultLocale],
                renderVariable: internal_1.renderVariable,
            });
        };
        // ----- RENDER JSX ----- //
        // fallback to default locale if no tx required
        if (!translationRequired) {
            return (0, jsx_runtime_1.jsx)(react_2.default.Fragment, { children: renderDefaultLocale() });
        }
        // loading behavior
        if (!translationEntry || (translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) === 'loading') {
            var loadingFallback = void 0;
            if (renderSettings.method === 'skeleton') {
                loadingFallback = (0, internal_1.renderSkeleton)();
            }
            else if (renderSettings.method === 'replace') {
                loadingFallback = renderDefaultLocale();
            }
            else {
                // default
                loadingFallback = renderLoadingDefault();
            }
            // The suspense exists here for hydration reasons
            return (0, jsx_runtime_1.jsx)(react_2.default.Fragment, { children: loadingFallback });
        }
        // error behavior
        if (translationEntry.state === 'error') {
            // Reject empty fragments
            if ((0, internal_1.isEmptyReactFragment)(entry)) {
                console.warn("gt-next warn: Empty fragment found in dictionary with id: ".concat(id));
                return entry;
            }
            return (0, jsx_runtime_1.jsx)(react_2.default.Fragment, { children: renderDefaultLocale() });
        }
        // render translated content
        return ((0, jsx_runtime_1.jsx)(react_2.default.Fragment, { children: renderTranslation(translationEntry.target) }));
    }, [dictionary, translations]);
    // For <T> components
    var _e = (0, client_1.useRuntimeTranslation)({
        targetLocale: locale,
        projectId: projectId,
        devApiKey: devApiKey,
        runtimeUrl: runtimeUrl,
        setTranslations: setTranslations,
        defaultLocale: defaultLocale,
        renderSettings: renderSettings,
    }), translateChildren = _e.translateChildren, translateContent = _e.translateContent;
    return ((0, jsx_runtime_1.jsx)(client_1.GTContext.Provider, { value: {
            translateDictionaryEntry: translateDictionaryEntry,
            translateChildren: translateChildren,
            translateContent: translateContent,
            locale: locale,
            defaultLocale: defaultLocale,
            translations: translations,
            translationRequired: translationRequired,
            dialectTranslationRequired: dialectTranslationRequired,
            renderSettings: renderSettings,
        }, children: translations && children }));
}
//# sourceMappingURL=ClientProvider.js.map