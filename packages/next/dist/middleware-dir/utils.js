"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLocale = extractLocale;
exports.extractDynamicParams = extractDynamicParams;
exports.replaceDynamicSegments = replaceDynamicSegments;
exports.getLocalizedPath = getLocalizedPath;
exports.createPathToSharedPathMap = createPathToSharedPathMap;
exports.getSharedPath = getSharedPath;
exports.getLocaleFromRequest = getLocaleFromRequest;
var generaltranslation_1 = require("generaltranslation");
var internal_1 = require("generaltranslation/internal");
var internal_2 = require("gt-react/internal");
/**
 * Extracts the locale from the given pathname.
 */
function extractLocale(pathname) {
    var matches = pathname.match(/^\/([^\/]+)(?:\/|$)/);
    return matches ? matches[1] : null;
}
/**
 * Extracts dynamic parameters from a path based on a shared path pattern
 */
function extractDynamicParams(templatePath, path) {
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
}
/**
 * Replaces dynamic segments in a path with their actual values
 */
function replaceDynamicSegments(path, templatePath) {
    if (!templatePath.includes('['))
        return templatePath;
    var params = extractDynamicParams(templatePath, path);
    var paramIndex = 0;
    var result = templatePath.replace(/\[([^\]]+)\]/g, function (match) {
        return params[paramIndex++] || match;
    });
    return result;
}
/**
 * Gets the full localized path given a shared path and locale
 */
function getLocalizedPath(sharedPath, locale, pathConfig) {
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
}
/**
 * Creates a map of localized paths to shared paths using regex patterns
 */
function createPathToSharedPathMap(pathConfig, prefixDefaultLocale, defaultLocale) {
    return Object.entries(pathConfig).reduce(function (acc, _a) {
        var sharedPath = _a[0], localizedPaths = _a[1];
        var pathToSharedPath = acc.pathToSharedPath, defaultLocalePaths = acc.defaultLocalePaths;
        // Add the shared path itself, converting to regex pattern if it has dynamic segments
        if (sharedPath.includes('[')) {
            var pattern = sharedPath.replace(/\[([^\]]+)\]/g, '[^/]+');
            pathToSharedPath[pattern] = sharedPath;
        }
        else {
            pathToSharedPath[sharedPath] = sharedPath;
        }
        if (typeof localizedPaths === 'object') {
            Object.entries(localizedPaths).forEach(function (_a) {
                var locale = _a[0], localizedPath = _a[1];
                // Convert the localized path to a regex pattern
                // Replace [param] with [^/]+ to match any non-slash characters
                var pattern = localizedPath.replace(/\[([^\]]+)\]/g, '[^/]+');
                pathToSharedPath["/".concat(locale).concat(pattern)] = sharedPath;
                if (!prefixDefaultLocale && locale === defaultLocale) {
                    pathToSharedPath[pattern] = sharedPath;
                    defaultLocalePaths.push(pattern);
                }
            });
        }
        return acc;
    }, { pathToSharedPath: {}, defaultLocalePaths: [] });
}
/**
 * Gets the shared path from a given pathname, handling both static and dynamic paths
 */
function getSharedPath(pathname, pathToSharedPath) {
    // Try exact match first
    if (pathToSharedPath[pathname]) {
        return pathToSharedPath[pathname];
    }
    // Without locale prefix
    var pathnameWithoutLocale = pathname.replace(/^\/[^/]+/, '');
    if (pathToSharedPath[pathnameWithoutLocale]) {
        return pathToSharedPath[pathnameWithoutLocale];
    }
    // Try regex pattern match
    var candidateSharedPath = undefined;
    for (var _i = 0, _a = Object.entries(pathToSharedPath); _i < _a.length; _i++) {
        var _b = _a[_i], pattern = _b[0], sharedPath = _b[1];
        if (pattern.includes('/[^/]+')) {
            // Convert the pattern to a strict regex that matches the exact path structure
            var regex = new RegExp("^".concat(pattern.replace(/\//g, '\\/'), "$"));
            if (regex.test(pathname)) {
                return sharedPath;
            }
            if (!candidateSharedPath && regex.test(pathnameWithoutLocale)) {
                candidateSharedPath = sharedPath;
            }
        }
    }
    return candidateSharedPath;
}
/**
 *
 * @returns
 */
function inDefaultLocalePaths(pathname, defaultLocalePaths) {
    // Try exact match first
    if (defaultLocalePaths.includes(pathname)) {
        return true;
    }
    // Try regex pattern match
    for (var _i = 0, defaultLocalePaths_1 = defaultLocalePaths; _i < defaultLocalePaths_1.length; _i++) {
        var path = defaultLocalePaths_1[_i];
        if (path.includes('/[^/]+')) {
            var regex = new RegExp("^".concat(path.replace(/\//g, '\\/'), "$"));
            if (regex.test(pathname)) {
                return true;
            }
        }
    }
    return false;
}
/**
 * Gets the locale from the request using various sources
 */
function getLocaleFromRequest(req, defaultLocale, approvedLocales, localeRouting, gtServicesEnabled, prefixDefaultLocale, defaultLocalePaths) {
    var _a, _b;
    var headerList = new Headers(req.headers);
    var candidates = [];
    var clearResetCookie = false;
    var pathname = req.nextUrl.pathname;
    // Check pathname locales
    var pathnameLocale, unstandardizedPathnameLocale;
    if (localeRouting) {
        unstandardizedPathnameLocale = extractLocale(pathname);
        var extractedLocale = gtServicesEnabled
            ? (0, generaltranslation_1.standardizeLocale)(unstandardizedPathnameLocale || '')
            : unstandardizedPathnameLocale;
        if (extractedLocale && (0, generaltranslation_1.isValidLocale)(extractedLocale)) {
            pathnameLocale = extractedLocale;
            candidates.push(pathnameLocale);
        }
    }
    // Check pathname for a customized unprefixed default locale path (e.g. /en-about , /en-dashboard/1/en-custom)
    if (localeRouting &&
        !prefixDefaultLocale &&
        !pathnameLocale &&
        inDefaultLocalePaths(pathname, defaultLocalePaths)) {
        candidates.push(defaultLocale); // will override other candidates
    }
    // Check cookie locale
    var cookieLocale = req.cookies.get(internal_1.localeCookieName);
    if ((cookieLocale === null || cookieLocale === void 0 ? void 0 : cookieLocale.value) && (0, generaltranslation_1.isValidLocale)(cookieLocale === null || cookieLocale === void 0 ? void 0 : cookieLocale.value)) {
        var resetCookie = req.cookies.get(internal_2.middlewareLocaleResetFlagName);
        if (resetCookie === null || resetCookie === void 0 ? void 0 : resetCookie.value) {
            candidates.unshift(cookieLocale.value);
            clearResetCookie = true;
        }
        else {
            candidates.push(cookieLocale.value);
        }
    }
    // Check referer locale
    var refererLocale;
    if (localeRouting) {
        var referer = headerList.get('referer');
        if (referer && typeof referer === 'string') {
            refererLocale = extractLocale((_a = new URL(referer)) === null || _a === void 0 ? void 0 : _a.pathname);
            if ((0, generaltranslation_1.isValidLocale)(refererLocale || ''))
                candidates.push(refererLocale || '');
        }
    }
    // Get locales from accept-language header
    if (process.env._GENERALTRANSLATION_IGNORE_BROWSER_LOCALES === 'false') {
        var acceptedLocales = ((_b = headerList
            .get('accept-language')) === null || _b === void 0 ? void 0 : _b.split(',').map(function (item) { var _a; return (_a = item.split(';')) === null || _a === void 0 ? void 0 : _a[0].trim(); })) || [];
        if (acceptedLocales)
            candidates.push.apply(candidates, acceptedLocales);
    }
    // Get default locale
    candidates.push(defaultLocale);
    // determine userLocale
    var unstandardizedUserLocale = (0, generaltranslation_1.determineLocale)(candidates.filter(generaltranslation_1.isValidLocale), approvedLocales) ||
        defaultLocale;
    var userLocale = gtServicesEnabled
        ? (0, generaltranslation_1.standardizeLocale)(unstandardizedUserLocale)
        : unstandardizedUserLocale;
    return {
        userLocale: userLocale,
        pathnameLocale: pathnameLocale,
        unstandardizedPathnameLocale: unstandardizedPathnameLocale,
        clearResetCookie: clearResetCookie,
    };
}
//# sourceMappingURL=utils.js.map