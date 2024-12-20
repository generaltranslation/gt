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
var internal_2 = require("gt-react/internal");
var generaltranslation_1 = require("generaltranslation");
var renderVariable_1 = __importDefault(require("../server/rendering/renderVariable"));
var createErrors_1 = require("../errors/createErrors");
// meant to be used inside the server-side <GTProvider>
function ClientProvider(_a) {
    var _this = this;
    var children = _a.children, dictionary = _a.dictionary, initialTranslations = _a.initialTranslations, locale = _a.locale, defaultLocale = _a.defaultLocale, translationRequired = _a.translationRequired, requiredPrefix = _a.requiredPrefix, renderSettings = _a.renderSettings, projectId = _a.projectId, devApiKey = _a.devApiKey, baseUrl = _a.baseUrl;
    var _b = (0, react_1.useState)(null), translations = _b[0], setTranslations = _b[1];
    (0, react_1.useLayoutEffect)(function () {
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var awaitedTranslations;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        awaitedTranslations = {};
                        return [4 /*yield*/, Promise.all(Object.entries(initialTranslations !== null && initialTranslations !== void 0 ? initialTranslations : {}).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                var translation, error_1;
                                var _c;
                                var id = _b[0], obj = _b[1];
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0:
                                            if (!(obj === null || obj === void 0 ? void 0 : obj.promise)) return [3 /*break*/, 4];
                                            _d.label = 1;
                                        case 1:
                                            _d.trys.push([1, 3, , 4]);
                                            return [4 /*yield*/, obj.promise];
                                        case 2:
                                            translation = _d.sent();
                                            if ('error' in translation) {
                                                awaitedTranslations[id] = undefined; // will create an error fallback
                                            }
                                            else {
                                                awaitedTranslations[id] = (_c = {}, _c[obj.hash] = translation, _c);
                                            }
                                            return [3 /*break*/, 4];
                                        case 3:
                                            error_1 = _d.sent();
                                            awaitedTranslations[id] = undefined;
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
    var translate = (0, react_1.useCallback)(function (id, options) {
        if (options === void 0) { options = {}; }
        if (requiredPrefix && !(id === null || id === void 0 ? void 0 : id.startsWith(requiredPrefix)))
            throw new Error((0, createErrors_1.createRequiredPrefixError)(id, requiredPrefix));
        var dictionaryEntry = dictionary[id];
        if (dictionaryEntry === undefined || dictionaryEntry === null ||
            (typeof dictionaryEntry === 'object' && !Array.isArray(dictionaryEntry))) {
            console.warn((0, createErrors_1.createNoEntryWarning)(id));
            return undefined;
        }
        ;
        // Get the entry from the dictionary
        var _a = (0, internal_2.extractEntryMetadata)(dictionaryEntry), entry = _a.entry, metadata = _a.metadata;
        // Initialize and populate variables and variables' metadata
        var variables = options;
        var variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
        // ----- STRING ENTRIES ----- // 
        if (typeof entry === 'string') {
            var renderString = function (content) {
                return (0, generaltranslation_1.renderContentToString)(content, [locale, defaultLocale], variables, variablesOptions);
            };
            if (!translationRequired)
                return renderString(entry);
            var translation_1 = translations === null || translations === void 0 ? void 0 : translations[id];
            return renderString((translation_1 === null || translation_1 === void 0 ? void 0 : translation_1[metadata === null || metadata === void 0 ? void 0 : metadata.hash]) ||
                (translation_1 === null || translation_1 === void 0 ? void 0 : translation_1.loadingFallback) ||
                entry // error fallback
            );
        }
        // ----- JSX ENTRIES ----- // 
        var renderDefault = function () {
            return (0, internal_1.renderDefaultChildren)({
                children: entry,
                variables: variables,
                variablesOptions: variablesOptions,
                defaultLocale: defaultLocale,
                renderVariable: renderVariable_1.default
            });
        };
        // Fallback if there is no translation present
        if (!translationRequired)
            return renderDefault();
        var translation = translations === null || translations === void 0 ? void 0 : translations[id];
        if (!translation)
            return renderDefault(); // error fallback
        var renderTranslation = function (target) {
            return (0, internal_1.renderTranslatedChildren)({
                source: entry,
                target: target,
                variables: variables,
                variablesOptions: variablesOptions,
                locales: [locale, defaultLocale],
                renderVariable: renderVariable_1.default
            });
        };
        if (translation === null || translation === void 0 ? void 0 : translation.promise) {
            translation.errorFallback || (translation.errorFallback = renderDefault());
            translation.loadingFallback || (translation.loadingFallback = translation.errorFallback);
            return (translation.loadingFallback);
        }
        ;
        return renderTranslation(translation === null || translation === void 0 ? void 0 : translation[metadata === null || metadata === void 0 ? void 0 : metadata.hash]);
    }, [dictionary, translations]);
    // For <T> components
    var _c = (0, client_1.useDynamicTranslation)({
        projectId: projectId,
        devApiKey: devApiKey,
        baseUrl: baseUrl,
        setTranslations: setTranslations,
        defaultLocale: defaultLocale
    }), translateChildren = _c.translateChildren, translateContent = _c.translateContent;
    return ((0, jsx_runtime_1.jsx)(client_1.GTContext.Provider, { value: {
            translate: translate,
            translateChildren: translateChildren,
            translateContent: translateContent,
            locale: locale,
            defaultLocale: defaultLocale,
            translations: translations,
            translationRequired: translationRequired,
            renderSettings: renderSettings
        }, children: translations && children }));
}
//# sourceMappingURL=ClientProvider.js.map