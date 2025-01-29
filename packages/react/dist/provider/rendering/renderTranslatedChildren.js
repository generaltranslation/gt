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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = renderTranslatedChildren;
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = __importDefault(require("react"));
var isVariableObject_1 = __importDefault(require("../helpers/isVariableObject"));
var getGTProp_1 = __importDefault(require("../helpers/getGTProp"));
var _getVariableProps_1 = __importDefault(require("../../variables/_getVariableProps"));
var internal_1 = require("../../internal");
var renderDefaultChildren_1 = __importDefault(require("./renderDefaultChildren"));
var internal_2 = require("generaltranslation/internal");
var getVariableName_1 = require("../../variables/getVariableName");
function renderTranslatedElement(_a) {
    var _b;
    var sourceElement = _a.sourceElement, targetElement = _a.targetElement, _c = _a.variables, variables = _c === void 0 ? {} : _c, _d = _a.variablesOptions, variablesOptions = _d === void 0 ? {} : _d, _e = _a.locales, locales = _e === void 0 ? [internal_2.libraryDefaultLocale] : _e, renderVariable = _a.renderVariable;
    var props = sourceElement.props;
    var generaltranslation = props["data-_gt"];
    var transformation = generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation["transformation"];
    if (transformation === "plural") {
        var n = typeof variables.n === "number"
            ? variables.n
            : typeof sourceElement.props.n === "number"
                ? sourceElement.props.n
                : sourceElement.props["data-_gt-n"];
        var sourceBranches = generaltranslation.branches || {};
        var sourceBranch = (0, internal_1.getPluralBranch)(n, locales, sourceBranches) ||
            sourceElement.props.children;
        var targetBranches = targetElement.props["data-_gt"].branches || {};
        var targetBranch = (0, internal_1.getPluralBranch)(n, locales, targetBranches) ||
            targetElement.props.children;
        if (typeof n === "number" && typeof variables.n === "undefined")
            variables.n = n;
        return renderTranslatedChildren({
            source: sourceBranch,
            target: targetBranch,
            variables: variables,
            variablesOptions: variablesOptions,
            locales: locales,
            renderVariable: renderVariable,
        });
    }
    if (transformation === "branch") {
        var name_1 = props.name, branch = props.branch, children = props.children;
        name_1 = name_1 || sourceElement.props["data-_gt-name"] || "branch";
        branch =
            variables[name_1] || branch || sourceElement.props["data-_gt-branch-name"];
        var sourceBranch = (generaltranslation.branches || {})[branch] || children;
        var targetBranch = (targetElement.props["data-_gt"].branches || {})[branch] ||
            targetElement.props.children;
        return renderTranslatedChildren({
            source: sourceBranch,
            target: targetBranch,
            variables: variables,
            variablesOptions: variablesOptions,
            locales: locales,
            renderVariable: renderVariable,
        });
    }
    if ((props === null || props === void 0 ? void 0 : props.children) && ((_b = targetElement.props) === null || _b === void 0 ? void 0 : _b.children)) {
        return react_1.default.cloneElement(sourceElement, __assign(__assign({}, props), { "data-_gt": undefined, children: renderTranslatedChildren({
                source: props.children,
                target: targetElement.props.children,
                variables: variables,
                variablesOptions: variablesOptions,
                locales: locales,
                renderVariable: renderVariable,
            }) }));
    }
    return (0, renderDefaultChildren_1.default)({
        children: sourceElement,
        variables: variables,
        variablesOptions: variablesOptions,
        defaultLocale: locales[0],
        renderVariable: renderVariable,
    });
}
function renderTranslatedChildren(_a) {
    var source = _a.source, target = _a.target, _b = _a.variables, variables = _b === void 0 ? {} : _b, _c = _a.variablesOptions, variablesOptions = _c === void 0 ? {} : _c, _d = _a.locales, locales = _d === void 0 ? [internal_2.libraryDefaultLocale] : _d, renderVariable = _a.renderVariable;
    // Most straightforward case, return a valid React node
    if ((target === null || typeof target === "undefined") && source)
        return (0, renderDefaultChildren_1.default)({
            children: source,
            variables: variables,
            variablesOptions: variablesOptions,
            defaultLocale: locales[0],
            renderVariable: renderVariable,
        });
    if (typeof target === "string")
        return target;
    // Convert source to an array in case target has multiple children where source only has one
    if (Array.isArray(target) && !Array.isArray(source) && source)
        source = [source];
    if (Array.isArray(source) && Array.isArray(target)) {
        var sourceElements_1 = source.filter(function (sourceChild) {
            if (react_1.default.isValidElement(sourceChild)) {
                var generaltranslation = (0, getGTProp_1.default)(sourceChild);
                (0, _getVariableProps_1.default)(sourceChild.props);
                if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "variable") {
                    var _a = (0, _getVariableProps_1.default)(sourceChild.props), variableName = _a.variableName, variableValue = _a.variableValue, variableOptions = _a.variableOptions, variableType = _a.variableType;
                    if (typeof variables[variableName] === "undefined") {
                        variables[variableName] = variableValue;
                    }
                    var fallback = (0, getVariableName_1.getFallbackVariableName)(variableType);
                    if (typeof variables[fallback] === "undefined")
                        variables[fallback] = variableValue;
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
                if (typeof (generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.id) !== "undefined") {
                    var sourceId = generaltranslation.id;
                    var targetId = (_b = (_a = targetElement === null || targetElement === void 0 ? void 0 : targetElement.props) === null || _a === void 0 ? void 0 : _a["data-_gt"]) === null || _b === void 0 ? void 0 : _b.id;
                    return sourceId === targetId;
                }
                return false;
            });
        };
        return target.map(function (targetChild, index) {
            if (typeof targetChild === "string")
                return ((0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: targetChild }, "string_".concat(index)));
            if ((0, isVariableObject_1.default)(targetChild)) {
                var variableName_1 = targetChild.key;
                var variableType_1 = targetChild.variable || "variable";
                var variableValue = (function () {
                    if (typeof variables[targetChild.key] !== "undefined")
                        return variables[targetChild.key];
                    if (variableName_1.startsWith(getVariableName_1.baseVariablePrefix)) {
                        // pain point: somewhat breakable logic
                        var fallbackVariableName = (0, getVariableName_1.getFallbackVariableName)(variableType_1);
                        if (typeof variables[fallbackVariableName] !== "undefined") {
                            return variables[fallbackVariableName];
                        }
                    }
                    return undefined;
                })();
                return ((0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: renderVariable({
                        variableType: variableType_1,
                        variableName: variableName_1,
                        variableValue: variableValue,
                        variableOptions: variablesOptions[targetChild.key],
                        locales: locales,
                    }) }, "var_".concat(index)));
            }
            var matchingSourceElement = findMatchingSourceElement_1(targetChild);
            if (matchingSourceElement)
                return ((0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: renderTranslatedElement({
                        sourceElement: matchingSourceElement,
                        targetElement: targetChild,
                        variables: variables,
                        variablesOptions: variablesOptions,
                        locales: locales,
                        renderVariable: renderVariable,
                    }) }, "element_".concat(index)));
        });
    }
    if (target && typeof target === "object" && !Array.isArray(target)) {
        var targetType = (0, isVariableObject_1.default)(target)
            ? "variable"
            : "element";
        if (react_1.default.isValidElement(source)) {
            if (targetType === "element") {
                return renderTranslatedElement({
                    sourceElement: source,
                    targetElement: target,
                    variables: variables,
                    variablesOptions: variablesOptions,
                    locales: locales,
                    renderVariable: renderVariable,
                });
            }
            var generaltranslation = (0, getGTProp_1.default)(source);
            if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "variable") {
                var _e = (0, _getVariableProps_1.default)(source.props), variableName = _e.variableName, variableValue = _e.variableValue, variableOptions = _e.variableOptions;
                if (typeof variables[variableName] === "undefined") {
                    variables[variableName] = variableValue;
                }
                variablesOptions[variableName] = __assign(__assign({}, variablesOptions[variableName]), variableOptions);
            }
        }
        if (targetType === "variable") {
            var targetVariable_1 = target;
            var variableName_2 = targetVariable_1.key;
            var variableType_2 = targetVariable_1.variable || "variable";
            var variableValue = (function () {
                if (typeof variables[targetVariable_1.key] !== "undefined")
                    return variables[targetVariable_1.key];
                if (variableName_2.startsWith(getVariableName_1.baseVariablePrefix)) {
                    // pain point: somewhat breakable logic
                    var fallbackVariableName = (0, getVariableName_1.getFallbackVariableName)(variableType_2);
                    if (typeof variables[fallbackVariableName] !== "undefined") {
                        return variables[fallbackVariableName];
                    }
                }
                return undefined;
            })();
            return renderVariable({
                variableType: variableType_2,
                variableName: variableName_2,
                variableValue: variableValue,
                variableOptions: variablesOptions[targetVariable_1.key] || {},
                locales: locales,
            });
        }
    }
    return (0, renderDefaultChildren_1.default)({
        children: source,
        variables: variables,
        variablesOptions: variablesOptions,
        defaultLocale: locales[0],
        renderVariable: renderVariable,
    });
}
//# sourceMappingURL=renderTranslatedChildren.js.map