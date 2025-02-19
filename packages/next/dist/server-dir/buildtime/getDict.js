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
exports.default = getDict;
var jsx_runtime_1 = require("react/jsx-runtime");
var internal_1 = require("gt-react/internal");
var T_1 = __importDefault(require("./T"));
var getDictionary_1 = __importStar(require("../../dictionary/getDictionary"));
var getLocale_1 = __importDefault(require("../../request/getLocale"));
var getI18NConfig_1 = __importDefault(require("../../config-dir/getI18NConfig"));
var generaltranslation_1 = require("generaltranslation");
var createErrors_1 = require("../../errors/createErrors");
var react_1 = require("react");
var id_1 = require("generaltranslation/id");
/**
 * Returns the dictionary access function `d()`, which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const d = await getDict('user');
 * console.log(d('name')); // Translates item 'user.name'
 *
 * const d = await getDict();
 * console.log(d('hello')); // Translates item 'hello'
 */
function getDict(id) {
    return __awaiter(this, void 0, void 0, function () {
        var getId, I18NConfig, defaultLocale, locale, translationRequired, serverRuntimeTranslationEnabled, stringTranslationsById, translationsPromise, dictionarySubset, flattenedDictionaryEntries, translations_1, d;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    getId = function (suffix) {
                        return id ? "".concat(id, ".").concat(suffix) : suffix;
                    };
                    I18NConfig = (0, getI18NConfig_1.default)();
                    if (!I18NConfig.isDictionaryEnabled()) {
                        if (process.env.NODE_ENV === 'production') {
                            console.error(createErrors_1.dictionaryDisabledError);
                            return [2 /*return*/, function () { return undefined; }];
                        }
                        else {
                            throw new Error(createErrors_1.dictionaryDisabledError);
                        }
                    }
                    defaultLocale = I18NConfig.getDefaultLocale();
                    return [4 /*yield*/, (0, getLocale_1.default)()];
                case 1:
                    locale = _a.sent();
                    translationRequired = I18NConfig.requiresTranslation(locale);
                    serverRuntimeTranslationEnabled = I18NConfig.isServerRuntimeTranslationEnabled() &&
                        process.env.NODE_ENV === 'development';
                    stringTranslationsById = {};
                    if (!translationRequired) return [3 /*break*/, 4];
                    translationsPromise = I18NConfig.getCachedTranslations(locale);
                    dictionarySubset = (id ? (0, getDictionary_1.getDictionaryEntry)(id) : (0, getDictionary_1.default)()) || {};
                    if (typeof dictionarySubset !== 'object' || Array.isArray(dictionarySubset))
                        // check that it is a Dictionary, not a Dictionary Entry
                        throw new Error((0, createErrors_1.createDictionarySubsetError)(id !== null && id !== void 0 ? id : '', 'getDict'));
                    flattenedDictionaryEntries = (0, internal_1.flattenDictionary)(dictionarySubset);
                    return [4 /*yield*/, translationsPromise];
                case 2:
                    translations_1 = _a.sent();
                    // ----- RESOLVE TRANSLATIONS ----- //
                    // Translate all strings in sub dictionary (block until completed)
                    return [4 /*yield*/, Promise.all(Object.entries(flattenedDictionaryEntries !== null && flattenedDictionaryEntries !== void 0 ? flattenedDictionaryEntries : {}).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var _c, entry, metadata, entryId, source, hash, translationEntry, translationPromise, _d, _e, error_1;
                            var suffix = _b[0], dictionaryEntry = _b[1];
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        _c = (0, internal_1.getEntryAndMetadata)(dictionaryEntry), entry = _c.entry, metadata = _c.metadata;
                                        // only tx strings
                                        if (typeof entry !== 'string')
                                            return [2 /*return*/];
                                        entryId = getId(suffix);
                                        // Skip empty strings
                                        if (!entry.length) {
                                            console.warn("gt-next warn: Empty string found in dictionary with id: ".concat(entryId));
                                            return [2 /*return*/];
                                        }
                                        source = (0, generaltranslation_1.splitStringToContent)(entry);
                                        hash = (0, id_1.hashJsxChildren)(__assign(__assign({ source: source }, ((metadata === null || metadata === void 0 ? void 0 : metadata.context) && { context: metadata === null || metadata === void 0 ? void 0 : metadata.context })), { id: entryId }));
                                        translationEntry = translations_1[hash];
                                        if (translationEntry) {
                                            // success
                                            if (translationEntry.state === 'success') {
                                                return [2 /*return*/, (stringTranslationsById[entryId] =
                                                        translationEntry.target)];
                                            }
                                            // error fallback (strings in local cache will only be success or error)
                                            return [2 /*return*/];
                                        }
                                        // ----- ON DEMAND TRANSLATE STRING ----- //
                                        // dev only (with api key)
                                        // Skip if dev runtime translation is disabled
                                        if (!serverRuntimeTranslationEnabled)
                                            return [2 /*return*/];
                                        translationPromise = I18NConfig.translateContent({
                                            source: source,
                                            targetLocale: locale,
                                            options: { id: entryId, hash: hash },
                                        });
                                        _f.label = 1;
                                    case 1:
                                        _f.trys.push([1, 3, , 4]);
                                        _d = stringTranslationsById;
                                        _e = entryId;
                                        return [4 /*yield*/, translationPromise];
                                    case 2:
                                        _d[_e] = _f.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_1 = _f.sent();
                                        console.error((0, createErrors_1.createDictionaryStringTranslationError)(entryId), error_1);
                                        return [2 /*return*/];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 3:
                    // ----- RESOLVE TRANSLATIONS ----- //
                    // Translate all strings in sub dictionary (block until completed)
                    _a.sent();
                    _a.label = 4;
                case 4:
                    d = function (id, options) {
                        // ----- SET UP ----- //
                        if (options === void 0) { options = {}; }
                        // Get entry
                        id = getId(id);
                        var dictionaryEntry = (0, getDictionary_1.getDictionaryEntry)(id);
                        if (dictionaryEntry === undefined ||
                            dictionaryEntry === null || // no entry found
                            (typeof dictionaryEntry === 'object' &&
                                !(0, react_1.isValidElement)(dictionaryEntry) &&
                                !Array.isArray(dictionaryEntry)) // make sure is DictionaryEntry, not Dictionary
                        ) {
                            console.warn((0, createErrors_1.createNoEntryWarning)(id));
                            return undefined;
                        }
                        var _a = (0, internal_1.getEntryAndMetadata)(dictionaryEntry), entry = _a.entry, metadata = _a.metadata;
                        // Get variables and variable options
                        var variables = options;
                        var variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
                        // ----- STRINGS ----- //
                        // Render strings
                        if (typeof entry === 'string') {
                            var source = stringTranslationsById[id] || (0, generaltranslation_1.splitStringToContent)(entry);
                            return (0, generaltranslation_1.renderContentToString)(source, [locale, defaultLocale], variables, variablesOptions);
                        }
                        // ----- JSX ----- //
                        // Translate on demand
                        return ((0, jsx_runtime_1.jsx)(T_1.default, __assign({ id: id, variables: variables, variablesOptions: variablesOptions }, metadata, { children: entry })));
                    };
                    return [2 /*return*/, d];
            }
        });
    });
}
//# sourceMappingURL=getDict.js.map