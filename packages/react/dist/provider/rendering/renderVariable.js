"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = renderVariable;
var jsx_runtime_1 = require("react/jsx-runtime");
var Num_1 = __importDefault(require("../../variables/Num"));
var Var_1 = __importDefault(require("../../variables/Var"));
var Currency_1 = __importDefault(require("../../variables/Currency"));
var DateTime_1 = __importDefault(require("../../variables/DateTime"));
function renderVariable(_a) {
    var variableType = _a.variableType, variableName = _a.variableName, variableValue = _a.variableValue, variableOptions = _a.variableOptions, locales = _a.locales;
    if (variableType === "number") {
        return ((0, jsx_runtime_1.jsx)(Num_1.default, { name: variableName, value: variableValue, options: variableOptions }));
    }
    else if (variableType === "datetime") {
        return ((0, jsx_runtime_1.jsx)(DateTime_1.default, { name: variableName, value: variableValue, options: variableOptions }));
    }
    else if (variableType === "currency") {
        return ((0, jsx_runtime_1.jsx)(Currency_1.default, { name: variableName, value: variableValue, options: variableOptions }));
    }
    return (0, jsx_runtime_1.jsx)(Var_1.default, { name: variableName, value: variableValue });
}
//# sourceMappingURL=renderVariable.js.map