"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = renderTranslatedChildren;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importDefault(require("react"));
const isVariableObject_1 = __importDefault(require("../helpers/isVariableObject"));
const getGTProp_1 = __importDefault(require("../helpers/getGTProp"));
const _getVariableProps_1 = __importDefault(require("../../variables/_getVariableProps"));
const internal_1 = require("../../internal");
const renderDefaultChildren_1 = __importDefault(require("./renderDefaultChildren"));
const internal_2 = require("generaltranslation/internal");
const getVariableName_1 = require("../../variables/getVariableName");
function renderTranslatedElement({ sourceElement, targetElement, variables = {}, variablesOptions = {}, locales = [internal_2.libraryDefaultLocale], renderVariable, }) {
    var _a;
    const { props } = sourceElement;
    const generaltranslation = props["data-_gt"];
    const transformation = generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation["transformation"];
    if (transformation === "plural") {
        const n = typeof variables.n === "number"
            ? variables.n
            : typeof sourceElement.props.n === "number"
                ? sourceElement.props.n
                : sourceElement.props["data-_gt-n"];
        const sourceBranches = generaltranslation.branches || {};
        const sourceBranch = (0, internal_1.getPluralBranch)(n, locales, sourceBranches) ||
            sourceElement.props.children;
        const targetBranches = targetElement.props["data-_gt"].branches || {};
        const targetBranch = (0, internal_1.getPluralBranch)(n, locales, targetBranches) ||
            targetElement.props.children;
        if (typeof n === "number" && typeof variables.n === "undefined")
            variables.n = n;
        return renderTranslatedChildren({
            source: sourceBranch,
            target: targetBranch,
            variables,
            variablesOptions,
            locales,
            renderVariable,
        });
    }
    if (transformation === "branch") {
        let { name, branch, children } = props;
        name = name || sourceElement.props["data-_gt-name"] || "branch";
        branch =
            variables[name] || branch || sourceElement.props["data-_gt-branch-name"];
        const sourceBranch = (generaltranslation.branches || {})[branch] || children;
        const targetBranch = (targetElement.props["data-_gt"].branches || {})[branch] ||
            targetElement.props.children;
        return renderTranslatedChildren({
            source: sourceBranch,
            target: targetBranch,
            variables,
            variablesOptions,
            locales,
            renderVariable,
        });
    }
    if ((props === null || props === void 0 ? void 0 : props.children) && ((_a = targetElement.props) === null || _a === void 0 ? void 0 : _a.children)) {
        return react_1.default.cloneElement(sourceElement, Object.assign(Object.assign({}, props), { "data-_gt": undefined, children: renderTranslatedChildren({
                source: props.children,
                target: targetElement.props.children,
                variables,
                variablesOptions,
                locales,
                renderVariable,
            }) }));
    }
    return (0, renderDefaultChildren_1.default)({
        children: sourceElement,
        variables,
        variablesOptions,
        defaultLocale: locales[0],
        renderVariable,
    });
}
function renderTranslatedChildren({ source, target, variables = {}, variablesOptions = {}, locales = [internal_2.libraryDefaultLocale], renderVariable, }) {
    // Most straightforward case, return a valid React node
    if ((target === null || typeof target === "undefined") && source)
        return (0, renderDefaultChildren_1.default)({
            children: source,
            variables,
            variablesOptions,
            defaultLocale: locales[0],
            renderVariable,
        });
    if (typeof target === "string")
        return target;
    // Convert source to an array in case target has multiple children where source only has one
    if (Array.isArray(target) && !Array.isArray(source) && source)
        source = [source];
    if (Array.isArray(source) && Array.isArray(target)) {
        const sourceElements = source.filter((sourceChild) => {
            if (react_1.default.isValidElement(sourceChild)) {
                const generaltranslation = (0, getGTProp_1.default)(sourceChild);
                (0, _getVariableProps_1.default)(sourceChild.props);
                if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "variable") {
                    let { variableName, variableValue, variableOptions, variableType } = (0, _getVariableProps_1.default)(sourceChild.props);
                    if (typeof variables[variableName] === "undefined") {
                        variables[variableName] = variableValue;
                    }
                    const fallback = (0, getVariableName_1.getFallbackVariableName)(variableType);
                    if (typeof variables[fallback] === "undefined")
                        variables[fallback] = variableValue;
                    variablesOptions[variableName] = Object.assign(Object.assign({}, variablesOptions[variableName]), variableOptions);
                }
                else {
                    return true;
                }
            }
        });
        const findMatchingSourceElement = (targetElement) => {
            return sourceElements.find((sourceChild) => {
                var _a, _b;
                const generaltranslation = (0, getGTProp_1.default)(sourceChild);
                if (typeof (generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.id) !== "undefined") {
                    const sourceId = generaltranslation.id;
                    const targetId = (_b = (_a = targetElement === null || targetElement === void 0 ? void 0 : targetElement.props) === null || _a === void 0 ? void 0 : _a["data-_gt"]) === null || _b === void 0 ? void 0 : _b.id;
                    return sourceId === targetId;
                }
                return false;
            });
        };
        return target.map((targetChild, index) => {
            if (typeof targetChild === "string")
                return ((0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: targetChild }, `string_${index}`));
            if ((0, isVariableObject_1.default)(targetChild)) {
                const variableName = targetChild.key;
                const variableType = targetChild.variable || "variable";
                const variableValue = (() => {
                    if (typeof variables[targetChild.key] !== "undefined")
                        return variables[targetChild.key];
                    if (variableName.startsWith(getVariableName_1.baseVariablePrefix)) {
                        // pain point: somewhat breakable logic
                        const fallbackVariableName = (0, getVariableName_1.getFallbackVariableName)(variableType);
                        if (typeof variables[fallbackVariableName] !== "undefined") {
                            return variables[fallbackVariableName];
                        }
                    }
                    return undefined;
                })();
                return ((0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: renderVariable({
                        variableType,
                        variableName,
                        variableValue,
                        variableOptions: variablesOptions[targetChild.key],
                        locales,
                    }) }, `var_${index}`));
            }
            const matchingSourceElement = findMatchingSourceElement(targetChild);
            if (matchingSourceElement)
                return ((0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: renderTranslatedElement({
                        sourceElement: matchingSourceElement,
                        targetElement: targetChild,
                        variables,
                        variablesOptions,
                        locales,
                        renderVariable,
                    }) }, `element_${index}`));
        });
    }
    if (target && typeof target === "object" && !Array.isArray(target)) {
        const targetType = (0, isVariableObject_1.default)(target)
            ? "variable"
            : "element";
        if (react_1.default.isValidElement(source)) {
            if (targetType === "element") {
                return renderTranslatedElement({
                    sourceElement: source,
                    targetElement: target,
                    variables,
                    variablesOptions,
                    locales,
                    renderVariable,
                });
            }
            const generaltranslation = (0, getGTProp_1.default)(source);
            if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === "variable") {
                let { variableName, variableValue, variableOptions } = (0, _getVariableProps_1.default)(source.props);
                if (typeof variables[variableName] === "undefined") {
                    variables[variableName] = variableValue;
                }
                variablesOptions[variableName] = Object.assign(Object.assign({}, variablesOptions[variableName]), variableOptions);
            }
        }
        if (targetType === "variable") {
            const targetVariable = target;
            const variableName = targetVariable.key;
            const variableType = targetVariable.variable || "variable";
            const variableValue = (() => {
                if (typeof variables[targetVariable.key] !== "undefined")
                    return variables[targetVariable.key];
                if (variableName.startsWith(getVariableName_1.baseVariablePrefix)) {
                    // pain point: somewhat breakable logic
                    const fallbackVariableName = (0, getVariableName_1.getFallbackVariableName)(variableType);
                    if (typeof variables[fallbackVariableName] !== "undefined") {
                        return variables[fallbackVariableName];
                    }
                }
                return undefined;
            })();
            return renderVariable({
                variableType,
                variableName,
                variableValue,
                variableOptions: variablesOptions[targetVariable.key] || {},
                locales,
            });
        }
    }
    return (0, renderDefaultChildren_1.default)({
        children: source,
        variables,
        variablesOptions,
        defaultLocale: locales[0],
        renderVariable,
    });
}
//# sourceMappingURL=renderTranslatedChildren.js.map