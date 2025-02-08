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
        localeRouting: true,
        prefixDefaultLocale: false
    } : _a, _c = _b.localeRouting, localeRouting = _c === void 0 ? true : _c, _d = _b.prefixDefaultLocale, prefixDefaultLocale = _d === void 0 ? false : _d;
    var envParams;
    if (process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS) {
        try {
            envParams = JSON.parse(process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS);
        }
        catch (error) {
            console.error("gt-next middleware:", error);
        }
    }
    var defaultLocale = (envParams === null || envParams === void 0 ? void 0 : envParams.defaultLocale) || internal_1.libraryDefaultLocale;
    var locales = (envParams === null || envParams === void 0 ? void 0 : envParams.locales) || (0, supported_locales_1.listSupportedLocales)();
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
        var _a, _b;
        var headerList = new Headers(req.headers);
        var res = server_1.NextResponse.next();
        var candidates = [];
        // Check pathname locales
        var pathnameLocale;
        if (localeRouting) {
            // Check if there is any supported locale in the pathname
            var pathname = req.nextUrl.pathname;
            var extractedLocale = (0, generaltranslation_1.standardizeLocale)(extractLocale(pathname) || '');
            if ((0, generaltranslation_1.isValidLocale)(extractedLocale)) {
                pathnameLocale = extractedLocale;
                candidates.push(pathnameLocale);
            }
        }
        // Check cookie locale
        var cookieLocale = req.cookies.get(internal_1.localeCookieName);
        if ((0, generaltranslation_1.isValidLocale)(cookieLocale === null || cookieLocale === void 0 ? void 0 : cookieLocale.value)) {
            var resetCookieName = 'generaltranslation.locale.reset';
            var resetCookie = req.cookies.get(resetCookieName);
            if (resetCookie === null || resetCookie === void 0 ? void 0 : resetCookie.value) {
                res.cookies.delete(resetCookieName);
                candidates.unshift(cookieLocale.value);
            }
            else {
                candidates.push(cookieLocale.value);
            }
        }
        if (localeRouting) {
            // If there's no locale, try to get one from the referer
            var referer = headerList.get('referer');
            if (referer && typeof referer === 'string') {
                var refererLocale = extractLocale((_a = new URL(referer)) === null || _a === void 0 ? void 0 : _a.pathname);
                if ((0, generaltranslation_1.isValidLocale)(refererLocale || ''))
                    candidates.push(refererLocale || '');
            }
        }
        // Get locales from accept-language header
        var acceptedLocales = ((_b = headerList
            .get('accept-language')) === null || _b === void 0 ? void 0 : _b.split(',').map(function (item) { var _a; return (_a = item.split(';')) === null || _a === void 0 ? void 0 : _a[0].trim(); })) || [];
        candidates.push.apply(candidates, acceptedLocales);
        // Get default locale
        candidates.push(defaultLocale);
        // determine userLocale
        var userLocale = (0, generaltranslation_1.standardizeLocale)((0, generaltranslation_1.determineLocale)(candidates.filter(generaltranslation_1.isValidLocale), approvedLocales) || defaultLocale);
        res.headers.set(internal_1.localeHeaderName, userLocale);
        if (localeRouting) {
            var pathname = req.nextUrl.pathname;
            var originalUrl = req.nextUrl;
            if (pathnameLocale) {
                if (pathnameLocale === userLocale)
                    return res;
                req.nextUrl.pathname =
                    pathname.replace(pathnameLocale, userLocale); // replaces first instance
                return server_1.NextResponse.redirect(req.nextUrl);
            }
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