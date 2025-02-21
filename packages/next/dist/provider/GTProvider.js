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
var internal_1 = require("gt-react/internal");
var getI18NConfig_1 = __importDefault(require("../config-dir/getI18NConfig"));
var getLocale_1 = __importDefault(require("../request/getLocale"));
var generaltranslation_1 = require("generaltranslation");
var getDictionary_1 = __importStar(require("../dictionary/getDictionary"));
var createErrors_1 = require("../errors/createErrors");
var ClientProviderWrapper_1 = __importDefault(require("./ClientProviderWrapper"));
var id_1 = require("generaltranslation/id");
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
        var getId, I18NConfig, locale, defaultLocale, translationRequired, dialectTranslationRequired, serverRuntimeTranslationEnabled, translationsPromise, dictionarySubset, flattenedDictionarySubset, dictionary, processedDictionary, translations, _c, promises;
        var _this = this;
        var children = _b.children, id = _b.id;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    getId = function (suffix) {
                        return id ? "".concat(id, ".").concat(suffix) : suffix;
                    };
                    I18NConfig = (0, getI18NConfig_1.default)();
                    return [4 /*yield*/, (0, getLocale_1.default)()];
                case 1:
                    locale = _d.sent();
                    defaultLocale = I18NConfig.getDefaultLocale();
                    translationRequired = I18NConfig.requiresTranslation(locale);
                    dialectTranslationRequired = translationRequired && (0, generaltranslation_1.isSameLanguage)(locale, defaultLocale);
                    serverRuntimeTranslationEnabled = I18NConfig.isServerRuntimeTranslationEnabled() &&
                        process.env.NODE_ENV === 'development';
                    translationsPromise = translationRequired && I18NConfig.getCachedTranslations(locale);
                    dictionarySubset = (id ? (0, getDictionary_1.getDictionaryEntry)(id) : (0, getDictionary_1.default)()) || {};
                    if (typeof dictionarySubset !== 'object' || Array.isArray(dictionarySubset)) {
                        // cannot be a DictionaryEntry, must be a Dictionary
                        throw new Error((0, createErrors_1.createDictionarySubsetError)(id !== null && id !== void 0 ? id : '', '<GTProvider>'));
                    }
                    flattenedDictionarySubset = (0, internal_1.flattenDictionary)(dictionarySubset);
                    dictionary = {};
                    processedDictionary = {};
                    Object.entries(flattenedDictionarySubset !== null && flattenedDictionarySubset !== void 0 ? flattenedDictionarySubset : {}).map(function (_a) {
                        // ----- SETUP ----- //
                        var suffix = _a[0], dictionaryEntry = _a[1];
                        // Reject bad dictionary entries
                        if (!dictionaryEntry)
                            return;
                        // Get the entry from the dictionary
                        var entryId = getId(suffix);
                        var _b = (0, internal_1.getEntryAndMetadata)(dictionaryEntry), entry = _b.entry, metadata = _b.metadata;
                        // ---- ADD TO DICTIONARY ---- //
                        // Process input
                        var source, type;
                        if (typeof entry === 'string') {
                            type = 'content';
                            source = (0, generaltranslation_1.splitStringToContent)(entry);
                        }
                        else {
                            type = 'jsx';
                            var taggedChildren = I18NConfig.addGTIdentifier(entry); // Tagging has to be done serverside for streaming purposes (fragments)
                            source = (0, internal_1.writeChildrenAsObjects)(taggedChildren);
                            entry = taggedChildren;
                            console.log(taggedChildren);
                        }
                        // Get identifier
                        // TODO: is it possible to perform this on the client side?
                        var key = (0, id_1.hashJsxChildren)(__assign(__assign({ source: source }, ((metadata === null || metadata === void 0 ? void 0 : metadata.context) && { context: metadata.context })), { id: entryId }));
                        // Add to client dictionary
                        dictionary[entryId] = [entry, __assign(__assign({}, metadata), { hash: key })];
                        // For server runtime translation
                        if (serverRuntimeTranslationEnabled && translationRequired) {
                            processedDictionary[key] = {
                                type: type,
                                source: source,
                                targetLocale: locale,
                                options: __assign({ id: entryId, hash: key }, { context: metadata === null || metadata === void 0 ? void 0 : metadata.context }),
                            };
                        }
                    });
                    if (!translationsPromise) return [3 /*break*/, 3];
                    return [4 /*yield*/, translationsPromise];
                case 2:
                    _c = _d.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _c = {};
                    _d.label = 4;
                case 4:
                    translations = _c;
                    promises = {};
                    if (!(serverRuntimeTranslationEnabled && translationRequired)) return [3 /*break*/, 6];
                    return [4 /*yield*/, Promise.all(Object.entries(processedDictionary).map(function (_a) { return __awaiter(_this, void 0, void 0, function () {
                            var translationEntry, result, error_1;
                            var _b;
                            var key = _a[0], _c = _a[1], type = _c.type, data = __rest(_c, ["type"]);
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        translationEntry = translations === null || translations === void 0 ? void 0 : translations[key];
                                        if (translationEntry) {
                                            return [2 /*return*/];
                                        }
                                        _d.label = 1;
                                    case 1:
                                        _d.trys.push([1, 5, , 6]);
                                        if (!(type === 'content')) return [3 /*break*/, 3];
                                        _b = {
                                            state: 'success'
                                        };
                                        return [4 /*yield*/, I18NConfig.translateContent(data)];
                                    case 2:
                                        // Block until translation resolves
                                        result = (_b.target = _d.sent(),
                                            _b);
                                        return [3 /*break*/, 4];
                                    case 3:
                                        // Record translation promise to pass to client for streaming
                                        promises[key] = I18NConfig.translateChildren(data).then(function (result) {
                                            // Add to translations locally
                                            // TODO: is this necessary?
                                            translations[key] = {
                                                state: 'success',
                                                target: result,
                                            };
                                            return result;
                                        });
                                        // Mark translation as loading
                                        result = { state: 'loading' };
                                        _d.label = 4;
                                    case 4: return [3 /*break*/, 6];
                                    case 5:
                                        error_1 = _d.sent();
                                        // Parse error
                                        if (error_1 instanceof internal_1.GTTranslationError) {
                                            result = error_1.toTranslationError();
                                        }
                                        else {
                                            result = { state: 'error', error: 'An error occured', code: 500 };
                                        }
                                        return [3 /*break*/, 6];
                                    case 6:
                                        translations[key] = result;
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 5:
                    _d.sent();
                    _d.label = 6;
                case 6: 
                // await Promise.all(
                //   Object.entries(flattenedDictionarySubset ?? {}).map(
                //     async ([suffix, dictionaryEntry]) => {
                //       // reject bad dictionary entries (we handle empty strings later)
                //       if (!dictionaryEntry && dictionaryEntry !== '') return;
                //       // Get the entry from the dictionary
                //       const entryId = getId(suffix);
                //       let { entry, metadata } = getEntryAndMetadata(dictionaryEntry);
                //       // ----- JSX ----- //
                //       if (typeof entry !== 'string') {
                //         // ----- TRANSLATE JSX ON DEMAND ----- //
                //         // dev only (with api key) skip if:
                //         if (
                //           !translationRequired || // no translation required
                //           !serverRuntimeTranslationEnabled // dev runtime translation disabled
                //         ) {
                //           return;
                //         }
                //         // get tx entry and key
                //         const translationEntry = translations?.[key];
                //         // skip if translation already exists
                //         if (translationEntry) {
                //           return;
                //         }
                //         // Perform on-demand translation
                //         translations[key] = { state: 'loading' };
                //         const translationPromise = I18NConfig.translateChildren({
                //           source: childrenAsObjects,
                //           targetLocale: locale,
                //           metadata: {
                //             ...metadata,
                //             id: entryId,
                //             hash: key,
                //           },
                //         })
                //           .then((result) => {
                //             translations[key] = {
                //               state: 'success',
                //               target: result,
                //             };
                //             return result;
                //           })
                //           .catch((error) => {
                //             if (error instanceof GTTranslationError) {
                //               error = error.toTranslationError();
                //             } else {
                //               error = {
                //                 state: 'error',
                //                 error: 'An error occured',
                //                 code: 500,
                //               };
                //             }
                //             return error;
                //           });
                //         // record translations as loading and record the promises to use on client-side
                //         promises[key] = translationPromise;
                //         return;
                //       }
                //       // ----- TRANSLATE STRINGS ON DEMAND ----- //
                //       // dev only (with api key) skip if:
                //       if (
                //         !translationRequired || // no translation required
                //         !serverRuntimeTranslationEnabled // dev runtime translation disabled
                //       ) {
                //         return;
                //       }
                //       // get tx entry and key
                //       const translationEntry = translations?.[key];
                //       // skip if translation already exists
                //       if (translationEntry) {
                //         return;
                //       }
                //       // Reject empty strings
                //       if (!entry.length) {
                //         translations[key] = {
                //           state: 'error',
                //           error: 'Empty strings are not allowed for translation.',
                //           code: 400,
                //         };
                //         return;
                //       }
                //       // Perform on-demand translation
                //       try {
                //         // wait for the translation to resolve, we cannot pass our translations to
                //         // the client until all string translations are resolved
                //         const translation = await I18NConfig.translateContent({
                //           source: content,
                //           targetLocale: locale,
                //           options: {
                //             id: entryId,
                //             hash: key,
                //             ...{ context: metadata?.context },
                //           },
                //         });
                //         // overwriting any old translations, this is most recent on demand, so should be most accurate
                //         translations[key] = {
                //           state: 'success',
                //           target: translation,
                //         };
                //       } catch (error) {
                //         console.error(error);
                //         // set all promise ids to error in translations
                //         let result;
                //         if (error instanceof GTTranslationError) {
                //           result = error.toTranslationError();
                //         } else {
                //           result = { state: 'error', error: 'An error occured', code: 500 };
                //         }
                //         translations[key] = result as TranslationError;
                //       }
                //     }
                //   )
                // );
                return [2 /*return*/, ((0, jsx_runtime_1.jsx)(ClientProviderWrapper_1.default, __assign({ dictionary: dictionary, initialTranslations: translations, translationPromises: promises, locale: locale, locales: I18NConfig.getLocales(), defaultLocale: defaultLocale, translationRequired: translationRequired, dialectTranslationRequired: dialectTranslationRequired, requiredPrefix: id, renderSettings: I18NConfig.getRenderSettings() }, I18NConfig.getClientSideConfig(), { children: children })))];
            }
        });
    });
}
//# sourceMappingURL=GTProvider.js.map