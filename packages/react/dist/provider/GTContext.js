"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GTContext = void 0;
exports.default = useGTContext;
const react_1 = require("react");
exports.GTContext = (0, react_1.createContext)(undefined);
function useGTContext(errorString = "useGTContext() must be used within a <GTProvider>!") {
    const context = (0, react_1.useContext)(exports.GTContext);
    if (typeof context === "undefined") {
        throw new Error(errorString);
    }
    return context;
}
//# sourceMappingURL=GTContext.js.map