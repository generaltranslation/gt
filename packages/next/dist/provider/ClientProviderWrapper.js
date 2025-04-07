"use strict";
'use client';
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
exports.default = ClientProvider;
var jsx_runtime_1 = require("react/jsx-runtime");
var client_1 = require("gt-react/client");
var navigation_1 = require("next/navigation");
var react_1 = require("react");
var utils_1 = require("../middleware-dir/utils");
var generaltranslation_1 = require("generaltranslation");
function ClientProvider(props) {
    var locale = props.locale, locales = props.locales, defaultLocale = props.defaultLocale, gtServicesEnabled = props.gtServicesEnabled, referrerLocaleCookieName = props.referrerLocaleCookieName, localeRoutingEnabledCookieName = props.localeRoutingEnabledCookieName;
    // Trigger page reload when locale changes
    // When nav to same route but in diff locale, client components were cached and not re-rendered
    var pathname = (0, navigation_1.usePathname)();
    (0, react_1.useEffect)(function () {
        var _a;
        // ----- Referrer Locale ----- //
        if (locale) {
            document.cookie = "".concat(referrerLocaleCookieName, "=").concat(locale, ";path=/");
        }
        // ----- Middleware ----- //
        // Trigger page reload when locale changes
        // When nav to same route but in diff locale (ie, /en/blog -> /fr/blog), client components were cached and not re-rendered
        var middlewareEnabled = ((_a = document.cookie
            .split('; ')
            .find(function (row) { return row.startsWith("".concat(localeRoutingEnabledCookieName, "=")); })) === null || _a === void 0 ? void 0 : _a.split('=')[1]) === 'true';
        if (middlewareEnabled) {
            // Extract locale from pathname
            var extractedLocale = (0, utils_1.extractLocale)(pathname) || defaultLocale;
            var pathLocale = (0, generaltranslation_1.determineLocale)([
                gtServicesEnabled
                    ? (0, generaltranslation_1.standardizeLocale)(extractedLocale)
                    : extractedLocale,
                defaultLocale,
            ], locales);
            if (pathLocale && locales.includes(pathLocale) && pathLocale !== locale) {
                // clear cookie (avoids infinite loop when there is no middleware)
                document.cookie = "".concat(localeRoutingEnabledCookieName, "=;path=/");
                // reload page
                window.location.reload();
            }
        }
    }, [
        pathname,
        locale,
        locales,
        defaultLocale,
        gtServicesEnabled,
        referrerLocaleCookieName,
        localeRoutingEnabledCookieName,
    ]);
    return (0, jsx_runtime_1.jsx)(client_1.ClientProvider, __assign({}, props));
}
//# sourceMappingURL=ClientProviderWrapper.js.map