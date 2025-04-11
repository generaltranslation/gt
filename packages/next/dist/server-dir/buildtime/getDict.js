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
exports.default = getDict;
var internal_1 = require("gt-react/internal");
var createErrors_1 = require("../../errors/createErrors");
var getI18NConfig_1 = __importDefault(require("../../config-dir/getI18NConfig"));
var getLocale_1 = __importDefault(require("../../request/getLocale"));
var generaltranslation_1 = require("generaltranslation");
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
        var getId, locale, I18NConfig, defaultLocale, translationRequired, renderSettings, cachedTranslationsPromise, dictionariesPromise, translationDictionaryPromise, _a, translations, defaultDictionary, translationsDictionary, d;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    getId = function (suffix) {
                        return id ? "".concat(id, ".").concat(suffix) : suffix;
                    };
                    return [4 /*yield*/, (0, getLocale_1.default)()];
                case 1:
                    locale = _b.sent();
                    I18NConfig = (0, getI18NConfig_1.default)();
                    defaultLocale = I18NConfig.getDefaultLocale();
                    translationRequired = I18NConfig.requiresTranslation(locale)[0];
                    renderSettings = I18NConfig.getRenderSettings();
                    cachedTranslationsPromise = translationRequired
                        ? I18NConfig.getCachedTranslations(locale)
                        : {};
                    dictionariesPromise = I18NConfig.getDictionary(defaultLocale, id);
                    translationDictionaryPromise = I18NConfig.getDictionary(locale, id);
                    return [4 /*yield*/, Promise.all([
                            cachedTranslationsPromise,
                            dictionariesPromise,
                            translationDictionaryPromise,
                        ])];
                case 2:
                    _a = _b.sent(), translations = _a[0], defaultDictionary = _a[1], translationsDictionary = _a[2];
                    d = function (id, options) {
                        if (options === void 0) { options = {}; }
                        // Get entry
                        id = getId(id);
                        var value = defaultDictionary === null || defaultDictionary === void 0 ? void 0 : defaultDictionary[id];
                        // Check: no entry found
                        if (!value) {
                            console.warn((0, createErrors_1.createNoEntryFoundWarning)(id));
                            return '';
                        }
                        // Check: invalid entry
                        if (!(0, internal_1.isValidDictionaryEntry)(value)) {
                            console.warn((0, createErrors_1.createInvalidDictionaryEntryWarning)(id));
                            return '';
                        }
                        // Get entry and metadata
                        var _a = (0, internal_1.getEntryAndMetadata)(value), entry = _a.entry, metadata = _a.metadata;
                        // Validate entry
                        if (!entry || typeof entry !== 'string')
                            return '';
                        // Parse content
                        var source = (0, generaltranslation_1.splitStringToContent)(entry);
                        // Render Method
                        var renderContent = function (content, locales) {
                            return (0, generaltranslation_1.renderContentToString)(content, locales, options.variables, options.variablesOptions);
                        };
                        // Check: translation required
                        if (!translationRequired)
                            return renderContent(source, [defaultLocale]);
                        // ----- CHECK DICTIONARY ----- //
                        // Get dictionaryTranslation
                        var dictionaryTranslation = translationsDictionary === null || translationsDictionary === void 0 ? void 0 : translationsDictionary[id];
                        // Check: valid entry
                        if ((0, internal_1.isValidDictionaryEntry)(dictionaryTranslation)) {
                            // Get entry and metadata
                            var entry_1 = (0, internal_1.getEntryAndMetadata)(dictionaryTranslation).entry;
                            // Render translation
                            return renderContent(entry_1, [locale, defaultLocale]);
                        }
                        // ----- CHECK TRANSLATIONS ----- //
                        // Get hash
                        var hash = (0, id_1.hashJsxChildren)(__assign(__assign({ source: source }, ((metadata === null || metadata === void 0 ? void 0 : metadata.context) && { context: metadata === null || metadata === void 0 ? void 0 : metadata.context })), { id: id, dataFormat: 'JSX' }));
                        // Check id first
                        var translationEntry = translations === null || translations === void 0 ? void 0 : translations[hash];
                        // Check translation successful
                        if ((translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) === 'success')
                            return renderContent(translationEntry.target, [
                                locale,
                                defaultLocale,
                            ]);
                        // Check translation errored
                        if ((translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) === 'error') {
                            return renderContent(source, [defaultLocale]);
                        }
                        // ----- TRANSLATE ON DEMAND ----- //
                        // develoment only
                        if (!I18NConfig.isDevelopmentApiEnabled()) {
                            console.warn((0, createErrors_1.createDictionaryTranslationError)(id));
                            return renderContent(source, [defaultLocale]);
                        }
                        // Translate on demand
                        I18NConfig.translateContent({
                            source: source,
                            targetLocale: locale,
                            options: __assign(__assign({}, ((metadata === null || metadata === void 0 ? void 0 : metadata.context) && { context: metadata === null || metadata === void 0 ? void 0 : metadata.context })), { id: id, hash: hash }),
                        }).catch(function () { }); // Error logged in I18NConfig
                        // Loading translation warning
                        console.warn(createErrors_1.translationLoadingWarning);
                        // Loading behavior
                        if (renderSettings.method === 'replace') {
                            return renderContent(source, [defaultLocale]);
                        }
                        else if (renderSettings.method === 'skeleton') {
                            return '';
                        }
                        // Default is returning source, rather than returning a loading state
                        return renderContent(source, [defaultLocale]);
                    };
                    return [2 /*return*/, d];
            }
        });
    });
}
//# sourceMappingURL=getDict.js.map