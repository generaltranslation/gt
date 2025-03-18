"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createNextMiddleware;
var generaltranslation_1 = require("generaltranslation");
var internal_1 = require("generaltranslation/internal");
var createErrors_1 = require("../errors/createErrors");
var server_1 = require("next/server");
var constants_1 = require("../utils/constants");
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
    var gtServicesEnabled = envParams === null || envParams === void 0 ? void 0 : envParams.gtServicesEnabled;
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
    var pathToSharedPath = Object.entries(pathConfig).reduce(function (acc, _a) {
        var sharedPath = _a[0], localizedPath = _a[1];
        // Add the shared path itself, converting to regex pattern if it has dynamic segments
        if (sharedPath.includes('[')) {
            var pattern = sharedPath.replace(/\[([^\]]+)\]/g, '[^/]+');
            acc[pattern] = sharedPath;
        }
        else {
            acc[sharedPath] = sharedPath;
        }
        // Add localized paths, converting to regex pattern if they have dynamic segments
        if (typeof localizedPath === 'object') {
            Object.values(localizedPath).forEach(function (localizedPath) {
                // Convert the localized path to a regex pattern
                // Replace [param] with [^/]+ to match any non-slash characters
                var pattern = localizedPath.replace(/\[([^\]]+)\]/g, '[^/]+');
                acc[pattern] = sharedPath;
            });
        }
        return acc;
    }, {});
    console.log(pathToSharedPath);
    /**
     * Gets the shared path from a given pathname, handling both static and dynamic paths
     * @param pathname The pathname to extract the shared path from
     * @returns The shared path or undefined if no match is found
     *
     * Example:
     * pathname: /fr/dashboard/1/le-custom
     * Returns: /dashboard/[id]/custom
     *
     * pathname: /fr/le-about
     * Returns: /about
     *
     * pathname: /fr/blog
     * Returns: /blog
     */
    var getSharedPath = function (pathname) {
        // Try exact match first
        if (pathToSharedPath[pathname]) {
            return pathToSharedPath[pathname];
        }
        // Try regex pattern match
        for (var _i = 0, _a = Object.entries(pathToSharedPath); _i < _a.length; _i++) {
            var _b = _a[_i], pattern = _b[0], sharedPath = _b[1];
            if (pattern.includes('[^/]+')) {
                // Convert the pattern to a strict regex that matches the exact path structure
                var regex = new RegExp("^".concat(pattern.replace(/\//g, '\\/'), "$"));
                if (regex.test(pathname)) {
                    return sharedPath;
                }
            }
        }
        return undefined;
    };
    /**
     * Extracts dynamic parameters from a path based on a shared path pattern
     * @param path The actual pathname containing values (includes locale prefix)
     * @param templatePath The shared path containing dynamic segments (does not include locale)
     * @returns Array of parameter values in order of appearance
     *
     * Example:
     * templatePath: /fr/dashboard/[id]/custom
     * path: /fr/dashboard/1/le-custom
     * Returns: ['1']
     *
     * Example with multiple params:
     * templatePath: /fr/dashboard/[id]/[type]/custom
     * path: /fr/dashboard/1/2/le-custom
     * Returns: ['1', '2']
     */
    var extractDynamicParams = function (templatePath, path) {
        if (!templatePath.includes('['))
            return [];
        var params = [];
        var pathSegments = path.split('/');
        var sharedSegments = templatePath.split('/');
        sharedSegments.forEach(function (segment, index) {
            if (segment.startsWith('[') && segment.endsWith(']')) {
                params.push(pathSegments[index]);
            }
        });
        return params;
    };
    /**
     * Replaces dynamic segments in a path with their actual values
     * @param path The original pathname containing actual values
     * @param templatePath The shared path containing dynamic segments
     * @returns The path with dynamic segments replaced with actual values
     *
     * Example:
     * path: /fr/dashboard/1/custom
     * templatePath: /fr/dashboard/[id]/le-custom
     * Returns: /fr/dashboard/1/le-custom
     *
     * Example:
     * path: /about
     * templatePath: /fr/le-about
     * Returns: /fr/le-about
     *
     * Note: This function only replaces dynamic segments (e.g. [id]) with their actual values.
     * It does not handle localized path parts (e.g. /custom vs /le-custom).
     */
    var replaceDynamicSegments = function (path, templatePath) {
        if (!templatePath.includes('['))
            return templatePath;
        var params = extractDynamicParams(templatePath, path);
        var paramIndex = 0;
        return templatePath.replace(/\[([^\]]+)\]/g, function (match) {
            return params[paramIndex++] || match;
        });
    };
    /**
     * Gets the full localized path given a shared path and locale
     * @param sharedPath The shared path to localize
     * @param locale The locale to use
     * @param originalUrl Optional URL to preserve query parameters from
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
     * // with query parameters
     * getLocalizedPath('/about', 'fr', new URL('/about?foo=bar')) -> '/fr/le-about?foo=bar'
     *
     * // non-shared paths return undefined
     * getLocalizedPath('/foo', 'en-US') -> undefined
     */
    var getLocalizedPath = function (sharedPath, locale) {
        var localizedPath = pathConfig[sharedPath];
        var path;
        if (typeof localizedPath === 'string') {
            path = "/".concat(locale).concat(localizedPath);
        }
        else if (typeof localizedPath === 'object') {
            path = localizedPath[locale]
                ? "/".concat(locale).concat(localizedPath[locale])
                : "/".concat(locale).concat(sharedPath);
        }
        return path;
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
     * @param {NextRequest} req - The incoming request object, containing URL and headers.
     * @returns {NextResponse} - The Next.js response, either continuing the request or redirecting to the localized URL.
     */
    function nextMiddleware(req) {
        var _a, _b, _c;
        console.log('--------------------------------');
        var headerList = new Headers(req.headers);
        var res = server_1.NextResponse.next({
            request: {
                // New request headers
                headers: headerList,
            },
        });
        var candidates = [];
        // routing
        var routingConfig;
        try {
            routingConfig = require('gt-next/_routing');
        }
        catch (e) {
            console.error(e);
        }
        // Check for rewrite flag in cookies
        var rewriteFlag = req.headers.get(constants_1.middlewareLocaleRewriteFlagName) === 'true';
        // ---------- LOCALE DETECTION ---------- //
        // Check pathname locales
        var pathnameLocale, unstandardizedPathnameLocale;
        var pathname = req.nextUrl.pathname;
        if (localeRouting) {
            // Check if there is any supported locale in the pathname
            unstandardizedPathnameLocale = extractLocale(pathname);
            var extractedLocale = gtServicesEnabled
                ? (0, generaltranslation_1.standardizeLocale)(unstandardizedPathnameLocale || '')
                : unstandardizedPathnameLocale;
            if (extractedLocale && (0, generaltranslation_1.isValidLocale)(extractedLocale)) {
                pathnameLocale = extractedLocale;
                candidates.push(pathnameLocale);
            }
        }
        // Check cookie locale
        var cookieLocale = req.cookies.get(internal_1.localeCookieName);
        if ((cookieLocale === null || cookieLocale === void 0 ? void 0 : cookieLocale.value) && (0, generaltranslation_1.isValidLocale)(cookieLocale === null || cookieLocale === void 0 ? void 0 : cookieLocale.value)) {
            var resetCookieName = constants_1.middlewareLocaleResetFlagName;
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
        // middleware locale
        var middlewareLocale = (_b = req.cookies.get(constants_1.middlewareLocaleName)) === null || _b === void 0 ? void 0 : _b.value;
        if (middlewareLocale && (0, generaltranslation_1.isValidLocale)(middlewareLocale)) {
            middlewareLocale = gtServicesEnabled
                ? (0, generaltranslation_1.standardizeLocale)(middlewareLocale)
                : middlewareLocale;
            candidates.push(middlewareLocale);
        }
        // Get locales from accept-language header
        var acceptedLocales = ((_c = headerList
            .get('accept-language')) === null || _c === void 0 ? void 0 : _c.split(',').map(function (item) { var _a; return (_a = item.split(';')) === null || _a === void 0 ? void 0 : _a[0].trim(); })) || [];
        candidates.push.apply(candidates, acceptedLocales);
        // Get default locale
        candidates.push(defaultLocale);
        // determine userLocale
        var unstandardizedUserLocale = (0, generaltranslation_1.determineLocale)(candidates.filter(generaltranslation_1.isValidLocale), approvedLocales) ||
            defaultLocale;
        var userLocale = gtServicesEnabled
            ? (0, generaltranslation_1.standardizeLocale)(unstandardizedUserLocale || '')
            : unstandardizedUserLocale;
        res.headers.set(internal_1.localeHeaderName, userLocale);
        if (userLocale) {
            // TODO: make sure this is compatable with user changing browser langugage
            res.cookies.set(constants_1.middlewareLocaleName, userLocale);
        }
        // ---------- ROUTING ---------- //
        if (localeRouting) {
            var pathname_1 = req.nextUrl.pathname;
            // Only strip off the locale if it's a valid locale (/fr/le-about -> /about), (/blog -> /blog)
            var unprefixedPathname = pathnameLocale
                ? pathname_1.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), '')
                : pathname_1;
            var originalUrl = req.nextUrl;
            // standardize pathname (ie, /tg/welcome -> /fil/welcome), (/blog -> /blog)
            var standardizedPathname = pathnameLocale && pathnameLocale !== unstandardizedPathnameLocale
                ? pathname_1.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), "/".concat(userLocale))
                : pathname_1;
            // Get the shared path for the unprefixed pathname
            var sharedPath = getSharedPath(unprefixedPathname);
            // Localized path (/en-US/blog, /fr/le-about, /fr/dashboard/[id]/custom)
            var localizedPath = sharedPath && getLocalizedPath(sharedPath, userLocale);
            // Combine localized path with dynamic parameters (/en-US/blog, /fr/le-about, /fr/dashboard/1/le-custom)
            var localizedPathWithParameters = localizedPath &&
                replaceDynamicSegments(standardizedPathname, localizedPath);
            console.log('userLocale', userLocale);
            console.log('pathnameLocale', pathnameLocale);
            console.log('unstandardizedPathnameLocale', unstandardizedPathnameLocale);
            console.log('pathname', pathname_1);
            console.log('unprefixedPathname', unprefixedPathname);
            console.log('standardizedPathname', standardizedPathname);
            console.log('sharedPath', sharedPath);
            console.log('localizedPath', localizedPath);
            console.log('localizedPathWithParameters', localizedPathWithParameters);
            // BASE CASE: default locale, same path (/en-US/blog -> /en-US/blog), (/en-US/dashboard/1/custom -> /en-US/dashboard/1/custom)
            if (localizedPathWithParameters &&
                standardizedPathname === localizedPathWithParameters &&
                userLocale === defaultLocale) {
                console.log('BASE CASE', standardizedPathname);
                return res;
            }
            // BASE CASE: at localized path, which is the same as the shared path (/fil/blog -> /fil/blog)
            if (pathname_1 === localizedPathWithParameters &&
                "/".concat(userLocale).concat(sharedPath) === localizedPathWithParameters) {
                console.log('BASE CASE', pathname_1, '->', localizedPathWithParameters);
                return res;
            }
            // If we've already rewritten this path, don't process it again
            if (rewriteFlag) {
                console.log('BASE CASE', standardizedPathname);
                return res;
            }
            // REWRITE CASE: proxies a localized path, same locale (/fr/le-about => /fr/about) (/fr/dashboard/1/le-custom => /fr/dashboard/1/custom)
            if (localizedPathWithParameters &&
                standardizedPathname === localizedPathWithParameters) {
                // convert to shared path with dynamic parameters
                var rewritePath = replaceDynamicSegments(localizedPathWithParameters, "/".concat(userLocale).concat(sharedPath));
                var rewriteUrl = new URL(rewritePath, originalUrl);
                rewriteUrl.search = originalUrl.search;
                headerList.set(internal_1.localeHeaderName, userLocale);
                var response = server_1.NextResponse.rewrite(rewriteUrl, {
                    headers: headerList,
                });
                response.headers.set(constants_1.middlewareLocaleRewriteFlagName, 'true');
                if (userLocale) {
                    response.cookies.set(constants_1.middlewareLocaleName, userLocale);
                }
                console.log('REWRITE CASE', pathname_1, '->', rewritePath);
                return response;
            }
            // REWRITE CASE: no locale prefix
            if (!pathnameLocale &&
                !prefixDefaultLocale &&
                (0, generaltranslation_1.isSameDialect)(userLocale, defaultLocale)) {
                var rewritePath = "/".concat(userLocale).concat(pathname_1);
                var rewriteUrl = new URL(rewritePath, originalUrl);
                rewriteUrl.search = originalUrl.search;
                var response = server_1.NextResponse.rewrite(rewriteUrl, {
                    headers: headerList,
                });
                response.headers.set(constants_1.middlewareLocaleRewriteFlagName, 'true');
                console.log('REWRITE CASE', pathname_1, '->', rewritePath);
                return response;
            }
            // REDIRECT CASE: non-i18n path
            // 1. use customized path if it exists                      (/en-US/about -> /fr/le-about), (/about -> /fr/le-about)
            // 2. otherwise, if pathname has locale prefix, replace it  (/en-US/welcome -> /fr/welcome)
            // 3. otherwise, prefix with locale                         (/welcome -> /fr/welcome)
            if (unstandardizedPathnameLocale !== userLocale) {
                // determine redirect path
                var redirectPath = localizedPathWithParameters ||
                    (pathnameLocale
                        ? pathname_1.replace(new RegExp("^/".concat(unstandardizedPathnameLocale)), "/".concat(userLocale))
                        : "/".concat(userLocale).concat(pathname_1));
                var redirectUrl = new URL(redirectPath, originalUrl);
                redirectUrl.search = originalUrl.search;
                var response = server_1.NextResponse.redirect(redirectUrl);
                if (userLocale) {
                    response.cookies.set(constants_1.middlewareLocaleName, userLocale);
                }
                console.log('REDIRECT CASE', pathname_1, '->', redirectPath);
                return response;
            }
            // REDIRECT CASE: mismatched localized path (/fr/about -> /fr/le-about), mismatched dynamic path (/fr/dashboard/1/custom -> /fr/dashboard/1/le-custom)
            if (localizedPathWithParameters) {
                var redirectUrl = new URL(localizedPathWithParameters, originalUrl);
                redirectUrl.search = originalUrl.search;
                var response = server_1.NextResponse.redirect(redirectUrl);
                if (userLocale) {
                    response.cookies.set(constants_1.middlewareLocaleName, userLocale);
                }
                console.log('REDIRECT CASE', pathname_1, '->', localizedPathWithParameters);
                return response;
            }
            // BASE CASE
            console.log('BASE CASE', pathname_1);
            return res;
        }
        return res;
    }
    return nextMiddleware;
}
//# sourceMappingURL=createNextMiddleware.js.map