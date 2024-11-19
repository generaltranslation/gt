"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createNextMiddleware;
var generaltranslation_1 = require("generaltranslation");
var server_1 = require("next/server");
var internal_1 = require("gt-react/internal");
var cookies_1 = require("next/dist/compiled/@edge-runtime/cookies");
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
 * Copy cookies from the Set-Cookie header of the response to the Cookie header of the request,
 * so that it will appear to SSR/RSC as if the user already has the new cookies.
 * via
 */
function applyNewCookies(req, res) {
    // 1. Parse Set-Cookie header from the response
    var setCookies = new cookies_1.ResponseCookies(res.headers);
    // 2. Construct updated Cookie header for the request
    var newReqHeaders = new Headers(req.headers);
    var newReqCookies = new cookies_1.RequestCookies(newReqHeaders);
    setCookies.getAll().forEach(function (cookie) { return newReqCookies.set(cookie); });
    // 3. Set up the “request header overrides” (see https://github.com/vercel/next.js/pull/41380)
    //    on a dummy response
    // NextResponse.next will set x-middleware-override-headers / x-middleware-request-* headers
    var dummyRes = server_1.NextResponse.next({ request: { headers: newReqHeaders } });
    // 4. Copy the “request header overrides” headers from our dummy response to the real response
    dummyRes.headers.forEach(function (value, key) {
        if (key === 'x-middleware-override-headers' || key.startsWith('x-middleware-request-')) {
            res.headers.set(key, value);
        }
    });
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
    var _b = _a === void 0 ? { defaultLocale: internal_1.primitives.libraryDefaultLocale, localeRouting: true } : _a, _c = _b.defaultLocale, defaultLocale = _c === void 0 ? internal_1.primitives.libraryDefaultLocale : _c, locales = _b.locales, _d = _b.localeRouting, localeRouting = _d === void 0 ? true : _d;
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
        var _a, _b, _c;
        var headerList = new Headers(req.headers);
        var res = server_1.NextResponse.next();
        var userLocale = (0, generaltranslation_1.standardizeLanguageCode)(defaultLocale);
        if (localeRouting) {
            // Check if there is any supported locale in the pathname
            var pathname = req.nextUrl.pathname;
            var locale = extractLocale(pathname);
            var pathnameHasLocale = false;
            if (locale && (0, generaltranslation_1.isValidLanguageCode)(locale)) {
                if (locales) {
                    var approvedLocale = (0, generaltranslation_1.determineLanguage)(locale, locales);
                    if (approvedLocale) {
                        userLocale = (0, generaltranslation_1.standardizeLanguageCode)(approvedLocale);
                        pathnameHasLocale = true;
                    }
                }
                else {
                    userLocale = (0, generaltranslation_1.standardizeLanguageCode)(locale);
                    pathnameHasLocale = true;
                }
            }
            if (pathnameHasLocale) {
                res.cookies.set(internal_1.primitives.localeCookieName, userLocale);
                applyNewCookies(req, res);
                return res;
            }
            // If there's no locale, try to get one from the referer
            var referer = headerList.get('referer');
            if (referer && typeof referer === 'string') {
                var refererLocale = extractLocale((_a = (new URL(referer))) === null || _a === void 0 ? void 0 : _a.pathname);
                if (refererLocale) {
                    var refererLocaleIsValid = false;
                    if (locales) {
                        var approvedLocale = (0, generaltranslation_1.determineLanguage)(refererLocale, locales);
                        if (approvedLocale) {
                            userLocale = (0, generaltranslation_1.standardizeLanguageCode)(approvedLocale);
                            refererLocaleIsValid = true;
                        }
                    }
                    else {
                        if ((0, generaltranslation_1.isValidLanguageCode)(refererLocale)) {
                            userLocale = (0, generaltranslation_1.standardizeLanguageCode)(refererLocale);
                            refererLocaleIsValid = true;
                        }
                    }
                    if (refererLocaleIsValid) {
                        req.nextUrl.pathname = "/".concat(userLocale, "/").concat(pathname);
                        applyNewCookies(req, res);
                        return server_1.NextResponse.redirect(req.nextUrl);
                    }
                }
            }
        }
        var acceptedLocales = (_c = (_b = headerList.get('accept-language')) === null || _b === void 0 ? void 0 : _b.split(',').map(function (item) { var _a; return (_a = item.split(';')) === null || _a === void 0 ? void 0 : _a[0].trim(); })) === null || _c === void 0 ? void 0 : _c.filter(function (code) { return (0, generaltranslation_1.isValidLanguageCode)(code); });
        if (acceptedLocales && acceptedLocales.length > 0) {
            if (locales) {
                var approvedLocale = (0, generaltranslation_1.determineLanguage)(acceptedLocales, locales);
                if (approvedLocale) {
                    userLocale = (0, generaltranslation_1.standardizeLanguageCode)(approvedLocale);
                }
            }
            else {
                userLocale = (0, generaltranslation_1.standardizeLanguageCode)(acceptedLocales[0]);
            }
        }
        res.cookies.set(internal_1.primitives.localeCookieName, userLocale);
        if (localeRouting) {
            var pathname = req.nextUrl.pathname;
            if (userLocale === defaultLocale) {
                var rewrittenRes = server_1.NextResponse.rewrite(new URL("/".concat(userLocale).concat(pathname), req.nextUrl), req.nextUrl);
                rewrittenRes.cookies.set(internal_1.primitives.localeCookieName, userLocale);
                applyNewCookies(req, rewrittenRes);
                return rewrittenRes;
            }
            else {
                req.nextUrl.pathname = "/".concat(userLocale).concat(pathname);
                applyNewCookies(req, res);
                return server_1.NextResponse.redirect(req.nextUrl);
            }
        }
        applyNewCookies(req, res);
        return res;
    }
    return nextMiddleware;
}
//# sourceMappingURL=createNextMiddleware.js.map