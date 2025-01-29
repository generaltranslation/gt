"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRenderSettings = void 0;
// Apply an 8 second timeout for non dev/testign environments
function shouldApplyTimeout() {
    const NODE_ENV = typeof process !== "undefined" ? process.env.NODE_ENV : "";
    return !(NODE_ENV === "development" || NODE_ENV === "test");
}
exports.defaultRenderSettings = Object.assign({ method: "default" }, (shouldApplyTimeout() ? { timeout: 8000 } : {}));
//# sourceMappingURL=defaultRenderSettings.js.map