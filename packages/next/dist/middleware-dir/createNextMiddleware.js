"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createNextMiddleware;
var generaltranslation_1 = require("generaltranslation");
var internal_1 = require("generaltranslation/internal");
var createErrors_1 = require("../errors/createErrors");
var server_1 = require("next/server");
var constants_1 = require("../utils/constants");
var utils_1 = require("./utils");
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
    var _b = _a.localeRouting, localeRouting = _b === void 0 ? true : _b, _c = _a.prefixDefaultLocale, prefixDefaultLocale = _c === void 0 ? false : _c, _d = _a.pathConfig, pathConfig = _d === void 0 ? {} : _d;
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
    // using gt services
    var gtServicesEnabled = process.env._GENERALTRANSLATION_GT_SERVICES_ENABLED === 'true';
    // i18n config
    var defaultLocale = (envParams === null || envParams === void 0 ? void 0 : envParams.defaultLocale) || internal_1.libraryDefaultLocale;
    var locales = (envParams === null || envParams === void 0 ? void 0 : envParams.locales) || [defaultLocale];
    if (!(0, generaltranslation_1.isValidLocale)(defaultLocale))
        throw new Error("gt-next middleware: defaultLocale \"".concat(defaultLocale, "\" is not a valid locale."));
    var warningLocales = locales.filter(function (locale) { return !(0, generaltranslation_1.isValidLocale)(locale); });
    if (warningLocales.length)
        console.warn((0, createErrors_1.createUnsupportedLocalesWarning)(warningLocales));
    var approvedLocales = locales;
    // ---------- PRE-PROCESSING PATHS ---------- //
    // Standardize pathConfig paths
    pathConfig = Object.entries(pathConfig).reduce(function (acc, _a) {
        var sharedPath = _a[0], localizedPath = _a[1];
        if (typeof localizedPath === 'string') {
            acc[sharedPath] = localizedPath;
        }
        else {
            acc[sharedPath] = Object.entries(localizedPath).reduce(function (acc, _a) {
                var locale = _a[0], localizedPath = _a[1];
                acc[gtServicesEnabled ? (0, generaltranslation_1.standardizeLocale)(locale) : locale] =
                    localizedPath;
                return acc;
            }, {});
        }
        return acc;
    }, {});
    // Create the path mapping
    var pathToSharedPath = (0, utils_1.createPathToSharedPathMap)(pathConfig);
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
     * @param {NextRequest} req - The incoming request object, containing URL and headers.
     * @returns {NextResponse} - The Next.js response, either continuing the request or redirecting to the localized URL.
     */
    function nextMiddleware(req) {
        var headerList = new Headers(req.headers);
        var res = server_1.NextResponse.next({
            request: {
                // New request headers
                headers: headerList,
            },
        });
        // ---------- LOCALE DETECTION ---------- //
        var _a = (0, utils_1.getLocaleFromRequest)(req, defaultLocale, approvedLocales, localeRouting, gtServicesEnabled), userLocale = _a.userLocale, pathnameLocale = _a.pathnameLocale, unstandardizedPathnameLocale = _a.unstandardizedPathnameLocale;
        res.headers.set(internal_1.localeHeaderName, userLocale);
        if (userLocale) {
            res.cookies.set(constants_1.middlewareLocaleName, userLocale);
        }
        if (localeRouting) {
            // ---------- GET PATHS ---------- //
            var pathname = req.nextUrl.pathname;
            // Only strip off the locale if it's a valid locale (/fr/fr-about -> /about), (/blog -> /blog)
            var unprefixedPathname = pathnameLocale
                ? pathname.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), '')
                : pathname;
            var originalUrl = req.nextUrl;
            // standardize pathname (ie, /tg/welcome -> /fil/welcome), (/blog -> /blog)
            var standardizedPathname = pathnameLocale && pathnameLocale !== unstandardizedPathnameLocale
                ? pathname.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), "/".concat(userLocale))
                : pathname;
            // Get the shared path for the unprefixed pathname
            var sharedPath = (0, utils_1.getSharedPath)(unprefixedPathname, pathToSharedPath);
            // Localized path (/en-US/blog, /fr/fr-about, /fr/dashboard/[id]/custom)
            var localizedPath = sharedPath && (0, utils_1.getLocalizedPath)(sharedPath, userLocale, pathConfig);
            // Combine localized path with dynamic parameters (/en-US/blog, /fr/fr-about, /fr/dashboard/1/fr-custom)
            var localizedPathWithParameters = localizedPath &&
                (0, utils_1.replaceDynamicSegments)(pathnameLocale
                    ? standardizedPathname
                    : "/".concat(userLocale).concat(standardizedPathname), localizedPath);
            // ---------- ROUTING LOGIC ---------- //
            // BASE CASE: default locale, same path (/en-US/blog -> /en-US/blog), (/en-US/dashboard/1/custom -> /en-US/dashboard/1/custom)
            if (localizedPathWithParameters &&
                standardizedPathname === localizedPathWithParameters &&
                userLocale === defaultLocale) {
                return res;
            }
            // BASE CASE: at localized path, which is the same as the shared path (/fil/blog -> /fil/blog)
            if (pathname === localizedPathWithParameters &&
                "/".concat(userLocale).concat(sharedPath) === localizedPathWithParameters) {
                return res;
            }
            // REWRITE CASE: proxies a localized path, same locale (/fr/fr-about => /fr/about) (/fr/dashboard/1/fr-custom => /fr/dashboard/1/custom)
            if (localizedPathWithParameters &&
                standardizedPathname === localizedPathWithParameters) {
                // convert to shared path with dynamic parameters
                var rewritePath = (0, utils_1.replaceDynamicSegments)(localizedPathWithParameters, "/".concat(userLocale).concat(sharedPath));
                var rewriteUrl = new URL(rewritePath, originalUrl);
                rewriteUrl.search = originalUrl.search;
                headerList.set(internal_1.localeHeaderName, userLocale);
                var response = server_1.NextResponse.rewrite(rewriteUrl, {
                    headers: headerList,
                });
                response.headers.set(internal_1.localeHeaderName, userLocale);
                if (userLocale) {
                    response.cookies.set(constants_1.middlewareLocaleName, userLocale);
                }
                return response;
            }
            // REWRITE CASE: no locale prefix
            if (!pathnameLocale &&
                !prefixDefaultLocale &&
                (0, generaltranslation_1.isSameDialect)(userLocale, defaultLocale)) {
                var rewritePath = "/".concat(userLocale).concat(pathname);
                var rewriteUrl = new URL(rewritePath, originalUrl);
                rewriteUrl.search = originalUrl.search;
                var response = server_1.NextResponse.rewrite(rewriteUrl, {
                    headers: headerList,
                });
                response.headers.set(internal_1.localeHeaderName, userLocale);
                return response;
            }
            // REDIRECT CASE: non-i18n path
            // 1. use customized path if it exists                      (/en-US/about -> /fr/fr-about), (/about -> /fr/fr-about)
            // 2. otherwise, if pathname has locale prefix, replace it  (/en-US/welcome -> /fr/welcome)
            // 3. otherwise, prefix with locale                         (/welcome -> /fr/welcome)
            if (unstandardizedPathnameLocale !== userLocale) {
                // determine redirect path
                var redirectPath = localizedPathWithParameters ||
                    (pathnameLocale
                        ? pathname.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), "/".concat(userLocale))
                        : "/".concat(userLocale).concat(pathname));
                var redirectUrl = new URL(redirectPath, originalUrl);
                redirectUrl.search = originalUrl.search;
                var response = server_1.NextResponse.redirect(redirectUrl);
                if (userLocale) {
                    response.cookies.set(constants_1.middlewareLocaleName, userLocale);
                }
                return response;
            }
            // REDIRECT CASE: mismatched localized path (/fr/about -> /fr/fr-about), mismatched dynamic path (/fr/dashboard/1/custom -> /fr/dashboard/1/fr-custom)
            if (localizedPathWithParameters) {
                var redirectUrl = new URL(localizedPathWithParameters, originalUrl);
                redirectUrl.search = originalUrl.search;
                var response = server_1.NextResponse.redirect(redirectUrl);
                if (userLocale) {
                    response.cookies.set(constants_1.middlewareLocaleName, userLocale);
                }
                return response;
            }
            // BASE CASE
            return res;
        }
        return res;
    }
    return nextMiddleware;
}
//# sourceMappingURL=createNextMiddleware.js.map