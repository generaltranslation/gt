"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextLocale = getNextLocale;
var headers_1 = require("next/headers");
var generaltranslation_1 = require("generaltranslation");
var internal_1 = require("generaltranslation/internal");
/**
 * Retrieves the 'accept-language' header from the headers list.
 * If the 'next/headers' module is not available, it attempts to load it. If the
 * headers function is available, it returns the primary language from the 'accept-language'
 * header. If the headers function or 'accept-language' header is not available, returns null.
 *
 * @returns {Promise<string | null>} A promise that resolves to the primary language from the
 * 'accept-language' header, or null if not available.
 */
function getNextLocale() {
    return __awaiter(this, arguments, void 0, function (defaultLocale, locales) {
        var _a, headersList, cookieStore, userLocale;
        if (defaultLocale === void 0) { defaultLocale = ''; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([(0, headers_1.headers)(), (0, headers_1.cookies)()])];
                case 1:
                    _a = _b.sent(), headersList = _a[0], cookieStore = _a[1];
                    userLocale = (function () {
                        var _a;
                        var preferredLocales = [];
                        // Language routed to by middleware
                        var headerLocale = headersList.get(internal_1.localeHeaderName);
                        if (headerLocale)
                            preferredLocales.push(headerLocale);
                        var cookieLocale = cookieStore.get(internal_1.localeCookieName);
                        if (cookieLocale === null || cookieLocale === void 0 ? void 0 : cookieLocale.value) {
                            preferredLocales.push(cookieLocale.value);
                        }
                        // Browser languages, in preference order
                        var acceptedLocales = (_a = headersList
                            .get('accept-language')) === null || _a === void 0 ? void 0 : _a.split(',').map(function (item) { var _a; return (_a = item.split(';')) === null || _a === void 0 ? void 0 : _a[0].trim(); });
                        if (acceptedLocales)
                            preferredLocales.push.apply(preferredLocales, acceptedLocales);
                        // add defaultLocale just in case there are no matches
                        preferredLocales.push(defaultLocale);
                        return (0, generaltranslation_1.determineLocale)(preferredLocales, locales) || defaultLocale;
                    })();
                    return [2 /*return*/, userLocale];
            }
        });
    });
}
//# sourceMappingURL=getNextLocale.js.map