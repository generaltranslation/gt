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
import React from 'react';
import getGTProp from '../helpers/getGTProp';
import getVariableProps from '../../variables/_getVariableProps';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { baseVariablePrefix, getFallbackVariableName, } from '../../variables/getVariableName';
import getPluralBranch from '../../branches/plurals/getPluralBranch';
export default function renderDefaultChildren({ children, variables = {}, variablesOptions = {}, defaultLocale = libraryDefaultLocale, renderVariable, }) {
    const handleSingleChildElement = (child) => {
        const generaltranslation = getGTProp(child);
        if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === 'variable') {
            let { variableName, variableType, variableValue, variableOptions } = getVariableProps(child.props);
            variableValue = (() => {
                if (typeof variables[variableName] !== 'undefined') {
                    return variables[variableName];
                }
                if (typeof variableValue !== 'undefined')
                    return variableValue;
                if (variableName.startsWith(baseVariablePrefix)) {
                    // pain point: somewhat breakable logic
                    const fallbackVariableName = getFallbackVariableName(variableType);
                    if (typeof variables[fallbackVariableName] !== 'undefined') {
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
        if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === 'plural') {
            const n = typeof variables.n === 'number'
                ? variables.n
                : typeof child.props.n === 'number'
                    ? child.props.n
                    : child.props['data-_gt-n'];
            if (typeof n === 'number' && typeof variables.n === 'undefined')
                variables.n = n;
            const branches = generaltranslation.branches || {};
            return handleChildren(getPluralBranch(n, [defaultLocale], branches) || child.props.children);
        }
        if ((generaltranslation === null || generaltranslation === void 0 ? void 0 : generaltranslation.transformation) === 'branch') {
            let _a = child.props, { children, name, branch, 'data-_gt': _gt } = _a, branches = __rest(_a, ["children", "name", "branch", 'data-_gt']);
            name = name || child.props['data-_gt-name'] || 'branch';
            branch = variables[name] || branch || child.props['data-_gt-branch-name'];
            branches = generaltranslation.branches || {};
            return handleChildren(branches[branch] !== undefined ? branches[branch] : children);
        }
        if (child.props.children) {
            return React.cloneElement(child, Object.assign(Object.assign({}, child.props), { 'data-_gt': undefined, children: handleChildren(child.props.children) }));
        }
        return React.cloneElement(child, Object.assign(Object.assign({}, child.props), { 'data-_gt': undefined }));
    };
    const handleSingleChild = (child) => {
        if (React.isValidElement(child)) {
            return handleSingleChildElement(child);
        }
        return child;
    };
    const handleChildren = (children) => {
        return Array.isArray(children)
            ? React.Children.map(children, handleSingleChild)
            : handleSingleChild(children);
    };
    return handleChildren(children);
}
