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
var internal_1 = require("gt-react/internal");
var navigation_1 = require("next/navigation");
var react_1 = require("react");
var constants_1 = require("../utils/constants");
var utils_1 = require("../middleware-dir/utils");
var generaltranslation_1 = require("generaltranslation");
function ClientProvider(props) {
    // locale change on client, trigger page reload
    var router = (0, navigation_1.useRouter)();
    var onLocaleChange = function () {
        document.cookie = "".concat(constants_1.middlewareLocaleResetFlagName, "=true;path=/");
        router.refresh();
    };
    var pathname = (0, navigation_1.usePathname)();
    (0, react_1.useEffect)(function () {
        var _a;
        // ----- Referrer Locale ----- //
        if (props.locale) {
            // TODO: if this is the same as the brower's accepted locale, don't set the cookie (GDPR)
            document.cookie = "".concat(internal_1.defaultReferrerLocaleCookieName, "=").concat(props.locale, ";path=/");
        }
        // ----- Middleware ----- //
        // Trigger page reload when locale changes
        // When nav to same route but in diff locale (ie, /en/blog -> /fr/blog), client components were cached and not re-rendered
        var middlewareEnabled = ((_a = document.cookie
            .split('; ')
            .find(function (row) { return row.startsWith("".concat(constants_1.middlewareLocaleRoutingFlagName, "=")); })) === null || _a === void 0 ? void 0 : _a.split('=')[1]) === 'true';
        if (middlewareEnabled) {
            // Extract locale from pathname
            var extractedLocale = (0, utils_1.extractLocale)(pathname) || props.defaultLocale;
            var pathLocale = props.gtServicesEnabled
                ? (0, generaltranslation_1.standardizeLocale)(extractedLocale)
                : extractedLocale;
            if (pathLocale &&
                props.locales.includes(pathLocale) &&
                pathLocale !== props.locale) {
                // clear cookie (avoids infinite loop when there is no middleware)
                document.cookie = "".concat(constants_1.middlewareLocaleRoutingFlagName, "=;path=/");
                // reload server
                router.refresh();
                // reload client
                window.location.reload();
            }
        }
    }, [
        pathname, // Re-run when pathname changes
        props.locale,
        props.locales,
        props.defaultLocale,
        props.gtServicesEnabled,
    ]);
    return (0, jsx_runtime_1.jsx)(client_1.ClientProvider, __assign({ onLocaleChange: onLocaleChange }, props));
}
//# sourceMappingURL=ClientProviderWrapper.js.map