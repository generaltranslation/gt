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
var react_1 = require("react");
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
        var _c, getDefaultLocale, requiresTranslation, getCachedTranslations, isDevelopmentApiEnabled, getClientSideConfig, getLocales, translateContent, locale, defaultLocale, _d, translationRequired, dialectTranslationRequired, cachedTranslationsPromise, provisionalDictionary, dictionary, translations, promises, cachedTranslations, developmentApiEnabled, _i, _e, _f, id_2, value, _g, entry, metadata, source, context, hash;
        var children = _b.children, id = _b.id;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _c = (0, getI18NConfig_1.default)(), getDefaultLocale = _c.getDefaultLocale, requiresTranslation = _c.requiresTranslation, getCachedTranslations = _c.getCachedTranslations, isDevelopmentApiEnabled = _c.isDevelopmentApiEnabled, getClientSideConfig = _c.getClientSideConfig, getLocales = _c.getLocales, translateContent = _c.translateContent;
                    return [4 /*yield*/, (0, getLocale_1.default)()];
                case 1:
                    locale = _h.sent();
                    defaultLocale = getDefaultLocale();
                    _d = requiresTranslation(locale), translationRequired = _d[0], dialectTranslationRequired = _d[1];
                    cachedTranslationsPromise = translationRequired ? getCachedTranslations(locale) : {};
                    provisionalDictionary = (id ? (0, getDictionary_1.getDictionaryEntry)(id) : (0, getDictionary_1.default)()) || {};
                    // Check provisional dictionary
                    if ((0, react_1.isValidElement)(provisionalDictionary) ||
                        Array.isArray(provisionalDictionary) ||
                        typeof provisionalDictionary !== 'object') {
                        // cannot be a DictionaryEntry, must be a Dictionary
                        throw new Error((0, createErrors_1.createDictionarySubsetError)(id !== null && id !== void 0 ? id : '', '<GTProvider>'));
                    }
                    dictionary = (0, internal_1.flattenDictionary)(provisionalDictionary);
                    translations = {};
                    promises = {};
                    if (!translationRequired) return [3 /*break*/, 3];
                    return [4 /*yield*/, cachedTranslationsPromise];
                case 2:
                    cachedTranslations = _h.sent();
                    developmentApiEnabled = isDevelopmentApiEnabled();
                    for (_i = 0, _e = Object.entries(dictionary); _i < _e.length; _i++) {
                        _f = _e[_i], id_2 = _f[0], value = _f[1];
                        _g = (0, internal_1.getEntryAndMetadata)(value), entry = _g.entry, metadata = _g.metadata;
                        source = (0, generaltranslation_1.splitStringToContent)(entry);
                        context = metadata === null || metadata === void 0 ? void 0 : metadata.context;
                        hash = (0, id_1.hashJsxChildren)(__assign({ source: source, id: id_2 }, (context && { context: context })));
                        if (cachedTranslations === null || cachedTranslations === void 0 ? void 0 : cachedTranslations[hash]) {
                            translations[hash] = cachedTranslations[hash];
                            continue;
                        }
                        if (developmentApiEnabled) {
                            promises[id_2] = translateContent({
                                source: source,
                                targetLocale: locale,
                                options: __assign({ hash: hash, id: id_2 }, (context && { context: context }))
                            });
                        }
                    }
                    _h.label = 3;
                case 3: return [2 /*return*/, ((0, jsx_runtime_1.jsx)(ClientProviderWrapper_1.default, __assign({ dictionary: dictionary, initialTranslations: translations, translationPromises: promises, locale: locale, locales: getLocales(), defaultLocale: defaultLocale, translationRequired: translationRequired, dialectTranslationRequired: dialectTranslationRequired }, getClientSideConfig(), { children: children })))];
            }
        });
    });
}
//# sourceMappingURL=GTProvider.js.map