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
function ClientProvider(props) {
    // locale change on client, trigger page reload
    var router = (0, navigation_1.useRouter)();
    var onLocaleChange = function () {
        document.cookie = "generaltranslation.locale.reset=true;path=/";
        router.refresh();
    };
    // Trigger page reload when locale changes
    // When nav to same route but in diff locale, client components were cached and not re-rendered
    var pathname = (0, navigation_1.usePathname)();
    (0, react_1.useEffect)(function () {
        var _a;
        console.log("".concat(pathname, " re-rendered"));
        var newLocale = (_a = document.cookie
            .split('; ')
            .find(function (row) { return row.startsWith("generaltranslation.middleware.locale="); })) === null || _a === void 0 ? void 0 : _a.split('=')[1];
        if (newLocale && newLocale !== props.locale) {
            console.log('New cookie locale', newLocale);
            // reload server
            router.refresh();
            // reload client
            window.location.reload();
        }
    }, [pathname]); // Re-run when pathname changes
    return (0, jsx_runtime_1.jsx)(client_1.ClientProvider, __assign({ onLocaleChange: onLocaleChange }, props));
}
//# sourceMappingURL=ClientProviderWrapper.js.map