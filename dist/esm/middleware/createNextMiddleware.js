import { isValidLocale, determineLocale, standardizeLocale, isSameDialect } from "generaltranslation";
// import { ResponseCookies, RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { libraryDefaultLocale, localeCookieName, localeHeaderName } from 'generaltranslation/internal';
import { listSupportedLocales } from "@generaltranslation/supported-locales";
import { createUnsupportedLocalesWarning } from "../errors/createErrors";
import { NextResponse } from "next/server";
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
export default function createNextMiddleware(_a) {
    var _b = _a === void 0 ? {
        defaultLocale: libraryDefaultLocale, localeRouting: true, prefixDefaultLocale: false
    } : _a, _c = _b.defaultLocale, defaultLocale = _c === void 0 ? libraryDefaultLocale : _c, _d = _b.locales, locales = _d === void 0 ? listSupportedLocales() : _d, _e = _b.localeRouting, localeRouting = _e === void 0 ? true : _e, _f = _b.prefixDefaultLocale, prefixDefaultLocale = _f === void 0 ? false : _f;
    if (!isValidLocale(defaultLocale))
        throw new Error("gt-next middleware: defaultLocale \"".concat(defaultLocale, "\" is not a valid locale."));
    var warningLocales = locales.filter(function (locale) { return !isValidLocale(locale); });
    if (warningLocales.length)
        console.warn(createUnsupportedLocalesWarning(warningLocales));
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
        var res = NextResponse.next();
        var userLocale = standardizeLocale(defaultLocale);
        if (localeRouting) {
            // Check if there is any supported locale in the pathname
            var pathname = req.nextUrl.pathname;
            var locale = extractLocale(pathname);
            if (locale && isValidLocale(locale)) {
                var approvedLocale = determineLocale(locale, approvedLocales);
                if (approvedLocale) {
                    userLocale = standardizeLocale(approvedLocale);
                    res.headers.set(localeHeaderName, userLocale);
                    res.cookies.set(localeCookieName, userLocale);
                    return res;
                }
            }
            // If there's no locale, try to get one from the referer
            var referer = headerList.get('referer');
            if (referer && typeof referer === 'string') {
                var refererLocale = extractLocale((_a = (new URL(referer))) === null || _a === void 0 ? void 0 : _a.pathname);
                if (refererLocale) {
                    var approvedLocale = determineLocale(refererLocale, approvedLocales);
                    if (approvedLocale) {
                        userLocale = standardizeLocale(approvedLocale);
                        req.nextUrl.pathname = "/".concat(userLocale, "/").concat(pathname);
                        return NextResponse.redirect(req.nextUrl);
                    }
                    ;
                }
            }
        }
        userLocale = (function () {
            var _a, _b;
            /* Removed until preloading can be accurately detected
            const cookieLocale = req.cookies.get(localeCookieName);
            if (cookieLocale?.value) {
                if (isValidLocale(cookieLocale.value))
                    return standardizeLocale(cookieLocale.value)
            }*/
            var acceptedLocales = (_b = (_a = headerList.get('accept-language')) === null || _a === void 0 ? void 0 : _a.split(',').map(function (item) { var _a; return (_a = item.split(';')) === null || _a === void 0 ? void 0 : _a[0].trim(); })) === null || _b === void 0 ? void 0 : _b.filter(function (code) { return isValidLocale(code); });
            if (acceptedLocales && acceptedLocales.length > 0) {
                var approvedLocale = determineLocale(acceptedLocales, approvedLocales);
                if (approvedLocale) {
                    userLocale = standardizeLocale(approvedLocale);
                }
            }
            return userLocale;
        })();
        res.cookies.set(localeCookieName, userLocale);
        res.headers.set(localeHeaderName, userLocale);
        if (localeRouting) {
            var pathname = req.nextUrl.pathname;
            var originalUrl = req.nextUrl;
            // Construct new URL with original search parameters
            var newUrl = new URL("/".concat(userLocale).concat(pathname), originalUrl);
            newUrl.search = originalUrl.search; // keep the query parameters
            if (!prefixDefaultLocale && isSameDialect(userLocale, defaultLocale)) {
                var rewrittenRes = NextResponse.rewrite(newUrl, req.nextUrl);
                rewrittenRes.cookies.set(localeCookieName, userLocale);
                rewrittenRes.headers.set(localeHeaderName, userLocale);
                return rewrittenRes;
            }
            else {
                req.nextUrl.pathname = "/".concat(userLocale).concat(pathname);
                return NextResponse.redirect(newUrl);
            }
        }
        return res;
    }
    return nextMiddleware;
}
//# sourceMappingURL=createNextMiddleware.js.map