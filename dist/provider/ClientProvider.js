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
var ClientResolver_1 = __importDefault(require("./ClientResolver"));
var renderVariable_1 = __importDefault(require("../server/rendering/renderVariable"));
// meant to be used inside the server-side <GTProvider>
function ClientProvider(_a) {
    var children = _a.children, dictionary = _a.dictionary, translations = _a.translations, locale = _a.locale, defaultLocale = _a.defaultLocale, translationRequired = _a.translationRequired;
    // For dictionaries
    var translate = (0, react_1.useCallback)(function (id, options, f) {
        var _a;
        if (options === void 0) { options = {}; }
        // Get the entry from the dictionary
        var _b = (0, internal_2.extractEntryMetadata)(dictionary[id]), entry = _b.entry, metadata = _b.metadata;
        if (typeof entry === 'undefined') {
            console.warn("Dictionary entry with id \"".concat(id, "\" is null or undefined"));
            return undefined;
        }
        // Handle functional entries
        if (metadata === null || metadata === void 0 ? void 0 : metadata.isFunction) {
            if (typeof f === 'function') {
                entry = (0, internal_2.addGTIdentifier)(f(options));
            }
            else {
                throw new Error("You're trying to call a function in the server dictionary on the client-side, but functions can't be passed directly from server to client. " +
                    "Try including the function you want to call as a parameter in t(), like t(\"".concat(id, "\", ").concat(options ? JSON.stringify(options) : 'undefined', ", MyFunction)"));
            }
        }
        ;
        // Initialize and populate variables and variables' metadata
        var variables = options;
        var variablesOptions;
        if (metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions)
            variablesOptions = __assign(__assign({}, (variablesOptions || {})), metadata.variablesOptions);
        if (options.variablesOptions)
            variablesOptions = __assign(__assign({}, (variablesOptions || {})), options.variablesOptions);
        // Handle string and content entries, if and !if translation required
        if (typeof entry === 'string') {
            var content = translationRequired ? (((_a = translations[id]) === null || _a === void 0 ? void 0 : _a.t) || entry) : entry;
            return (0, generaltranslation_1.renderContentToString)(content, [locale, defaultLocale], variables, variablesOptions);
        }
        // Fallback if there is no translation present
        if (!translationRequired || !translations[id]) {
            return (0, internal_1.renderDefaultChildren)({
                children: entry,
                variables: variables,
                variablesOptions: variablesOptions,
                defaultLocale: defaultLocale,
                renderVariable: renderVariable_1.default
            });
        }
        var renderTranslation = function (translationEntry) {
            return (0, internal_1.renderTranslatedChildren)({
                source: entry,
                target: translationEntry,
                variables: variables,
                variablesOptions: variablesOptions,
                locales: [locale, defaultLocale],
                renderVariable: renderVariable_1.default
            });
        };
        var translation = translations[id];
        if (translation.promise) { // i.e. no translation.t
            if (!translation.errorFallback) {
                translation.errorFallback = (0, internal_1.renderDefaultChildren)({
                    children: entry,
                    variables: variables,
                    variablesOptions: variablesOptions,
                    defaultLocale: defaultLocale,
                    renderVariable: renderVariable_1.default
                });
            }
            if (!translation.loadingFallback) {
                translation.loadingFallback = translation.errorFallback;
            }
            return ((0, jsx_runtime_1.jsx)(ClientResolver_1.default, { promise: translation.promise, renderTranslation: renderTranslation, errorFallback: translation.errorFallback, loadingFallback: translation.loadingFallback }));
        }
        return renderTranslation(translation.t);
    }, [dictionary, translations]);
    return ((0, jsx_runtime_1.jsx)(client_1.GTContext.Provider, { value: {
            translate: translate,
            locale: locale,
            defaultLocale: defaultLocale,
            translations: translations,
            translationRequired: translationRequired
        }, children: children }));
}
//# sourceMappingURL=ClientProvider.js.map