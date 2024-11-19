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
exports.default = renderTranslatedChildren;
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = __importDefault(require("react"));
var internal_1 = require("gt-react/internal");
var getGTProp_1 = __importDefault(require("../../utils/getGTProp"));
var renderVariable_1 = __importDefault(require("./renderVariable"));
function renderTranslatedElement(_a) {
    var _b;
    var sourceElement = _a.sourceElement, targetElement = _a.targetElement, _c = _a.variables, variables = _c === void 0 ? {} : _c, _d = _a.variablesOptions, variablesOptions = _d === void 0 ? {} : _d, _e = _a.locales, locales = _e === void 0 ? [internal_1.primitives.libraryDefaultLocale] : _e;
    var _f = sourceElement.props, generaltranslation = _f["data-_gt"], props = __rest(_f, ['data-_gt']);
    var transformation = generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation["transformation"];
    if (transformation === "plural") {
        var n = typeof variables.n === 'number' ? variables.n :
            typeof sourceElement.props.n === 'number' ? sourceElement.props.n :
                sourceElement.props['data-_gt-n'];
        var sourceBranches = generaltranslation.branches || {};
        var sourceBranch = (0, internal_1.getPluralBranch)(n, locales, sourceBranches) || sourceElement.props.children;
        var targetBranches = targetElement.props["data-_gt"].branches || {};
        var targetBranch = (0, internal_1.getPluralBranch)(n, locales, targetBranches) || targetElement.props.children;
        return renderTranslatedChildren({
            source: sourceBranch,
            target: targetBranch,
            variables: variables,
            variablesOptions: variablesOptions,
            locales: locales
        });
    }
    if (transformation === "branch") {
        var name_1 = props.name, branch = props.branch, children = props.children;
        name_1 = name_1 || sourceElement.props['data-_gt-name'] || "branch";
        branch = variables[name_1] || branch || sourceElement.props['data-_gt-branch-name'];
        var sourceBranch = (generaltranslation.branches || {})[branch] || children;
        var targetBranch = (targetElement.props["data-_gt"].branches || {})[branch] || targetElement.props.children;
        return renderTranslatedChildren({
            source: sourceBranch,
            target: targetBranch,
            variables: variables,
            variablesOptions: variablesOptions,
            locales: locales
        });
    }
    if ((props === null || props === void 0 ? void 0 : props.children) && ((_b = targetElement.props) === null || _b === void 0 ? void 0 : _b.children)) {
        return react_1.default.cloneElement(sourceElement, __assign(__assign({}, props), { 'data-_gt': undefined, children: renderTranslatedChildren({
                source: props.children,
                target: targetElement.props.children,
                variables: variables,
                variablesOptions: variablesOptions,
                locales: locales
            }) }));
    }
    return sourceElement;
}
function renderTranslatedChildren(_a) {
    var source = _a.source, target = _a.target, _b = _a.variables, variables = _b === void 0 ? {} : _b, _c = _a.variablesOptions, variablesOptions = _c === void 0 ? {} : _c, _d = _a.locales, locales = _d === void 0 ? [internal_1.primitives.libraryDefaultLocale] : _d;
    // Most straightforward case, return a valid React node
    if ((target === null || typeof target === 'undefined') && source)
        return source;
    if (typeof target === 'string')
        return target;
    if (Array.isArray(source) && Array.isArray(target)) {
        var sourceElements_1 = source.filter(function (sourceChild) {
            if (react_1.default.isValidElement(sourceChild)) {
                var generaltranslation = (0, getGTProp_1.default)(sourceChild);
                if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "variable") {
                    var _a = (0, internal_1.getVariableProps)(sourceChild.props), variableName = _a.variableName, variableValue = _a.variableValue, variableOptions = _a.variableOptions;
                    if (typeof variables[variableName] === 'undefined') {
                        variables[variableName] = variableValue;
                    }
                    variablesOptions[variableName] = __assign(__assign({}, variablesOptions[variableName]), variableOptions);
                }
                else {
                    return true;
                }
            }
        });
        var findMatchingSourceElement_1 = function (targetElement) {
            return sourceElements_1.find(function (sourceChild) {
                var _a, _b;
                var generaltranslation = (0, getGTProp_1.default)(sourceChild);
                if (typeof (generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.id) !== 'undefined') {
                    var sourceID = generaltranslation.id;
                    var targetID = (_b = (_a = targetElement === null || targetElement === void 0 ? void 0 : targetElement.props) === null || _a === void 0 ? void 0 : _a['data-_gt']) === null || _b === void 0 ? void 0 : _b.id;
                    return sourceID === targetID;
                }
                return false;
            });
        };
        return target.map(function (targetChild, index) {
            if (typeof targetChild === 'string')
                return (0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: targetChild }, "string_".concat(index));
            if ((0, internal_1.isVariableObject)(targetChild)) {
                return ((0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: (0, renderVariable_1.default)({
                        variableType: targetChild.variable || "variable",
                        variableName: targetChild.key,
                        variableValue: variables[targetChild.key],
                        variableOptions: variablesOptions[targetChild.key]
                    }) }, "var_".concat(index)));
            }
            var matchingSourceElement = findMatchingSourceElement_1(targetChild);
            if (matchingSourceElement)
                return (0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: renderTranslatedElement({
                        sourceElement: matchingSourceElement,
                        targetElement: targetChild,
                        variables: variables,
                        variablesOptions: variablesOptions,
                        locales: locales
                    }) }, "element_".concat(index));
        });
    }
    if (target && typeof target === 'object' && !Array.isArray(target)) {
        var targetType = (0, internal_1.isVariableObject)(target) ? "variable" : "element";
        if (react_1.default.isValidElement(source)) {
            if (targetType === "element") {
                return renderTranslatedElement({
                    sourceElement: source, targetElement: target,
                    variables: variables,
                    variablesOptions: variablesOptions,
                    locales: locales
                });
            }
            var generaltranslation = (0, getGTProp_1.default)(source);
            if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "variable") {
                var _e = (0, internal_1.getVariableProps)(source.props), variableName = _e.variableName, variableValue = _e.variableValue, variableOptions = _e.variableOptions;
                if (typeof variables[variableName] === 'undefined') {
                    variables[variableName] = variableValue;
                }
                variablesOptions[variableName] = __assign(__assign({}, variablesOptions[variableName]), variableOptions);
            }
        }
        if (targetType === "variable") {
            var targetVariable = target;
            return (0, renderVariable_1.default)({
                variableType: targetVariable.variable || "variable",
                variableName: targetVariable.key,
                variableValue: variables[targetVariable.key],
                variableOptions: variablesOptions[targetVariable.key]
            });
        }
    }
    return source;
}
//# sourceMappingURL=renderTranslatedChildren.js.map