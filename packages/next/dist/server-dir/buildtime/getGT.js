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
exports.default = getGT;
var generaltranslation_1 = require("generaltranslation");
var getI18NConfig_1 = __importDefault(require("../../config-dir/getI18NConfig"));
var server_1 = require("../../server");
var id_1 = require("generaltranslation/id");
var createErrors_1 = require("../../errors/createErrors");
/**
 * getGT() returns a function that translates a string.
 *
 * @returns A promise of the t() function used for translating strings
 *
 * @example
 * const t = await getGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
function getGT() {
    return __awaiter(this, void 0, void 0, function () {
        var I18NConfig, locale, defaultLocale, translationRequired, translations, _a, serverRuntimeTranslationEnabled, t;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    I18NConfig = (0, getI18NConfig_1.default)();
                    return [4 /*yield*/, (0, server_1.getLocale)()];
                case 1:
                    locale = _b.sent();
                    defaultLocale = I18NConfig.getDefaultLocale();
                    translationRequired = I18NConfig.requiresTranslation(locale);
                    if (!translationRequired) return [3 /*break*/, 3];
                    return [4 /*yield*/, I18NConfig.getCachedTranslations(locale)];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = undefined;
                    _b.label = 4;
                case 4:
                    translations = _a;
                    serverRuntimeTranslationEnabled = I18NConfig.isServerRuntimeTranslationEnabled() &&
                        process.env.NODE_ENV === 'development';
                    t = function (content, options) {
                        // ----- SET UP ----- //
                        if (options === void 0) { options = {}; }
                        // Validate content
                        if (!content || typeof content !== 'string')
                            return '';
                        // Parse content
                        var source = (0, generaltranslation_1.splitStringToContent)(content);
                        // Render Method
                        var renderContent = function (content, locales) {
                            return (0, generaltranslation_1.renderContentToString)(content, locales, options.variables, options.variablesOptions);
                        };
                        // Check: translation required
                        if (!translationRequired)
                            return renderContent(source, [defaultLocale]);
                        // ----- GET TRANSLATION ----- //
                        var key = (0, id_1.hashJsxChildren)(__assign(__assign({ source: source }, ((options === null || options === void 0 ? void 0 : options.context) && { context: options === null || options === void 0 ? void 0 : options.context })), ((options === null || options === void 0 ? void 0 : options.id) && { id: options === null || options === void 0 ? void 0 : options.id })));
                        var translationEntry = translations === null || translations === void 0 ? void 0 : translations[key];
                        // ----- RENDER TRANSLATION ----- //
                        // Render translation
                        if ((translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) === 'success') {
                            return renderContent(translationEntry.target, [locale, defaultLocale]);
                        }
                        // Fallback to defaultLocale if not found
                        if (!serverRuntimeTranslationEnabled) {
                            console.warn((0, createErrors_1.createStringTranslationError)(content, options === null || options === void 0 ? void 0 : options.id, 't'));
                            return renderContent(source, [defaultLocale]);
                        }
                        // ----- ON DEMAND TRANSLATION ----- //
                        // Dev only
                        // Translate on demand
                        I18NConfig.translateChildren({
                            source: source,
                            targetLocale: locale,
                            metadata: __assign(__assign(__assign({}, ((options === null || options === void 0 ? void 0 : options.context) && { context: options === null || options === void 0 ? void 0 : options.context })), ((options === null || options === void 0 ? void 0 : options.id) && { id: options === null || options === void 0 ? void 0 : options.id })), { hash: key }),
                        });
                        console.warn(createErrors_1.translationLoadingWarningLittleT);
                        return renderContent(source, [defaultLocale]);
                    };
                    return [2 /*return*/, t];
            }
        });
    });
}
//# sourceMappingURL=getGT.js.map