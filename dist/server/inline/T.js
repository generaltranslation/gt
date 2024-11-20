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
exports.default = T;
var jsx_runtime_1 = require("react/jsx-runtime");
var internal_1 = require("gt-react/internal");
var getI18NConfig_1 = __importDefault(require("../../utils/getI18NConfig"));
var getLocale_1 = __importDefault(require("../../request/getLocale"));
var getMetadata_1 = __importDefault(require("../../request/getMetadata"));
var react_1 = require("react");
var renderTranslatedChildren_1 = __importDefault(require("../rendering/renderTranslatedChildren"));
var renderDefaultChildren_1 = __importDefault(require("../rendering/renderDefaultChildren"));
var Resolver_1 = __importDefault(require("./Resolver"));
/**
 * Translation component that renders its children translated into the user's language.
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
 *  <Plural n={3} singular={<>You have <Num value={n}/> item.}>
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
 * @param {"skeleton" | "replace" | "hang" | "subtle"} [renderSettings.method] - Specifies the rendering method:
 *  - "skeleton": show a placeholder while translation is loading.
 *  - "replace": show the default content as a fallback while the translation is loading.
 *  - "hang": wait until the translation is fully loaded before rendering anything.
 *  - "subtle": display children without a translation initially, with translations being applied later if available.
 * @param {number | null} [renderSettings.timeout] - Optional timeout for translation loading.
 * @param {any} [context] - Additional context for translation key generation.
 * @param {Object} [props] - Additional props for the component.
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 */
function T(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var I18NConfig, locale, defaultLocale, translationRequired, translationsPromise, taggedChildren, childrenAsObjects, key, translations, translation, target, translationPromise, _c, _d, _e, promise, loadingFallback, errorFallback, error_1;
        var _f;
        var children = _b.children, id = _b.id, context = _b.context, renderSettings = _b.renderSettings, variables = _b.variables, variablesOptions = _b.variablesOptions;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    if (!children) {
                        return [2 /*return*/];
                    }
                    I18NConfig = (0, getI18NConfig_1.default)();
                    return [4 /*yield*/, (0, getLocale_1.default)()];
                case 1:
                    locale = _g.sent();
                    defaultLocale = I18NConfig.getDefaultLocale();
                    translationRequired = I18NConfig.requiresTranslation(locale);
                    if (translationRequired) {
                        translationsPromise = I18NConfig.getTranslations(locale);
                    }
                    taggedChildren = (0, internal_1.addGTIdentifier)(children);
                    // If no translation is required, render the default children
                    // The dictionary wraps text in this <T> component
                    // Thus, we need to also handle variables
                    if (!translationRequired) {
                        return [2 /*return*/, (0, renderDefaultChildren_1.default)({
                                children: taggedChildren,
                                variables: variables,
                                variablesOptions: variablesOptions,
                                defaultLocale: defaultLocale,
                            })];
                    }
                    childrenAsObjects = (0, internal_1.writeChildrenAsObjects)(taggedChildren);
                    key = (0, internal_1.hashReactChildrenObjects)(context ? [childrenAsObjects, context] : childrenAsObjects);
                    return [4 /*yield*/, translationsPromise];
                case 2:
                    translations = _g.sent();
                    translation = id ? translations === null || translations === void 0 ? void 0 : translations[id] : undefined;
                    // checks if an appropriate translation exists
                    if ((translation === null || translation === void 0 ? void 0 : translation.k) === key) {
                        target = translation.t;
                        return [2 /*return*/, (0, renderTranslatedChildren_1.default)({
                                source: taggedChildren,
                                target: target,
                                variables: variables,
                                variablesOptions: variablesOptions,
                                locales: [locale, defaultLocale],
                            })];
                    }
                    renderSettings || (renderSettings = I18NConfig.getRenderSettings());
                    _d = (_c = I18NConfig).translateChildren;
                    _f = {
                        children: childrenAsObjects,
                        targetLanguage: locale
                    };
                    _e = [__assign(__assign({}, (id && { id: id })), { hash: key })];
                    return [4 /*yield*/, (0, getMetadata_1.default)()];
                case 3:
                    translationPromise = _d.apply(_c, [(_f.metadata = __assign.apply(void 0, [__assign.apply(void 0, _e.concat([(_g.sent())])), (renderSettings.timeout && { timeout: renderSettings.timeout })]),
                            _f)]);
                    promise = translationPromise.then(function (translation) {
                        var target = translation;
                        return (0, renderTranslatedChildren_1.default)({
                            source: taggedChildren,
                            target: target,
                            variables: variables,
                            variablesOptions: variablesOptions,
                            locales: [locale, defaultLocale],
                        });
                    });
                    errorFallback = (0, renderDefaultChildren_1.default)({
                        children: taggedChildren,
                        variables: variables,
                        variablesOptions: variablesOptions,
                        defaultLocale: defaultLocale,
                    });
                    if (renderSettings.method === 'replace') {
                        loadingFallback = errorFallback;
                    }
                    else if (renderSettings.method === 'skeleton') {
                        loadingFallback = (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, {}); // blank
                    }
                    if (!(renderSettings.method === 'hang')) return [3 /*break*/, 7];
                    _g.label = 4;
                case 4:
                    _g.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, promise];
                case 5: return [2 /*return*/, _g.sent()];
                case 6:
                    error_1 = _g.sent();
                    console.error(error_1);
                    return [2 /*return*/, errorFallback];
                case 7:
                    if (!['skeleton', 'replace'].includes(renderSettings.method) && !id) {
                        // If none of those, i.e. "subtle"
                        // return the children, with no special rendering
                        // a translation may be available from a cached translation dictionary next time the component is loaded
                        return [2 /*return*/, errorFallback];
                    }
                    // For skeleton & replace, return a suspense component so that
                    // something is shown while waiting for the translation
                    return [2 /*return*/, ((0, jsx_runtime_1.jsx)(react_1.Suspense, { fallback: loadingFallback, children: (0, jsx_runtime_1.jsx)(Resolver_1.default, { children: promise, fallback: errorFallback }) }))];
            }
        });
    });
}
//# sourceMappingURL=T.js.map