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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var getI18NConfig_1 = __importDefault(require("../../config/getI18NConfig"));
var getLocale_1 = __importDefault(require("../../request/getLocale"));
var getMetadata_1 = __importDefault(require("../../request/getMetadata"));
var react_1 = require("react");
var internal_1 = require("gt-react/internal");
var renderVariable_1 = __importDefault(require("../rendering/renderVariable"));
var generaltranslation_1 = require("generaltranslation");
var react_2 = __importDefault(require("react"));
function Resolver(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var children = _b.children;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, children];
                case 1: return [2 /*return*/, _c.sent()];
            }
        });
    });
}
/**
 * Translation component that renders its children translated into the user's given locale.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <T id="welcome_message">
 *  Hello, <Var name="name" value={firstname}>!
 * </T>
 * ```
 *
 * @example
 * ```jsx
 * // Translating a plural
 * <T id="item_count">
 *  <Plural n={3} singular={<>You have <Num value={n}/> item.</>}>
 *      You have <Num value={n}/> items.
 *  </Plural>
 * </T>
 * ```
 *
 * When used on the server-side, can create translations on demand.
 * If you need to ensure server-side usage import from `'gt-next/server'`.
 *
 * When used on the client-side, will throw an error if no `id` prop is provided.
 *
 * By default, General Translation saves the translation in a remote cache if an `id` option is passed.
 *
 * @param {React.ReactNode} children - The content to be translated or displayed.
 * @param {string} [id] - Optional identifier for the translation string. If not provided, a hash will be generated from the content.
 * @param {Object} [renderSettings] - Optional settings controlling how fallback content is rendered during translation.
 * @param {"skeleton" | "replace" | "default"} [renderSettings.method] - Specifies the rendering method:
 *  - "skeleton": show a placeholder while translation is loading.
 *  - "replace": show the default content as a fallback while the translation is loading.
 *  - "default": behave like skeleton unless language is same (ie en-GB vs en-US), then behave like replace
 * @param {number | null} [renderSettings.timeout] - Optional timeout for translation loading.
 * @param {any} [context] - Additional context for translation key generation.
 * @param {Object} [props] - Additional props for the component.
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 */
function T(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var I18NConfig, locale, defaultLocale, renderSettings, translationRequired, serverRuntimeTranslationEnabled, dialectTranslationRequired, taggedChildren, renderDefaultLocale, renderLoadingDefault, translationsPromise, _c, childrenAsObjects, hash, translations, _d, translationEntry, translationPromise, _e, _f, _g, loadingFallback;
        var _h;
        var children = _b.children, id = _b.id, context = _b.context, variables = _b.variables, variablesOptions = _b.variablesOptions;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    if (!children) {
                        return [2 /*return*/];
                    }
                    if ((0, internal_1.isEmptyReactFragment)(children))
                        return [2 /*return*/, (0, jsx_runtime_1.jsx)(react_2.default.Fragment, {})];
                    I18NConfig = (0, getI18NConfig_1.default)();
                    return [4 /*yield*/, (0, getLocale_1.default)()];
                case 1:
                    locale = _j.sent();
                    defaultLocale = I18NConfig.getDefaultLocale();
                    renderSettings = I18NConfig.getRenderSettings();
                    translationRequired = I18NConfig.requiresTranslation(locale);
                    serverRuntimeTranslationEnabled = I18NConfig.isServerRuntimeTranslationEnabled() && process.env.NODE_ENV === 'development';
                    dialectTranslationRequired = translationRequired && (0, generaltranslation_1.isSameLanguage)(locale, defaultLocale);
                    taggedChildren = I18NConfig.addGTIdentifier(children);
                    renderDefaultLocale = function () {
                        return (0, internal_1.renderDefaultChildren)({
                            children: taggedChildren,
                            variables: variables,
                            variablesOptions: variablesOptions,
                            defaultLocale: defaultLocale,
                            renderVariable: renderVariable_1.default,
                        });
                    };
                    renderLoadingDefault = function () {
                        if (dialectTranslationRequired)
                            return renderDefaultLocale();
                        return (0, internal_1.renderSkeleton)();
                    };
                    // ----- CHECK TRANSLATIONS REQUIRED ----- //
                    // If no translation is required, render the default children
                    // The dictionary wraps text in this <T> component
                    // Thus, we need to also handle variables
                    if (!translationRequired) {
                        return [2 /*return*/, renderDefaultLocale()];
                    }
                    translationsPromise = translationRequired && I18NConfig.getCachedTranslations(locale);
                    _c = I18NConfig.serializeAndHashChildren(taggedChildren, context), childrenAsObjects = _c[0], hash = _c[1];
                    if (!translationsPromise) return [3 /*break*/, 3];
                    return [4 /*yield*/, translationsPromise];
                case 2:
                    _d = _j.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _d = {};
                    _j.label = 4;
                case 4:
                    translations = _d;
                    translationEntry = (translations === null || translations === void 0 ? void 0 : translations[hash]) || (translations === null || translations === void 0 ? void 0 : translations[id || '']);
                    // ----- RENDER CACHED TRANSLATIONS ----- //
                    // if we have a cached translation, render it
                    if ((translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) === 'success') {
                        return [2 /*return*/, (0, internal_1.renderTranslatedChildren)({
                                source: taggedChildren,
                                target: translationEntry.target,
                                variables: variables,
                                variablesOptions: variablesOptions,
                                locales: [locale, defaultLocale],
                                renderVariable: renderVariable_1.default,
                            })];
                    }
                    else if ((translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) === 'error' || // fallback to default if error
                        !serverRuntimeTranslationEnabled // fallback to default if runtime translation is disabled (loading should never happen here)
                    ) {
                        return [2 /*return*/, renderDefaultLocale()];
                    }
                    _f = (_e = I18NConfig).translateChildren;
                    _h = {
                        // do on demand translation
                        source: childrenAsObjects,
                        targetLocale: locale
                    };
                    _g = [__assign(__assign(__assign({}, (id && { id: id })), { hash: hash }), (context && { context: context }))];
                    return [4 /*yield*/, (0, getMetadata_1.default)()];
                case 5:
                    translationPromise = _f.apply(_e, [(_h.metadata = __assign.apply(void 0, [__assign.apply(void 0, _g.concat([(_j.sent())])), (renderSettings.timeout && { timeout: renderSettings.timeout })]),
                            _h)])
                        .then(function (translation) {
                        // render the translation
                        return (0, internal_1.renderTranslatedChildren)({
                            source: taggedChildren,
                            target: translation,
                            variables: variables,
                            variablesOptions: variablesOptions,
                            locales: [locale, defaultLocale],
                            renderVariable: renderVariable_1.default,
                        });
                    })
                        .catch(function () {
                        // render the default locale if there is an error instead
                        return renderDefaultLocale();
                    });
                    if (renderSettings.method === 'replace') {
                        loadingFallback = renderDefaultLocale();
                    }
                    else if (renderSettings.method === 'skeleton') {
                        loadingFallback = (0, internal_1.renderSkeleton)();
                    }
                    else {
                        loadingFallback = renderLoadingDefault();
                    }
                    return [2 /*return*/, ((0, jsx_runtime_1.jsx)(react_1.Suspense, { fallback: loadingFallback, children: (0, jsx_runtime_1.jsx)(Resolver, { children: translationPromise }) }, locale))];
            }
        });
    });
}
T.gtTransformation = 'translate-server';
exports.default = T;
//# sourceMappingURL=T.js.map