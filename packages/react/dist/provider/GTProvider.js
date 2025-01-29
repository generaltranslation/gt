"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
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
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const generaltranslation_1 = require("generaltranslation");
const react_2 = require("react");
const useBrowserLocale_1 = __importDefault(require("../hooks/useBrowserLocale"));
const GTContext_1 = require("./GTContext");
const getDictionaryEntry_1 = __importDefault(require("./helpers/getDictionaryEntry"));
const internal_1 = require("../internal");
const extractEntryMetadata_1 = __importDefault(require("./helpers/extractEntryMetadata"));
const internal_2 = require("generaltranslation/internal");
const createMessages_1 = require("../messages/createMessages");
const supported_locales_1 = require("@generaltranslation/supported-locales");
const useRuntimeTranslation_1 = __importDefault(require("./runtime/useRuntimeTranslation"));
const defaultRenderSettings_1 = require("./rendering/defaultRenderSettings");
const id_1 = require("generaltranslation/id");
const T_1 = __importDefault(require("../inline/T"));
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
    var { children, projectId, dictionary = {}, locales = (0, supported_locales_1.listSupportedLocales)(), defaultLocale = internal_2.libraryDefaultLocale, locale = (0, useBrowserLocale_1.default)(defaultLocale, locales) || defaultLocale, cacheUrl = internal_2.defaultCacheUrl, runtimeUrl = internal_2.defaultRuntimeApiUrl, renderSettings = defaultRenderSettings_1.defaultRenderSettings, devApiKey } = _a, metadata = __rest(_a, ["children", "projectId", "dictionary", "locales", "defaultLocale", "locale", "cacheUrl", "runtimeUrl", "renderSettings", "devApiKey"]);
    if (!projectId &&
        (cacheUrl === internal_2.defaultCacheUrl || runtimeUrl === internal_2.defaultRuntimeApiUrl)) {
        throw new Error(createMessages_1.projectIdMissingError);
    }
    if (renderSettings.timeout === undefined &&
        defaultRenderSettings_1.defaultRenderSettings.timeout !== undefined) {
        renderSettings.timeout = defaultRenderSettings_1.defaultRenderSettings.timeout;
    }
    // get tx required info
    const [translationRequired, dialectTranslationRequired] = (0, react_1.useMemo)(() => {
        const translationRequired = (0, generaltranslation_1.requiresTranslation)(defaultLocale, locale, locales);
        const dialectTranslationRequired = translationRequired && (0, generaltranslation_1.isSameLanguage)(defaultLocale, locale);
        return [translationRequired, dialectTranslationRequired];
    }, [defaultLocale, locale, locales]);
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
    const [translations, setTranslations] = (0, react_2.useState)(cacheUrl && translationRequired ? null : {});
    // ----- CHECK CACHE FOR TX ----- //
    (0, react_2.useEffect)(() => {
        // check if cache fetch is necessary
        if (translations || !translationRequired)
            return;
        // fetch translations from cache
        (() => __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(`${cacheUrl}/${projectId}/${locale}`);
                const result = yield response.json();
                // convert to translation success and record
                const parsedResult = Object.entries(result).reduce((translationsAcc, [id, hashToTranslation]) => {
                    translationsAcc[id] = Object.entries(hashToTranslation || {}).reduce((idAcc, [hash, content]) => {
                        idAcc[hash] = { state: "success", entry: content };
                        return idAcc;
                    }, {});
                    return translationsAcc;
                }, {});
                setTranslations(parsedResult);
            }
            catch (error) {
                setTranslations({}); // not classified as a tx error, bc we can still fetch from API
            }
        }))();
    }, [translations, translationRequired, cacheUrl, projectId, locale]);
    // ----- PERFORM DICTIONARY TRANSLATION ----- //
    // Flatten dictionaries for processing while waiting for translations
    const flattenedDictionary = (0, react_1.useMemo)(() => (0, internal_1.flattenDictionary)(dictionary), [dictionary]);
    // Get strings that have changed
    const stringData = (0, react_1.useMemo)(() => {
        if (!translationRequired)
            return {};
        return Object.entries(flattenedDictionary)
            .filter(([id, entryWithMetadata]) => {
            const { entry } = (0, extractEntryMetadata_1.default)(entryWithMetadata);
            if (typeof entry === "string") {
                if (!entry.length) {
                    console.warn(`gt-react warn: Empty string found in dictionary with id: ${id}`);
                    return;
                }
                return true;
            }
            return false;
        })
            .reduce((acc, [id, entryWithMetadata]) => {
            const { entry, metadata } = (0, extractEntryMetadata_1.default)(entryWithMetadata);
            const context = metadata === null || metadata === void 0 ? void 0 : metadata.context;
            const source = (0, generaltranslation_1.splitStringToContent)(entry);
            const hash = (0, id_1.hashJsxChildren)({ source, context });
            acc[id] = { source, hash };
            return acc;
        }, {});
    }, [flattenedDictionary, translationRequired]);
    const [unresolvedDictionaryStringsAndHashes, dictionaryStringsResolved] = (0, react_1.useMemo)(() => {
        let stringIsLoading = false;
        const unresolvedDictionaryStringsAndHashes = Object.entries(stringData).filter(([id, { hash }]) => {
            var _a, _b, _c;
            if (((_b = (_a = translations === null || translations === void 0 ? void 0 : translations[id]) === null || _a === void 0 ? void 0 : _a[hash]) === null || _b === void 0 ? void 0 : _b.state) === "loading")
                stringIsLoading = true;
            return !((_c = translations === null || translations === void 0 ? void 0 : translations[id]) === null || _c === void 0 ? void 0 : _c[hash]);
        });
        const dictionaryStringsResolved = !stringIsLoading && unresolvedDictionaryStringsAndHashes.length === 0;
        return [unresolvedDictionaryStringsAndHashes, dictionaryStringsResolved];
    }, [translations, stringData]);
    // do translation strings (API)
    // this useEffect is for translating strings in the dictionary before the page loads
    // page will block until strings are loaded (so errors or translations)
    (0, react_2.useEffect)(() => {
        // tx required or dict strings already resolved
        if (!translationRequired || !unresolvedDictionaryStringsAndHashes.length)
            return;
        // iterate through unresolvedDictionaryStringsAndHashes
        unresolvedDictionaryStringsAndHashes.forEach(([id, { hash, source }]) => {
            const { metadata } = (0, extractEntryMetadata_1.default)(flattenedDictionary[id]);
            // Translate the content
            translateContent({
                source,
                targetLocale: locale,
                metadata: Object.assign(Object.assign({}, metadata), { id,
                    hash }),
            });
        });
        // is this already translated? if so, skip
    }, [
        translationRequired,
        unresolvedDictionaryStringsAndHashes,
        flattenedDictionary,
    ]);
    // ----- TRANSLATE FUNCTION FOR DICTIONARIES ----- //
    const translateDictionaryEntry = (0, react_2.useCallback)((id, options = {}) => {
        // ----- SETUP ----- //
        var _a;
        // get the dictionary entry
        const dictionaryEntry = (0, getDictionaryEntry_1.default)(flattenedDictionary, id);
        if (!dictionaryEntry && dictionaryEntry !== "")
            return undefined; // dictionary entry not found
        // Parse the dictionary entry
        const { entry, metadata } = (0, extractEntryMetadata_1.default)(dictionaryEntry);
        const variables = options;
        const variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
        // ----- RENDER STRINGS ----- //
        if (typeof entry === "string") {
            // render strings
            // Reject empty strings
            if (!entry.length) {
                console.warn(`gt-react warn: Empty string found in dictionary with id: ${id}`);
                return entry;
            }
            // no translation required
            const content = (0, generaltranslation_1.splitStringToContent)(entry);
            if (!translationRequired) {
                return (0, generaltranslation_1.renderContentToString)(content, locales, variables, variablesOptions);
            }
            // get translation entry
            const context = metadata === null || metadata === void 0 ? void 0 : metadata.context;
            const hash = (metadata === null || metadata === void 0 ? void 0 : metadata.hash) || (0, id_1.hashJsxChildren)({ source: content, context });
            const translationEntry = (_a = translations === null || translations === void 0 ? void 0 : translations[id]) === null || _a === void 0 ? void 0 : _a[hash];
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
            console.warn(`gt-react warn: Empty fragment found in dictionary with id: ${id}`);
            return entry;
        }
        return ((0, jsx_runtime_1.jsx)(T_1.default, Object.assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
    }, [
        dictionary,
        translations,
        translationRequired,
        defaultLocale,
        flattenedDictionary,
        dictionaryStringsResolved,
    ]);
    const { translateChildren, translateContent, translationEnabled } = (0, useRuntimeTranslation_1.default)(Object.assign({ targetLocale: locale, projectId,
        defaultLocale,
        devApiKey,
        runtimeUrl,
        renderSettings,
        setTranslations }, metadata));
    // hang until cache response, then render translations or loading state (when waiting on API response)
    return ((0, jsx_runtime_1.jsx)(GTContext_1.GTContext.Provider, { value: {
            translateDictionaryEntry,
            translateContent,
            translateChildren,
            locale,
            defaultLocale,
            translations,
            translationRequired,
            dialectTranslationRequired,
            projectId,
            translationEnabled,
            renderSettings,
        }, children: dictionaryStringsResolved && translations && children }));
}
//# sourceMappingURL=GTProvider.js.map