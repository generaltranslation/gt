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
exports.default = GTProvider;
var jsx_runtime_1 = require("react/jsx-runtime");
var internal_1 = require("gt-react/internal");
var getI18NConfig_1 = __importDefault(require("../config/getI18NConfig"));
var getLocale_1 = __importDefault(require("../request/getLocale"));
var getMetadata_1 = __importDefault(require("../request/getMetadata"));
var generaltranslation_1 = require("generaltranslation");
var getDictionary_1 = __importStar(require("../dictionary/getDictionary"));
var ClientProvider_1 = __importDefault(require("./ClientProvider"));
var createErrors_1 = require("../errors/createErrors");
/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} id - ID of a nested dictionary, so that only a subset of a large dictionary needs to be sent to the client.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
function GTProvider(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var getId, I18NConfig, locale, additionalMetadata, defaultLocale, translationRequired, dialectTranslationRequired, translationsPromise, dictionarySubset, flattenedDictionarySubset, translations, _c, dictionary, promises;
        var _this = this;
        var children = _b.children, id = _b.id;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    getId = function (suffix) { return id ? "".concat(id, ".").concat(suffix) : suffix; };
                    I18NConfig = (0, getI18NConfig_1.default)();
                    return [4 /*yield*/, (0, getLocale_1.default)()];
                case 1:
                    locale = _d.sent();
                    return [4 /*yield*/, (0, getMetadata_1.default)()];
                case 2:
                    additionalMetadata = _d.sent();
                    defaultLocale = I18NConfig.getDefaultLocale();
                    translationRequired = I18NConfig.requiresTranslation(locale);
                    dialectTranslationRequired = translationRequired && (0, generaltranslation_1.isSameLanguage)(locale, defaultLocale);
                    translationsPromise = translationRequired && I18NConfig.getCachedTranslations(locale);
                    dictionarySubset = (id ? (0, getDictionary_1.getDictionaryEntry)(id) : (0, getDictionary_1.default)()) || {};
                    if (typeof dictionarySubset !== 'object' || Array.isArray(dictionarySubset)) // cannot be a DictionaryEntry, must be a Dictionary
                        throw new Error((0, createErrors_1.createDictionarySubsetError)(id !== null && id !== void 0 ? id : '', "<GTProvider>"));
                    flattenedDictionarySubset = (0, internal_1.flattenDictionary)(dictionarySubset);
                    if (!(translationsPromise)) return [3 /*break*/, 4];
                    return [4 /*yield*/, translationsPromise];
                case 3:
                    _c = _d.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _c = {};
                    _d.label = 5;
                case 5:
                    translations = _c;
                    dictionary = {};
                    promises = {};
                    // ---- TRANSLATE DICTIONARY STRINGS ---- //
                    /**
                     * Strings Entries: hang until translation resolves
                     * JSX Entries: pass directly to client (translation will be performed on demand)
                     *
                     * We will also be populating the dictionary
                     */
                    return [4 /*yield*/, Promise.all(Object.entries(flattenedDictionarySubset !== null && flattenedDictionarySubset !== void 0 ? flattenedDictionarySubset : {}).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var entryId, _c, entry, metadata, taggedChildren, _d, childrenAsObjects, hash_1, translationEntry_1, translationPromise, contentArray, hash, translationEntry, translation, error_1;
                            var _e, _f;
                            var _g, _h;
                            var suffix = _b[0], dictionaryEntry = _b[1];
                            return __generator(this, function (_j) {
                                switch (_j.label) {
                                    case 0:
                                        // If no translation is required, return
                                        if (!translationRequired)
                                            return [2 /*return*/];
                                        // Get the entry from the dictionary
                                        if (!dictionaryEntry)
                                            return [2 /*return*/]; // dictionary entries cannot be falsey
                                        entryId = getId(suffix);
                                        _c = (0, internal_1.extractEntryMetadata)(dictionaryEntry), entry = _c.entry, metadata = _c.metadata;
                                        if (!entry)
                                            return [2 /*return*/]; // dictionary entries cannot be falsey
                                        // Only translate strings
                                        if (typeof entry !== 'string') {
                                            taggedChildren = I18NConfig.addGTIdentifier(entry);
                                            _d = I18NConfig.serializeAndHashChildren(entry, metadata === null || metadata === void 0 ? void 0 : metadata.context), childrenAsObjects = _d[0], hash_1 = _d[1];
                                            dictionary[entryId] = [taggedChildren, __assign(__assign({}, metadata), { hash: hash_1 })];
                                            translationEntry_1 = (_g = translations === null || translations === void 0 ? void 0 : translations[entryId]) === null || _g === void 0 ? void 0 : _g[hash_1];
                                            // If the translation already exists, then do not translate on demand
                                            // or runtime translation disabled
                                            if (translationEntry_1)
                                                return [2 /*return*/];
                                            translationPromise = I18NConfig.translateChildren({
                                                source: childrenAsObjects,
                                                targetLocale: locale,
                                                metadata: __assign(__assign({}, metadata), { id: entryId, hash: hash_1 }),
                                            });
                                            // record translations as loading and record the promises to use on client-side
                                            translations[entryId] = (_e = {}, _e[hash_1] = { state: 'loading' }, _e);
                                            promises[entryId] = translationPromise;
                                            return [2 /*return*/];
                                        }
                                        ;
                                        contentArray = (0, generaltranslation_1.splitStringToContent)(entry);
                                        hash = (metadata === null || metadata === void 0 ? void 0 : metadata.hash) || I18NConfig.hashContent(contentArray, metadata === null || metadata === void 0 ? void 0 : metadata.context);
                                        // Add to client dictionary
                                        dictionary[entryId] = [entry, __assign(__assign({}, metadata), { hash: hash })];
                                        translationEntry = (_h = translations === null || translations === void 0 ? void 0 : translations[entryId]) === null || _h === void 0 ? void 0 : _h[hash];
                                        // If the translation already exists, then do not translate on demand
                                        if (translationEntry)
                                            return [2 /*return*/];
                                        _j.label = 1;
                                    case 1:
                                        _j.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, I18NConfig.translateContent({
                                                source: contentArray,
                                                targetLocale: locale,
                                                options: __assign(__assign({ id: entryId, hash: hash }, additionalMetadata), { context: metadata === null || metadata === void 0 ? void 0 : metadata.context }),
                                            })];
                                    case 2:
                                        translation = _j.sent();
                                        // overwriting any old translations, this is most recent on demand, so should be most accurate
                                        translations[entryId] = (_f = {}, _f[hash] = { state: 'success', target: translation }, _f);
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_1 = _j.sent();
                                        console.error(error_1);
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 6:
                    // ---- TRANSLATE DICTIONARY STRINGS ---- //
                    /**
                     * Strings Entries: hang until translation resolves
                     * JSX Entries: pass directly to client (translation will be performed on demand)
                     *
                     * We will also be populating the dictionary
                     */
                    _d.sent();
                    return [2 /*return*/, ((0, jsx_runtime_1.jsx)(ClientProvider_1.default, __assign({ dictionary: dictionary, initialTranslations: translations, translationPromises: promises, locale: locale, locales: I18NConfig.getLocales(), defaultLocale: defaultLocale, translationRequired: translationRequired, dialectTranslationRequired: dialectTranslationRequired, requiredPrefix: id, renderSettings: I18NConfig.getRenderSettings() }, I18NConfig.getClientSideConfig(), { children: children })))];
            }
        });
    });
}
//# sourceMappingURL=GTProvider.js.map