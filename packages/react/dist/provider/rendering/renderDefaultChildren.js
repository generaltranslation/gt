"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = renderDefaultChildren;
const react_1 = __importDefault(require("react"));
const getGTProp_1 = __importDefault(require("../helpers/getGTProp"));
const _getVariableProps_1 = __importDefault(require("../../variables/_getVariableProps"));
const internal_1 = require("../../internal");
const internal_2 = require("generaltranslation/internal");
const getVariableName_1 = require("../../variables/getVariableName");
function renderDefaultChildren({ children, variables = {}, variablesOptions = {}, defaultLocale = internal_2.libraryDefaultLocale, renderVariable, }) {
    const handleSingleChildElement = (child) => {
        const generaltranslation = (0, getGTProp_1.default)(child);
        if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "variable") {
            let { variableName, variableType, variableValue, variableOptions } = (0, _getVariableProps_1.default)(child.props);
            variableValue = (() => {
                if (typeof variables[variableName] !== "undefined") {
                    return variables[variableName];
                }
                if (typeof variableValue !== "undefined")
                    return variableValue;
                if (variableName.startsWith(getVariableName_1.baseVariablePrefix)) {
                    // pain point: somewhat breakable logic
                    const fallbackVariableName = (0, getVariableName_1.getFallbackVariableName)(variableType);
                    if (typeof variables[fallbackVariableName] !== "undefined") {
                        return variables[fallbackVariableName];
                    }
                }
                return undefined;
            })();
            variableOptions = Object.assign(Object.assign({}, variablesOptions[variableName]), variableOptions);
            return renderVariable({
                variableName,
                variableType,
                variableValue,
                variableOptions,
                locales: [defaultLocale],
            });
        }
        if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "plural") {
            const n = typeof variables.n === "number"
                ? variables.n
                : typeof child.props.n === "number"
                    ? child.props.n
                    : child.props["data-_gt-n"];
            if (typeof n === "number" && typeof variables.n === "undefined")
                variables.n = n;
            const branches = generaltranslation.branches || {};
            return handleChildren((0, internal_1.getPluralBranch)(n, [defaultLocale], branches) || child.props.children);
        }
        if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "branch") {
            let _a = child.props, { children, name, branch, "data-_gt": _gt } = _a, branches = __rest(_a, ["children", "name", "branch", "data-_gt"]);
            name = name || child.props["data-_gt-name"] || "branch";
            branch = variables[name] || branch || child.props["data-_gt-branch-name"];
            branches = generaltranslation.branches || {};
            return handleChildren(branches[branch] !== undefined ? branches[branch] : children);
        }
        if (child.props.children) {
            return react_1.default.cloneElement(child, Object.assign(Object.assign({}, child.props), { "data-_gt": undefined, children: handleChildren(child.props.children) }));
        }
        return react_1.default.cloneElement(child, Object.assign(Object.assign({}, child.props), { "data-_gt": undefined }));
    };
    const handleSingleChild = (child) => {
        if (react_1.default.isValidElement(child)) {
            return handleSingleChildElement(child);
        }
        return child;
    };
    const handleChildren = (children) => {
        return Array.isArray(children)
            ? react_1.default.Children.map(children, handleSingleChild)
            : handleSingleChild(children);
    };
    return handleChildren(children);
}
//# sourceMappingURL=renderDefaultChildren.js.map