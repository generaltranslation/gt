"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createNextMiddleware;
var generaltranslation_1 = require("generaltranslation");
var internal_1 = require("generaltranslation/internal");
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
 * @param {boolean} [config.localeRouting=true] - Flag to enable or disable automatic locale-based routing.
 * @param {boolean} [config.prefixDefaultLocale=false] - Flag to enable or disable prefixing the default locale to the pathname, i.e., /en/about -> /about
 * @returns {function} - A middleware function that processes the request and response.
 */
function createNextMiddleware(_a) {
    var _b = _a === void 0 ? {
        localeRouting: true,
        prefixDefaultLocale: false,
    } : _a, _c = _b.localeRouting, localeRouting = _c === void 0 ? true : _c, _d = _b.prefixDefaultLocale, prefixDefaultLocale = _d === void 0 ? false : _d;
    // i18n config
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
    var locales = (envParams === null || envParams === void 0 ? void 0 : envParams.locales) || [defaultLocale];
    if (!(0, generaltranslation_1.isValidLocale)(defaultLocale))
        throw new Error("gt-next middleware: defaultLocale \"".concat(defaultLocale, "\" is not a valid locale."));
    var warningLocales = locales.filter(function (locale) { return !(0, generaltranslation_1.isValidLocale)(locale); });
    if (warningLocales.length)
        console.warn((0, createErrors_1.createUnsupportedLocalesWarning)(warningLocales));
    var approvedLocales = locales;
    var pathConfig = {
        '/blog': '/blog',
        '/about': {
            fr: '/le-about',
        },
    };
    // maps localized paths to shared paths
    var pathToSharedPath = Object.entries(pathConfig).reduce(function (acc, _a) {
        var sharedPath = _a[0], localizedPath = _a[1];
        acc[sharedPath] = sharedPath;
        if (typeof localizedPath === 'object') {
            Object.values(localizedPath).forEach(function (localizedPath) {
                acc[localizedPath] = sharedPath;
            });
        }
        return acc;
    }, {});
    console.log('pathToSharedPath', pathToSharedPath);
    /**
     * Gets the full localized path given a shared path and locale
     * @param sharedPath
     * @param locale
     * @returns localized path or undefined if no localized path is found
     *
     * const pathConfig = {
     *   '/blog': '/blog',
     *   '/about': {
     *     fr: '/le-about',
     *   },
     * }
     *
     * // exact matches returns full localized path
     * getLocalizedPath('/about', 'en-US') -> '/en-US/about'
     * getLocalizedPath('/about', 'fr') -> '/fr/le-about'
     * getLocalizedPath('/about', 'es') -> '/es/about
     * getLocalizedPath('/blog', 'en-US') -> '/en-US/blog'
     *
     * // non-shared paths return undefined
     * getLocalizedPath('/foo', 'en-US') -> undefined
     */
    var getLocalizedPath = function (sharedPath, locale) {
        var localizedPath = pathConfig[sharedPath];
        if (typeof localizedPath === 'string')
            return "/".concat(locale).concat(localizedPath);
        else if (typeof localizedPath === 'object')
            return localizedPath[locale]
                ? "/".concat(locale).concat(localizedPath[locale])
                : "/".concat(locale).concat(sharedPath);
        return undefined;
    };
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
        console.log('--------------------------------');
        var headerList = new Headers(req.headers);
        var res = server_1.NextResponse.next();
        var candidates = [];
        // routing
        var routingConfig;
        try {
            routingConfig = require('gt-next/_routing');
        }
        catch (e) {
            console.error(e);
        }
        var rewriteFlag = req.headers.get(internal_1.localeRewriteFlagName) === 'true';
        // ---------- LOCALE DETECTION ---------- //
        // Check pathname locales
        var pathnameLocale;
        var pathname = req.nextUrl.pathname;
        if (localeRouting) {
            // Check if there is any supported locale in the pathname
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
        var refererLocale;
        if (localeRouting) {
            // If there's no locale, try to get one from the referer
            var referer = headerList.get('referer');
            if (referer && typeof referer === 'string') {
                refererLocale = extractLocale((_a = new URL(referer)) === null || _a === void 0 ? void 0 : _a.pathname);
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
        var userLocale = (0, generaltranslation_1.standardizeLocale)((0, generaltranslation_1.determineLocale)(candidates.filter(generaltranslation_1.isValidLocale), approvedLocales) ||
            defaultLocale);
        console.log('userLocale', userLocale);
        res.headers.set(internal_1.localeHeaderName, userLocale);
        if (userLocale) {
            res.cookies.set('generaltranslation.middleware.locale', userLocale);
        }
        // ---------- ROUTING ---------- //
        if (localeRouting) {
            var pathname_1 = req.nextUrl.pathname;
            // Only strip off the locale if it's a valid locale
            var unprefixedPathname = pathnameLocale
                ? pathname_1.replace(new RegExp("^/".concat(pathnameLocale)), '')
                : pathname_1;
            var originalUrl = req.nextUrl;
            var sharedPath = pathToSharedPath[unprefixedPathname];
            var localizedPath = sharedPath && getLocalizedPath(sharedPath, userLocale);
            console.log('pathname', pathname_1);
            console.log('sharedPath', sharedPath);
            console.log('localizedPath', localizedPath);
            // BASE CASE: same locale, same path (/en-US/blog -> /en-US/blog)
            if (pathname_1 === localizedPath &&
                localizedPath === "/".concat(userLocale).concat(sharedPath)) {
                console.log('DO NOTHING: ', userLocale, pathname_1);
                return res;
            }
            // REWRITE CASE: proxies a localized path, same locale (/fr/le-about => /fr/about)
            if (pathname_1 === localizedPath) {
                var rewritePath = "/".concat(userLocale).concat(sharedPath);
                var rewriteUrl = new URL(rewritePath, originalUrl);
                rewriteUrl.search = originalUrl.search;
                res.headers.set(internal_1.localeRewriteFlagName, 'true');
                console.log('REWRITE (localized path, same locale):', userLocale, pathnameLocale, '\n' + pathname_1, '->', rewritePath);
                var response = server_1.NextResponse.rewrite(rewriteUrl);
                if (userLocale) {
                    response.cookies.set('generaltranslation.middleware.locale', userLocale);
                }
                return response;
            }
            // REDIRECT CASE: non-i18n path
            // 1. use customized path if it exists                      (/en-US/about -> /fr/le-about), (/about -> /fr/le-about)
            // 2. otherwise, if pathname has locale prefix, replace it  (/en-US/welcome -> /fr/welcome)
            // 3. otherwise, prefix with locale                         (/welcome -> /fr/welcome)
            if (pathnameLocale !== userLocale) {
                // determine redirect path
                var redirectPath = localizedPath ||
                    (pathnameLocale
                        ? pathname_1.replace(new RegExp("^/".concat(pathnameLocale)), "/".concat(userLocale))
                        : "/".concat(userLocale).concat(pathname_1));
                var redirectUrl = new URL(redirectPath, originalUrl);
                redirectUrl.search = originalUrl.search;
                console.log('REDIRECT (unknown path):', userLocale, pathnameLocale, '\n' + pathname_1, '->', redirectPath);
                var response = server_1.NextResponse.redirect(redirectUrl);
                if (userLocale) {
                    response.cookies.set('generaltranslation.middleware.locale', userLocale);
                }
                return response;
            }
            // REDIRECT CASE: mismatched localized path (i.e. /fr/about -> /fr/le-about)
            if (localizedPath && !rewriteFlag) {
                var redirectUrl = new URL(localizedPath, originalUrl);
                redirectUrl.search = originalUrl.search;
                console.log('REDIRECT (mismatched localized path):', userLocale, pathnameLocale, '\n' + pathname_1, '->', localizedPath);
                var response = server_1.NextResponse.redirect(redirectUrl);
                if (userLocale) {
                    response.cookies.set('generaltranslation.middleware.locale', userLocale);
                }
                return response;
            }
            // BASE CASE
            console.log('DO NOTHING:', userLocale, pathname_1);
            return res;
        }
        return res;
    }
    return nextMiddleware;
}
//# sourceMappingURL=createNextMiddleware.js.map