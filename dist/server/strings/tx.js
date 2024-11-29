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
exports.default = tx;
var generaltranslation_1 = require("generaltranslation");
var getI18NConfig_1 = __importDefault(require("../../config/getI18NConfig"));
var getLocale_1 = __importDefault(require("../../request/getLocale"));
var getMetadata_1 = __importDefault(require("../../request/getMetadata"));
var createErrors_1 = require("../../errors/createErrors");
/**
 * Translates the provided content string based on the specified locale and options.
 * If no translation is required, it renders the content as is. Otherwise, it fetches the
 * required translations or falls back to on-demand translation if enabled.
 *
 * By default, General Translation saves the translation in a remote cache if an `id` option is passed.
 *
 * @async
 * @function tx (translate)
 *
 * @param {string} content - The content string that needs to be translated.
 * @param {Object} [options] - Translation options.
 * @param {string} [options.id] - A unique identifier for the content, used for caching and fetching translations.
 * @param {string} [options.locale] - The target locale for translation. Defaults to the current locale if not provided.
 * @param {string} [options.context] - Additional context for the translation process, which may influence the translation's outcome.
 * @param {Object} [options.variables] - An optional map of variables to be injected into the translated content.
 * @param {Object} [options.variableOptions] - Options for formatting numbers and dates using `Intl.NumberFormat` or `Intl.DateTimeFormat`.
 *
 * @returns {Promise<string>} - A promise that resolves to the translated content string, or the original content if no translation is needed.
 *
 * @throws {Error} - Throws an error if the translation process fails or if there are issues with fetching necessary data.
 *
 * @example
 * // Basic usage with default locale detection
 * const translation = await tx("Hello, world!");
 *
 * @example
 * // Providing specific translation options
 * const translation = await tx("Hello, world!", { locale: 'es', context: 'Translate informally' });
 *
 * @example
 * // Using variables in the content string
 * const translation = await tx("The price is {price}", { locale: 'es-MX', variables: { price: 29.99 } });
 */
function tx(content_1) {
    return __awaiter(this, arguments, void 0, function (content, options) {
        var I18NConfig, contentAsArray, _a, _b, _c, _, key, translations, locale, others, translationPromise, _d, _e, _f, renderSettings, translation;
        var _g;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    if (!content)
                        return [2 /*return*/, ''];
                    I18NConfig = (0, getI18NConfig_1.default)();
                    contentAsArray = (0, generaltranslation_1.splitStringToContent)(content);
                    _a = options;
                    _b = options.locale;
                    if (_b) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, getLocale_1.default)()];
                case 1:
                    _b = (_h.sent());
                    _h.label = 2;
                case 2:
                    _a.locale = _b;
                    if (!I18NConfig.requiresTranslation(options.locale))
                        return [2 /*return*/, (0, generaltranslation_1.renderContentToString)(contentAsArray, [options.locale, I18NConfig.getDefaultLocale()], options.variables, options.variablesOptions)];
                    _c = I18NConfig.serializeAndHash(content, options.context, undefined // id is not provided here, to catch erroneous situations where the same id is being used for different <T> components
                    ), _ = _c[0], key = _c[1];
                    if (!options.id) return [3 /*break*/, 4];
                    return [4 /*yield*/, I18NConfig.getTranslations(options.locale)];
                case 3:
                    translations = _h.sent();
                    if ((translations === null || translations === void 0 ? void 0 : translations[options.id]) && translations[options.id].k === key)
                        return [2 /*return*/, (0, generaltranslation_1.renderContentToString)(translations[options.id].t, [options.locale, I18NConfig.getDefaultLocale()], options.variables, options.variablesOptions)];
                    _h.label = 4;
                case 4:
                    locale = options.locale, others = __rest(options, ["locale"]);
                    _e = (_d = I18NConfig).translate;
                    _g = {
                        content: content,
                        targetLocale: locale
                    };
                    _f = [__assign({}, others)];
                    return [4 /*yield*/, (0, getMetadata_1.default)()];
                case 5:
                    translationPromise = _e.apply(_d, [(_g.options = __assign.apply(void 0, [__assign.apply(void 0, _f.concat([(_h.sent())])), { hash: key }]),
                            _g)]);
                    renderSettings = I18NConfig.getRenderSettings();
                    if (!(renderSettings.method !== 'subtle' ||
                        !options.id) // because it is only saved if an id is present
                    ) return [3 /*break*/, 7]; // because it is only saved if an id is present
                    return [4 /*yield*/, translationPromise];
                case 6:
                    translation = _h.sent();
                    try {
                        return [2 /*return*/, (0, generaltranslation_1.renderContentToString)(translation, [options.targetLocale, I18NConfig.getDefaultLocale()], options.variables, options.variableOptions)];
                    }
                    catch (error) {
                        console.error((0, createErrors_1.createStringTranslationError)(content, options.id), error);
                        return [2 /*return*/, ''];
                    }
                    _h.label = 7;
                case 7: return [2 /*return*/, (0, generaltranslation_1.renderContentToString)(contentAsArray, [options.targetLocale, I18NConfig.getDefaultLocale()], options.variables, options.variableOptions)];
            }
        });
    });
}
//# sourceMappingURL=tx.js.map