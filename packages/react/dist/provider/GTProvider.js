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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GTProvider;
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var generaltranslation_1 = require("generaltranslation");
var react_2 = require("react");
var useBrowserLocale_1 = __importDefault(require("../hooks/useBrowserLocale"));
var GTContext_1 = require("./GTContext");
var getDictionaryEntry_1 = __importDefault(require("./helpers/getDictionaryEntry"));
var internal_1 = require("../internal");
var extractEntryMetadata_1 = __importDefault(require("./helpers/extractEntryMetadata"));
var internal_2 = require("generaltranslation/internal");
var createMessages_1 = require("../messages/createMessages");
var supported_locales_1 = require("@generaltranslation/supported-locales");
var useRuntimeTranslation_1 = __importDefault(require("./runtime/useRuntimeTranslation"));
var defaultRenderSettings_1 = require("./rendering/defaultRenderSettings");
var id_1 = require("generaltranslation/id");
var T_1 = __importDefault(require("../inline/T"));
/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} [projectId] - The project ID required for General Translation cloud services.
 * @param {Dictionary} [dictionary=defaultDictionary] - The translation dictionary for the project.
 * @param {string[]} [locales] - The list of approved locales for the project.
 * @param {string} [defaultLocale=libraryDefaultLocale] - The default locale to use if no other locale is found.
 * @param {string} [locale] - The current locale, if already set.
 * @param {string} [cacheUrl='https://cache.gtx.dev'] - The URL of the cache service for fetching translations.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
function GTProvider(_a) {
    var _this = this;
    var children = _a.children, projectId = _a.projectId, _b = _a.dictionary, dictionary = _b === void 0 ? {} : _b, _c = _a.locales, locales = _c === void 0 ? (0, supported_locales_1.listSupportedLocales)() : _c, _d = _a.defaultLocale, defaultLocale = _d === void 0 ? internal_2.libraryDefaultLocale : _d, _e = _a.locale, locale = _e === void 0 ? (0, useBrowserLocale_1.default)(defaultLocale, locales) || defaultLocale : _e, _f = _a.cacheUrl, cacheUrl = _f === void 0 ? internal_2.defaultCacheUrl : _f, _g = _a.runtimeUrl, runtimeUrl = _g === void 0 ? internal_2.defaultRuntimeApiUrl : _g, _h = _a.renderSettings, renderSettings = _h === void 0 ? defaultRenderSettings_1.defaultRenderSettings : _h, devApiKey = _a.devApiKey, metadata = __rest(_a, ["children", "projectId", "dictionary", "locales", "defaultLocale", "locale", "cacheUrl", "runtimeUrl", "renderSettings", "devApiKey"]);
    if (!projectId &&
        (cacheUrl === internal_2.defaultCacheUrl || runtimeUrl === internal_2.defaultRuntimeApiUrl)) {
        throw new Error(createMessages_1.projectIdMissingError);
    }
    if (renderSettings.timeout === undefined &&
        defaultRenderSettings_1.defaultRenderSettings.timeout !== undefined) {
        renderSettings.timeout = defaultRenderSettings_1.defaultRenderSettings.timeout;
    }
    // get tx required info
    var _j = (0, react_1.useMemo)(function () {
        var translationRequired = (0, generaltranslation_1.requiresTranslation)(defaultLocale, locale, locales);
        var dialectTranslationRequired = translationRequired && (0, generaltranslation_1.isSameLanguage)(defaultLocale, locale);
        return [translationRequired, dialectTranslationRequired];
    }, [defaultLocale, locale, locales]), translationRequired = _j[0], dialectTranslationRequired = _j[1];
    // tracking translations
    /** Key for translation tracking:
     * Cache Loading            -> translations = null
     * Cache Fail (for locale)  -> translations = {}
     * Cache Fail (for id)      -> translations[id] = undefined
     * Cache Fail (for hash)    -> translations[id][hash] = undefined
     *
     * API Loading              -> translations[id][hash] = TranslationLoading
     * API Fail (for batch)     -> translations[id][hash] = TranslationError
     * API Fail (for hash)      -> translations[id][hash] = TranslationError
     *
     * Success (Cache/API)      -> translations[id][hash] = TranslationSuccess
     *
     * Possible scenarios:
     * Cache Loading -> Success
     * Cache Loading -> Cache Fail -> API Loading -> Success
     * Cache Loading -> Cache Fail -> API Loading -> API Fail
     */
    var _k = (0, react_2.useState)(cacheUrl && translationRequired ? null : {}), translations = _k[0], setTranslations = _k[1];
    // ----- CHECK CACHE FOR TX ----- //
    (0, react_2.useEffect)(function () {
        // check if cache fetch is necessary
        if (translations || !translationRequired)
            return;
        // fetch translations from cache
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var response, result, parsedResult, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch("".concat(cacheUrl, "/").concat(projectId, "/").concat(locale))];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        result = _a.sent();
                        parsedResult = Object.entries(result).reduce(function (translationsAcc, _a) {
                            var id = _a[0], hashToTranslation = _a[1];
                            translationsAcc[id] = Object.entries(hashToTranslation || {}).reduce(function (idAcc, _a) {
                                var hash = _a[0], content = _a[1];
                                idAcc[hash] = { state: "success", entry: content };
                                return idAcc;
                            }, {});
                            return translationsAcc;
                        }, {});
                        setTranslations(parsedResult);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        setTranslations({}); // not classified as a tx error, bc we can still fetch from API
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); })();
    }, [translations, translationRequired, cacheUrl, projectId, locale]);
    // ----- PERFORM DICTIONARY TRANSLATION ----- //
    // Flatten dictionaries for processing while waiting for translations
    var flattenedDictionary = (0, react_1.useMemo)(function () { return (0, internal_1.flattenDictionary)(dictionary); }, [dictionary]);
    // Get strings that have changed
    var stringData = (0, react_1.useMemo)(function () {
        if (!translationRequired)
            return {};
        return Object.entries(flattenedDictionary)
            .filter(function (_a) {
            var id = _a[0], entryWithMetadata = _a[1];
            var entry = (0, extractEntryMetadata_1.default)(entryWithMetadata).entry;
            if (typeof entry === "string") {
                if (!entry.length) {
                    console.warn("gt-react warn: Empty string found in dictionary with id: ".concat(id));
                    return;
                }
                return true;
            }
            return false;
        })
            .reduce(function (acc, _a) {
            var id = _a[0], entryWithMetadata = _a[1];
            var _b = (0, extractEntryMetadata_1.default)(entryWithMetadata), entry = _b.entry, metadata = _b.metadata;
            var context = metadata === null || metadata === void 0 ? void 0 : metadata.context;
            var source = (0, generaltranslation_1.splitStringToContent)(entry);
            var hash = (0, id_1.hashJsxChildren)({ source: source, context: context });
            acc[id] = { source: source, hash: hash };
            return acc;
        }, {});
    }, [flattenedDictionary, translationRequired]);
    var _l = (0, react_1.useMemo)(function () {
        var stringIsLoading = false;
        var unresolvedDictionaryStringsAndHashes = Object.entries(stringData).filter(function (_a) {
            var _b, _c, _d;
            var id = _a[0], hash = _a[1].hash;
            if (((_c = (_b = translations === null || translations === void 0 ? void 0 : translations[id]) === null || _b === void 0 ? void 0 : _b[hash]) === null || _c === void 0 ? void 0 : _c.state) === "loading")
                stringIsLoading = true;
            return !((_d = translations === null || translations === void 0 ? void 0 : translations[id]) === null || _d === void 0 ? void 0 : _d[hash]);
        });
        var dictionaryStringsResolved = !stringIsLoading && unresolvedDictionaryStringsAndHashes.length === 0;
        return [unresolvedDictionaryStringsAndHashes, dictionaryStringsResolved];
    }, [translations, stringData]), unresolvedDictionaryStringsAndHashes = _l[0], dictionaryStringsResolved = _l[1];
    // do translation strings (API)
    // this useEffect is for translating strings in the dictionary before the page loads
    // page will block until strings are loaded (so errors or translations)
    (0, react_2.useEffect)(function () {
        // tx required or dict strings already resolved
        if (!translationRequired || !unresolvedDictionaryStringsAndHashes.length)
            return;
        // iterate through unresolvedDictionaryStringsAndHashes
        unresolvedDictionaryStringsAndHashes.forEach(function (_a) {
            var id = _a[0], _b = _a[1], hash = _b.hash, source = _b.source;
            var metadata = (0, extractEntryMetadata_1.default)(flattenedDictionary[id]).metadata;
            // Translate the content
            translateContent({
                source: source,
                targetLocale: locale,
                metadata: __assign(__assign({}, metadata), { id: id, hash: hash }),
            });
        });
        // is this already translated? if so, skip
    }, [
        translationRequired,
        unresolvedDictionaryStringsAndHashes,
        flattenedDictionary,
    ]);
    // ----- TRANSLATE FUNCTION FOR DICTIONARIES ----- //
    var translateDictionaryEntry = (0, react_2.useCallback)(function (id, options) {
        // ----- SETUP ----- //
        var _a;
        if (options === void 0) { options = {}; }
        // get the dictionary entry
        var dictionaryEntry = (0, getDictionaryEntry_1.default)(flattenedDictionary, id);
        if (!dictionaryEntry && dictionaryEntry !== "")
            return undefined; // dictionary entry not found
        // Parse the dictionary entry
        var _b = (0, extractEntryMetadata_1.default)(dictionaryEntry), entry = _b.entry, metadata = _b.metadata;
        var variables = options;
        var variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
        // ----- RENDER STRINGS ----- //
        if (typeof entry === "string") {
            // render strings
            // Reject empty strings
            if (!entry.length) {
                console.warn("gt-react warn: Empty string found in dictionary with id: ".concat(id));
                return entry;
            }
            // no translation required
            var content = (0, generaltranslation_1.splitStringToContent)(entry);
            if (!translationRequired) {
                return (0, generaltranslation_1.renderContentToString)(content, locales, variables, variablesOptions);
            }
            // get translation entry
            var context = metadata === null || metadata === void 0 ? void 0 : metadata.context;
            var hash = (metadata === null || metadata === void 0 ? void 0 : metadata.hash) || (0, id_1.hashJsxChildren)({ source: content, context: context });
            var translationEntry = (_a = translations === null || translations === void 0 ? void 0 : translations[id]) === null || _a === void 0 ? void 0 : _a[hash];
            // error behavior
            if (!translationEntry || (translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) !== "success") {
                return (0, generaltranslation_1.renderContentToString)(content, locales, variables, variablesOptions);
            }
            // render translated content
            return (0, generaltranslation_1.renderContentToString)(translationEntry.target, [locale, defaultLocale], variables, variablesOptions);
        }
        // ----- RENDER JSX ----- //
        // Reject empty fragments
        if ((0, internal_1.isEmptyReactFragment)(entry)) {
            console.warn("gt-react warn: Empty fragment found in dictionary with id: ".concat(id));
            return entry;
        }
        return ((0, jsx_runtime_1.jsx)(T_1.default, __assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
    }, [
        dictionary,
        translations,
        translationRequired,
        defaultLocale,
        flattenedDictionary,
        dictionaryStringsResolved,
    ]);
    var _m = (0, useRuntimeTranslation_1.default)(__assign({ targetLocale: locale, projectId: projectId, defaultLocale: defaultLocale, devApiKey: devApiKey, runtimeUrl: runtimeUrl, renderSettings: renderSettings, setTranslations: setTranslations }, metadata)), translateChildren = _m.translateChildren, translateContent = _m.translateContent, translationEnabled = _m.translationEnabled;
    // hang until cache response, then render translations or loading state (when waiting on API response)
    return ((0, jsx_runtime_1.jsx)(GTContext_1.GTContext.Provider, { value: {
            translateDictionaryEntry: translateDictionaryEntry,
            translateContent: translateContent,
            translateChildren: translateChildren,
            locale: locale,
            defaultLocale: defaultLocale,
            translations: translations,
            translationRequired: translationRequired,
            dialectTranslationRequired: dialectTranslationRequired,
            projectId: projectId,
            translationEnabled: translationEnabled,
            renderSettings: renderSettings,
        }, children: dictionaryStringsResolved && translations && children }));
}
//# sourceMappingURL=GTProvider.js.map