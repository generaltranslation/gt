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
    var _b = _a === void 0 ? {} : _a, _c = _b.localeRouting, localeRouting = _c === void 0 ? true : _c, _d = _b.prefixDefaultLocale, prefixDefaultLocale = _d === void 0 ? false : _d, _e = _b.pathConfig, pathConfig = _e === void 0 ? {} : _e;
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
    var _f = (0, utils_1.createPathToSharedPathMap)(pathConfig, prefixDefaultLocale, defaultLocale), pathToSharedPath = _f.pathToSharedPath, defaultLocalePaths = _f.defaultLocalePaths;
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
        var _a = (0, utils_1.getLocaleFromRequest)(req, defaultLocale, approvedLocales, localeRouting, gtServicesEnabled, prefixDefaultLocale, defaultLocalePaths), userLocale = _a.userLocale, pathnameLocale = _a.pathnameLocale, unstandardizedPathnameLocale = _a.unstandardizedPathnameLocale, clearResetCookie = _a.clearResetCookie;
        res.headers.set(internal_1.localeHeaderName, userLocale);
        res.cookies.set(constants_1.middlewareLocaleRoutingFlagName, localeRouting.toString());
        if (clearResetCookie) {
            res.cookies.delete(constants_1.middlewareLocaleResetFlagName);
        }
        if (localeRouting) {
            // ---------- GET PATHS ---------- //
            // get pathname
            var pathname = req.nextUrl.pathname;
            var originalUrl = req.nextUrl;
            // standardize pathname (ie, /tg/welcome -> /fil/welcome), (/blog -> /blog)
            var standardizedPathname = pathnameLocale && pathnameLocale !== unstandardizedPathnameLocale
                ? pathname.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), "/".concat(userLocale))
                : pathname;
            // Get the shared path for the unprefixed pathname
            var sharedPath = (0, utils_1.getSharedPath)(standardizedPathname, pathToSharedPath);
            // Get shared path with parameters (/en/dashboard/1/custom)
            var sharedPathWithParameters = (0, utils_1.replaceDynamicSegments)(pathnameLocale
                ? standardizedPathname
                : "/".concat(userLocale).concat(standardizedPathname), "/".concat(userLocale).concat(sharedPath));
            // Localized path (/en-US/blog, /fr/fr-about, /fr/dashboard/[id]/custom)
            var localizedPath = sharedPath && (0, utils_1.getLocalizedPath)(sharedPath, userLocale, pathConfig);
            // Combine localized path with dynamic parameters (/en-US/blog, /fr/fr-about, /fr/dashboard/1/fr-custom)
            var localizedPathWithParameters = localizedPath &&
                (0, utils_1.replaceDynamicSegments)(pathnameLocale
                    ? standardizedPathname
                    : "/".concat(userLocale).concat(standardizedPathname), localizedPath);
            // ---------- ROUTING LOGIC ---------- //
            // CASE: no localized path exists
            if (!localizedPathWithParameters) {
                // CASE: path locale is valid
                if (pathnameLocale) {
                    // BASE CASE: no localized path exists, so no change
                    if (userLocale === unstandardizedPathnameLocale) {
                        return res;
                    }
                    // REDIRECT CASE: wrong pathname locale (/fr -> /en)
                    var redirectPath_1 = pathname.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), "/".concat(userLocale));
                    var redirectUrl_1 = new URL(redirectPath_1, originalUrl);
                    redirectUrl_1.search = originalUrl.search;
                    var response_1 = server_1.NextResponse.redirect(redirectUrl_1);
                    response_1.headers.set(internal_1.localeHeaderName, userLocale);
                    response_1.cookies.set(constants_1.middlewareLocaleRoutingFlagName, 'true');
                    return response_1;
                }
                // REWRITE: no default locale prefix (/customers -> /en/customers)
                if (!pathnameLocale &&
                    !prefixDefaultLocale &&
                    (0, generaltranslation_1.isSameDialect)(userLocale, defaultLocale)) {
                    var rewritePath = "/".concat(userLocale).concat(pathname);
                    var rewriteUrl = new URL(rewritePath, originalUrl);
                    rewriteUrl.search = originalUrl.search;
                    var response_2 = server_1.NextResponse.rewrite(rewriteUrl, {
                        headers: headerList,
                    });
                    response_2.headers.set(internal_1.localeHeaderName, userLocale);
                    response_2.cookies.set(constants_1.middlewareLocaleRoutingFlagName, 'true');
                    return response_2;
                }
                // REDIRECT CASE: no/invalid pathnameLocale, add a default locale prefix
                var redirectPath = "/".concat(userLocale).concat(pathname);
                var redirectUrl = new URL(redirectPath, originalUrl);
                redirectUrl.search = originalUrl.search;
                var response = server_1.NextResponse.redirect(redirectUrl);
                response.headers.set(internal_1.localeHeaderName, userLocale);
                response.cookies.set(constants_1.middlewareLocaleRoutingFlagName, 'true');
                return response;
            }
            // CASE: remove default locale prefix
            if (!pathnameLocale &&
                !prefixDefaultLocale &&
                (0, generaltranslation_1.isSameDialect)(userLocale, defaultLocale)) {
                // REDIRECT CASE: displaying wrong path, convert to non-prefixed localized path (/about -> /en-about) (/dashboard/1/custom -> /en-dashboard/1/en-custom)
                if (localizedPathWithParameters !== "/".concat(userLocale).concat(pathname)) {
                    // remove locale prefix
                    var redirectPath = localizedPathWithParameters.replace(new RegExp("^/".concat(userLocale)), '');
                    var redirectUrl = new URL(redirectPath, originalUrl);
                    redirectUrl.search = originalUrl.search;
                    var response_3 = server_1.NextResponse.redirect(redirectUrl);
                    response_3.headers.set(internal_1.localeHeaderName, userLocale);
                    response_3.cookies.set(constants_1.middlewareLocaleRoutingFlagName, 'true');
                    if (clearResetCookie) {
                        response_3.cookies.delete(constants_1.middlewareLocaleResetFlagName);
                    }
                    return response_3;
                }
                // REWRITE CASE: displaying correct path (/blog -> /en/blog) (/en-dashboard/1/en-custom -> /en/dashboard/1/custom) (/en-about -> /en/about)
                // shared path with dynamic parameters
                var rewritePath = (0, utils_1.replaceDynamicSegments)(pathnameLocale
                    ? standardizedPathname
                    : "/".concat(userLocale).concat(standardizedPathname), "/".concat(userLocale).concat(sharedPath));
                var rewriteUrl = new URL(rewritePath, originalUrl);
                rewriteUrl.search = originalUrl.search;
                var response = server_1.NextResponse.rewrite(rewriteUrl, {
                    headers: headerList,
                });
                response.headers.set(internal_1.localeHeaderName, userLocale);
                response.cookies.set(constants_1.middlewareLocaleRoutingFlagName, 'true');
                if (clearResetCookie) {
                    response.cookies.delete(constants_1.middlewareLocaleResetFlagName);
                }
                return response;
            }
            // REDIRECT CASE: no localization prefix (invalid path), redirect to a localized path (ie, /blog -> /en-US/blog) (/dashboard -> /fr/fr-dashboard)
            // REDIRECT CASE: locale prefix mismatch userLocale (invalid path), redirect to a localized path (ie, /en-US/blog -> /fr/blog) (/tl/dashboard -> /fil/tl-dashboard)
            // REDIRECT CASE: displayed path doesnt match localized path (invalid path) (/fr/about -> /fr/fr-about) (NOT: /en/fr-about -> /en/en-about, /en/fr-about should 404)
            if (!pathnameLocale ||
                unstandardizedPathnameLocale !== userLocale ||
                localizedPathWithParameters !== standardizedPathname) {
                var redirectPath = localizedPathWithParameters;
                var redirectUrl = new URL(redirectPath, originalUrl);
                redirectUrl.search = originalUrl.search;
                var response = server_1.NextResponse.redirect(redirectUrl);
                response.headers.set(internal_1.localeHeaderName, userLocale);
                response.cookies.set(constants_1.middlewareLocaleRoutingFlagName, 'true');
                if (clearResetCookie) {
                    response.cookies.delete(constants_1.middlewareLocaleResetFlagName);
                }
                return response;
            }
            // REWRITE CASE: displaying correct path at localized path, which is the same as the shared path (/fil/blog => /fil/blog) (/fr/fr-dashboard/1/fr-custom => /fr/dashboard/1/custom)
            if (standardizedPathname === localizedPathWithParameters && // we are displaying the correct path
                standardizedPathname !== sharedPathWithParameters // no rewrite needed if it's already the shared path
            ) {
                // convert to shared path with dynamic parameters
                var rewritePath = sharedPathWithParameters;
                var rewriteUrl = new URL(rewritePath, originalUrl);
                rewriteUrl.search = originalUrl.search;
                var response = server_1.NextResponse.rewrite(rewriteUrl, {
                    headers: headerList,
                });
                response.headers.set(internal_1.localeHeaderName, userLocale);
                response.cookies.set(constants_1.middlewareLocaleRoutingFlagName, 'true');
                if (clearResetCookie) {
                    response.cookies.delete(constants_1.middlewareLocaleResetFlagName);
                }
                return response;
            }
            // BASE CASE
        }
        return res;
    }
    return nextMiddleware;
}
//# sourceMappingURL=createNextMiddleware.js.map