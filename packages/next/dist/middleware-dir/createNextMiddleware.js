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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createNextMiddleware;
var generaltranslation_1 = require("generaltranslation");
var internal_1 = require("generaltranslation/internal");
var createErrors_1 = require("../errors/createErrors");
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
        console.log('--------------------------------');
        // ---------- LOCALE DETECTION ---------- //
        var _a = (0, utils_1.getLocaleFromRequest)(req, defaultLocale, approvedLocales, localeRouting, gtServicesEnabled, prefixDefaultLocale, defaultLocalePaths), userLocale = _a.userLocale, pathnameLocale = _a.pathnameLocale, unstandardizedPathnameLocale = _a.unstandardizedPathnameLocale, clearResetCookie = _a.clearResetCookie;
        var headerList = new Headers(req.headers);
        var responseConfig = {
            originalUrl: req.nextUrl,
            headerList: headerList,
            userLocale: userLocale,
            clearResetCookie: clearResetCookie,
            localeRouting: localeRouting,
        };
        var getRewriteResponse = function (responsePath) {
            return (0, utils_1.getResponse)(__assign({ responsePath: responsePath, type: 'rewrite' }, responseConfig));
        };
        var getRedirectResponse = function (responsePath) {
            return (0, utils_1.getResponse)(__assign({ responsePath: responsePath, type: 'redirect' }, responseConfig));
        };
        var getNextResponse = function () {
            return (0, utils_1.getResponse)(__assign({ type: 'next' }, responseConfig));
        };
        // const res = NextResponse.next({
        //   request: {
        //     // New request headers
        //     headers: headerList,
        //   },
        // });
        // res.headers.set(localeHeaderName, userLocale);
        // res.cookies.set(middlewareLocaleRoutingFlagName, localeRouting.toString());
        // if (clearResetCookie) {
        //   res.cookies.delete(middlewareLocaleResetFlagName);
        // }
        if (localeRouting) {
            // ---------- GET PATHS ---------- //
            // get pathname
            var pathname = req.nextUrl.pathname;
            // standardize pathname (ie, /tg/welcome -> /fil/welcome), (/blog -> /blog)
            var standardizedPathname = pathnameLocale && pathnameLocale !== unstandardizedPathnameLocale
                ? pathname.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), "/".concat(userLocale))
                : pathname;
            // Get the shared path for the unprefixed pathname
            var sharedPath = (0, utils_1.getSharedPath)(standardizedPathname, pathToSharedPath);
            // Get shared path with parameters (/en/dashboard/1/custom)
            var sharedPathWithParameters = sharedPath !== undefined
                ? (0, utils_1.replaceDynamicSegments)(pathnameLocale
                    ? standardizedPathname
                    : "/".concat(userLocale).concat(standardizedPathname), "/".concat(userLocale).concat(sharedPath))
                : undefined;
            // Localized path (/en/blog, /fr/fr-about, /fr/dashboard/[id]/custom)
            var localizedPath = sharedPath !== undefined
                ? (0, utils_1.getLocalizedPath)(sharedPath, userLocale, pathConfig)
                : undefined;
            // Combine localized path with dynamic parameters (/en/blog, /fr/fr-about, /fr/dashboard/1/fr-custom)
            var localizedPathWithParameters = localizedPath !== undefined
                ? (0, utils_1.replaceDynamicSegments)(pathnameLocale
                    ? standardizedPathname
                    : "/".concat(userLocale).concat(standardizedPathname), localizedPath)
                : undefined;
            console.log('pathname:                     %s', pathname);
            console.log('unstandardizedPathnameLocale: %s', unstandardizedPathnameLocale);
            console.log('pathnameLocale:               %s', pathnameLocale);
            console.log('standardizedPathname:         %s', standardizedPathname);
            console.log();
            console.log('userLocale:                   %s', userLocale);
            console.log();
            console.log('sharedPath:                   %s', sharedPath);
            console.log('sharedPathWithParameters:     %s', sharedPathWithParameters);
            console.log();
            console.log('localizedPath:                %s', localizedPath);
            console.log('localizedPathWithParameters:  %s', localizedPathWithParameters);
            console.log('[MIDDLEWARE] locale', userLocale);
            console.log('--------------------------------');
            // ---------- ROUTING LOGIC ---------- //
            // ----- CASE: no localized path exists ----- //
            if (localizedPathWithParameters === undefined) {
                // --- CASE: remove defaultLocale prefix --- //
                if (!prefixDefaultLocale && (0, generaltranslation_1.isSameDialect)(userLocale, defaultLocale)) {
                    // REDIRECT CASE: pathname locale is wrong (/fr/customers -> /customers) (this usually happens after a locale switch)
                    if (pathnameLocale && userLocale !== unstandardizedPathnameLocale) {
                        return getRedirectResponse(pathname.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), ''));
                    }
                    // REWRITE CASE: no pathnameLocale (/customers -> /en/customers)
                    if (!pathnameLocale) {
                        return getRewriteResponse("/".concat(userLocale).concat(pathname));
                    }
                }
                else {
                    // --- CASE: add defaultLocale prefix --- //
                    // REDIRECT CASE: wrong pathnameLocale (ie, /fr/customers -> /en/customers) (this usually happens after a locale switch)
                    if (pathnameLocale && userLocale !== unstandardizedPathnameLocale) {
                        return getRedirectResponse(pathname.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), "/".concat(userLocale)));
                    }
                    // REDIRECT CASE: no pathnameLocale (ie, /customers -> /fr/customers)
                    if (!pathnameLocale) {
                        return getRedirectResponse("/".concat(userLocale).concat(pathname));
                    }
                }
                // BASE CASE: has pathnameLocale and it's correct
                return getNextResponse();
            }
            // ----- CASE: localized path exists ----- //
            if (!prefixDefaultLocale && (0, generaltranslation_1.isSameDialect)(userLocale, defaultLocale)) {
                // --- CASE: remove defaultLocale prefix --- //
                // REDIRECT CASE: unprefixed pathname is wrong (/about -> /en-about) (/dashboard/1/custom -> /en-dashboard/1/en-custom)
                // REDIRECT CASE: pathname is wrong (/fr/blog -> /blog) (/fr/fr-about -> /en-about)
                if ((!pathnameLocale &&
                    localizedPathWithParameters !== "/".concat(userLocale).concat(pathname)) ||
                    (pathnameLocale && localizedPathWithParameters !== pathname)) {
                    // remove locale prefix
                    return getRedirectResponse(localizedPathWithParameters.replace(new RegExp("^/".concat(userLocale)), ''));
                }
                // REWRITE CASE: displaying correct path (/blog -> /en/blog) (/en-dashboard/1/en-custom -> /en/dashboard/1/custom) (/en-about -> /en/about)
                // shared path with dynamic parameters
                return getRewriteResponse((0, utils_1.replaceDynamicSegments)(pathnameLocale
                    ? standardizedPathname
                    : "/".concat(userLocale).concat(standardizedPathname), "/".concat(userLocale).concat(sharedPath)));
            }
            // --- CASE: add defaultLocale prefix --- //
            // REDIRECT CASE: path is missing prefix (ie, /blog -> /en/blog) (/dashboard -> /fr/fr-dashboard)
            // REDIRECT CASE: wrong path (invalid path) (/fr/about -> /fr/fr-about) (NOT: /en/fr-about -> /en/en-about, /en/fr-about should 404)
            if (!pathnameLocale || localizedPathWithParameters !== pathname) {
                return getRedirectResponse(localizedPathWithParameters);
            }
            // REWRITE CASE: displaying correct path at localized path, which is the same as the shared path (/fil/blog => /fil/blog) (/fr/fr-dashboard/1/fr-custom => /fr/dashboard/1/custom)
            if (sharedPathWithParameters !== undefined &&
                standardizedPathname === localizedPathWithParameters && // we are displaying the correct path
                standardizedPathname !== sharedPathWithParameters // no rewrite needed if it's already the shared path
            ) {
                // convert to shared path with dynamic parameters
                return getRewriteResponse(sharedPathWithParameters);
            }
        }
        // BASE CASE
        return getNextResponse();
    }
    return nextMiddleware;
}
//# sourceMappingURL=createNextMiddleware.js.map