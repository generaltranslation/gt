"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getVariableProps;
const defaultVariableNames_1 = __importDefault(require("./defaultVariableNames"));
function getVariableProps(props) {
    var _a;
    const variableType = ((_a = props['data-generaltranslation']) === null || _a === void 0 ? void 0 : _a.variableType) || "variable";
    const result = {
        variableType,
        variableName: props.name || props['data-gt-variable-name'] || defaultVariableNames_1.default[variableType],
        variableValue: (typeof props.defaultValue !== 'undefined') ? props.defaultValue : (typeof props.children !== 'undefined') ? props.children : undefined,
        variableOptions: props.options || props['data-gt-variable-options'] || undefined
    };
    return result;
}
//# sourceMappingURL=getVariableProps.js.map