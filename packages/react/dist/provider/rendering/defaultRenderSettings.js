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
exports.defaultRenderSettings = void 0;
// Apply an 8 second timeout for non dev/testign environments
function shouldApplyTimeout() {
    var NODE_ENV = typeof process !== "undefined" ? process.env.NODE_ENV : "";
    return !(NODE_ENV === "development" || NODE_ENV === "test");
}
exports.defaultRenderSettings = __assign({ method: "default" }, (shouldApplyTimeout() ? { timeout: 8000 } : {}));
//# sourceMappingURL=defaultRenderSettings.js.map