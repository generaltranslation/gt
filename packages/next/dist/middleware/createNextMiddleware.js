"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createNextMiddleware;
var generaltranslation_1 = require("generaltranslation");
var internal_1 = require("generaltranslation/internal");
var supported_locales_1 = require("@generaltranslation/supported-locales");
var createErrors_1 = require("../errors/createErrors");
var server_1 = require("next/server");
/**
 * Extracts the locale from the given pathname.
 *
 * @param {string} pathname - The pathname to extract from.
 * @returns {string} The extracted locale.
 */
function extractLocale(pathname) {
    var matches = pathname.match(/^\/([^\/]+)(?:\/|$)/);
    return matches ? matches[1] : null;
}
/**
 * Middleware factory to create a Next.js middleware for i18n routing and locale detection.
 *
 * This middleware sets a cookie based on the locale derived from several sources
 * such as the request pathname, referer, or 'Accept-Language' header.
 * If locale routing is enabled, it redirects to the localized pathname and
 * updates the locale cookie.
 *
 * @param {Object} config - Configuration object for the middleware.
 * @param {string} [config.defaultLocale='en'] - The default locale to use if no locale is detected.
 * @param {string[]} [config.locales] - Array of supported locales. If provided, the locale will be validated against this list.
 * @param {boolean} [config.localeRouting=true] - Flag to enable or disable automatic locale-based routing.
 * @returns {function} - A middleware function that processes the request and response.
 */
function createNextMiddleware(_a) {
    var _b = _a === void 0 ? {
        defaultLocale: internal_1.libraryDefaultLocale,
        localeRouting: true,
        prefixDefaultLocale: false,
    } : _a, _c = _b.defaultLocale, defaultLocale = _c === void 0 ? internal_1.libraryDefaultLocale : _c, _d = _b.locales, locales = _d === void 0 ? (0, supported_locales_1.listSupportedLocales)() : _d, _e = _b.localeRouting, localeRouting = _e === void 0 ? true : _e, _f = _b.prefixDefaultLocale, prefixDefaultLocale = _f === void 0 ? false : _f;
    if (!(0, generaltranslation_1.isValidLocale)(defaultLocale))
        throw new Error("gt-next middleware: defaultLocale \"".concat(defaultLocale, "\" is not a valid locale."));
    var warningLocales = locales.filter(function (locale) { return !(0, generaltranslation_1.isValidLocale)(locale); });
    if (warningLocales.length)
        console.warn((0, createErrors_1.createUnsupportedLocalesWarning)(warningLocales));
    var approvedLocales = locales;
    /**
     * Processes the incoming request to determine the user's locale and sets a locale cookie.
     * Optionally redirects the user based on the locale if locale-based routing is enabled.
     *
     * - Checks if the request URL contains a locale.
     * - Falls back to the referer URL for locale if needed.
     * - If no locale is found in the URL or referer, it checks the 'Accept-Language' header.
     * - Sets a cookie with the detected or default locale.
     * - Redirects to the correct locale route if locale routing is enabled.
     *
     * @param {any} req - The incoming request object, containing URL and headers.
     * @returns {NextResponse} - The Next.js response, either continuing the request or redirecting to the localized URL.
     */
    function nextMiddleware(req) {
        var _a;
        var headerList = new Headers(req.headers);
        var res = server_1.NextResponse.next();
        var userLocale = (0, generaltranslation_1.standardizeLocale)(defaultLocale);
        if (localeRouting) {
            // Check if there is any supported locale in the pathname
            var pathname = req.nextUrl.pathname;
            var locale = extractLocale(pathname);
            if (locale && (0, generaltranslation_1.isValidLocale)(locale)) {
                var approvedLocale = (0, generaltranslation_1.determineLocale)(locale, approvedLocales);
                if (approvedLocale) {
                    userLocale = (0, generaltranslation_1.standardizeLocale)(approvedLocale);
                    res.headers.set(internal_1.localeHeaderName, userLocale);
                    return res;
                }
            }
            // If there's no locale, try to get one from the referer
            var referer = headerList.get('referer');
            if (referer && typeof referer === 'string') {
                var refererLocale = extractLocale((_a = new URL(referer)) === null || _a === void 0 ? void 0 : _a.pathname);
                if (refererLocale) {
                    var approvedLocale = (0, generaltranslation_1.determineLocale)(refererLocale, approvedLocales);
                    if (approvedLocale) {
                        userLocale = (0, generaltranslation_1.standardizeLocale)(approvedLocale);
                        req.nextUrl.pathname = "/".concat(userLocale, "/").concat(pathname);
                        return server_1.NextResponse.redirect(req.nextUrl);
                    }
                }
            }
        }
        userLocale = (function () {
            var _a, _b;
            var cookieLocale = req.cookies.get(internal_1.localeCookieName);
            if (cookieLocale === null || cookieLocale === void 0 ? void 0 : cookieLocale.value) {
                if ((0, generaltranslation_1.isValidLocale)(cookieLocale.value))
                    return (0, generaltranslation_1.standardizeLocale)(cookieLocale.value);
            }
            var acceptedLocales = (_b = (_a = headerList
                .get('accept-language')) === null || _a === void 0 ? void 0 : _a.split(',').map(function (item) { var _a; return (_a = item.split(';')) === null || _a === void 0 ? void 0 : _a[0].trim(); })) === null || _b === void 0 ? void 0 : _b.filter(function (code) { return (0, generaltranslation_1.isValidLocale)(code); });
            if (acceptedLocales && acceptedLocales.length > 0) {
                var approvedLocale = (0, generaltranslation_1.determineLocale)(acceptedLocales, approvedLocales);
                if (approvedLocale) {
                    userLocale = (0, generaltranslation_1.standardizeLocale)(approvedLocale);
                }
            }
            return userLocale;
        })();
        res.headers.set(internal_1.localeHeaderName, userLocale);
        if (localeRouting) {
            var pathname = req.nextUrl.pathname;
            var originalUrl = req.nextUrl;
            // Construct new URL with original search parameters
            var newUrl = new URL("/".concat(userLocale).concat(pathname), originalUrl);
            newUrl.search = originalUrl.search; // keep the query parameters
            if (!prefixDefaultLocale && (0, generaltranslation_1.isSameDialect)(userLocale, defaultLocale)) {
                var rewrittenRes = server_1.NextResponse.rewrite(newUrl, req.nextUrl);
                rewrittenRes.headers.set(internal_1.localeHeaderName, userLocale);
                return rewrittenRes;
            }
            else {
                req.nextUrl.pathname = "/".concat(userLocale).concat(pathname);
                return server_1.NextResponse.redirect(newUrl);
            }
        }
        return res;
    }
    return nextMiddleware;
}
//# sourceMappingURL=createNextMiddleware.js.map