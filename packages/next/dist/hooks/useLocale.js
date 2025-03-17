"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLocale = useLocale;
var react_1 = require("react");
var internal_1 = require("generaltranslation/internal");
var navigation_1 = require("next/navigation");
/**
 * Hook to subscribe to locale changes in client components.
 * This ensures client components re-render when the locale changes.
 */
function useLocale() {
    var pathname = (0, navigation_1.usePathname)();
    var _a = (0, react_1.useState)(null), locale = _a[0], setLocale = _a[1];
    (0, react_1.useEffect)(function () {
        var _a;
        // Get initial locale from cookie
        var currentLocale = (_a = document.cookie
            .split('; ')
            .find(function (row) { return row.startsWith("".concat(internal_1.localeCookieName, "=")); })) === null || _a === void 0 ? void 0 : _a.split('=')[1];
        setLocale(currentLocale || null);
        // Set up cookie change listener
        var observer = new MutationObserver(function () {
            var _a;
            var newLocale = (_a = document.cookie
                .split('; ')
                .find(function (row) { return row.startsWith("".concat(internal_1.localeCookieName, "=")); })) === null || _a === void 0 ? void 0 : _a.split('=')[1];
            if (newLocale !== locale) {
                setLocale(newLocale || null);
            }
        });
        // Observe cookie changes by watching document.cookie
        observer.observe(document, {
            subtree: true,
            childList: true,
            attributes: true,
        });
        return function () { return observer.disconnect(); };
    }, [pathname]); // Re-run when pathname changes
    return locale;
}
//# sourceMappingURL=useLocale.js.map