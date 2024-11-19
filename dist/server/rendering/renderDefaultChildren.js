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
var react_1 = __importDefault(require("react"));
var renderVariable_1 = __importDefault(require("./renderVariable"));
var internal_1 = require("gt-react/internal");
var internal_2 = require("gt-react/internal");
function renderDefaultChildren(_a) {
    var children = _a.children, _b = _a.variables, variables = _b === void 0 ? {} : _b, _c = _a.variablesOptions, variablesOptions = _c === void 0 ? {} : _c, _d = _a.defaultLocale, defaultLocale = _d === void 0 ? internal_2.primitives.libraryDefaultLocale : _d;
    var handleSingleChild = function (child) {
        if (react_1.default.isValidElement(child)) {
            var _a = child.props, generaltranslation = _a["data-_gt"], props = __rest(_a, ['data-_gt']);
            if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "variable") {
                var _b = (0, internal_1.getVariableProps)(child.props), variableName = _b.variableName, variableType = _b.variableType, variableValue = _b.variableValue, variableOptions = _b.variableOptions; // needs both regular props and data-_gt
                variableValue = (typeof variables[variableName] !== 'undefined') ?
                    variables[variableName] : variableValue;
                return (0, renderVariable_1.default)({
                    variableName: variableName,
                    variableType: variableType,
                    variableValue: variableValue,
                    variableOptions: __assign(__assign({}, variablesOptions[variableName]), variableOptions)
                });
            }
            if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "plural") {
                var n = typeof variables.n === 'number' ? variables.n :
                    typeof props.n === 'number' ? props.n :
                        props['data-_gt-n'];
                var branches = generaltranslation.branches || {};
                return handleChildren((0, internal_1.getPluralBranch)(n, [defaultLocale], branches) || child.props.children);
            }
            if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "branch") {
                var children_1 = props.children, name_1 = props.name, branch = props.branch, _gt = props["data-_gt"], branches = __rest(props, ["children", "name", "branch", 'data-_gt']);
                name_1 = name_1 || props['data-_gt-name'] || "branch";
                branch = variables[name_1] || branch || child.props['data-_gt-branch-name'];
                branches = generaltranslation.branches || {};
                return handleChildren(branches[branch] !== undefined ? branches[branch] : children_1);
            }
            if (child.props.children) {
                return react_1.default.cloneElement(child, __assign(__assign({}, props), { 'data-_gt': undefined, children: handleChildren(child.props.children) }));
            }
            return react_1.default.cloneElement(child, __assign(__assign({}, props), { 'data-_gt': undefined }));
        }
        return child;
    };
    var handleChildren = function (children) {
        return Array.isArray(children) ? react_1.default.Children.map(children, handleSingleChild) : handleSingleChild(children);
    };
    return handleChildren(children);
}
//# sourceMappingURL=renderDefaultChildren.js.map