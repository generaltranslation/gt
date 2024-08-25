'use client';
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
import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import isValidReactNode from "../../primitives/rendering/isValidReactNode";
import defaultVariableNames from "../../primitives/variables/defaultVariableNames";
import ClientNum from "../variables/ClientNum";
import ClientDateTime from "../variables/ClientDateTime";
import ClientCurrency from "../variables/ClientCurrency";
import ClientVar from "../variables/ClientVar";
import getPluralBranch from "../../primitives/variables/getPluralBranch";
import isTargetVariable from "../../primitives/variables/isTargetVariable";
const renderClientElement = (_a) => {
    var _b;
    var { sourceElement, targetElement } = _a, metadata = __rest(_a, ["sourceElement", "targetElement"]);
    const { props } = sourceElement;
    if (props.children) {
        let { 'data-generaltranslation': generaltranslation } = props;
        const targetProps = (targetElement === null || targetElement === void 0 ? void 0 : targetElement.props) || null;
        const targetChildren = targetProps === null || targetProps === void 0 ? void 0 : targetProps.children;
        const targetBranches = (_b = targetProps === null || targetProps === void 0 ? void 0 : targetProps['data-generaltranslation']) === null || _b === void 0 ? void 0 : _b.branches;
        // If an alternative branch (from a transformation) is necessary
        if (generaltranslation && generaltranslation.transformation) {
            const transformation = generaltranslation.transformation;
            // handle number variable branching
            if (transformation === "plural") {
                if (!metadata.variables || typeof metadata.variables.n !== 'number') {
                    throw new Error(`Plural with id ${metadata.id} needs n value, e.g. t("${metadata.id}", { n: 1 })`);
                }
                const n = metadata.variables.n;
                const branches = props['data-unrendered-branches'] || generaltranslation.branches;
                const sourceBranch = getPluralBranch(n, [metadata.locale, metadata.defaultLocale], branches) || generaltranslation.defaultChildren;
                const targetBranch = getPluralBranch(n, [metadata.locale, metadata.defaultLocale], targetBranches) || targetChildren;
                const children = renderClientChildren(Object.assign({ source: sourceBranch, target: targetBranch, variables: Object.assign(Object.assign({}, metadata.variables), { n: n }) }, metadata));
                return React.createElement('span', Object.assign(Object.assign({}, metadata.renderAttributes), { children: children }));
            }
        }
        // otherwise, just clone the element
        return React.cloneElement(sourceElement, Object.assign(Object.assign(Object.assign({}, props), metadata.renderAttributes), { children: renderClientChildren(Object.assign({ source: props.children, target: targetChildren }, metadata)) }));
    }
    return React.cloneElement(sourceElement, Object.assign(Object.assign({}, metadata.renderAttributes), sourceElement === null || sourceElement === void 0 ? void 0 : sourceElement.props));
};
/**
 * Renders children elements based on the provided source and target.
 * Handles transformations and branching for number and value variables.
 *
 * @param {Source} source - The source elements to be rendered.
 * @param {Target} [target] - The target elements that may alter the rendering of the source.
 * @param {Record<string, Source>} [variables] - An optional set of variables for transformations and branching.
 *
 * @returns {ReactNode} The rendered children elements.
 */
export default function renderClientChildren(_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
    var { source, target } = _a, metadata = __rest(_a, ["source", "target"]);
    // Most straightforward case, return a valid React node
    if ((target === null || typeof target === 'undefined') && isValidReactNode(source))
        return source;
    if (typeof target !== null && typeof target !== 'undefined' && isValidReactNode(target))
        return target;
    // If target and source are both arrays of children
    if (Array.isArray(source) && Array.isArray(target)) {
        // Filter for variables and valid source children
        let validSourceElements = [];
        for (const sourceChild of source) {
            if (React.isValidElement(sourceChild)) {
                const { props } = sourceChild;
                if (((_b = props === null || props === void 0 ? void 0 : props['data-generaltranslation']) === null || _b === void 0 ? void 0 : _b.transformation) === "variable") {
                    const variableName = sourceChild.props.name || defaultVariableNames[(_d = (_c = sourceChild === null || sourceChild === void 0 ? void 0 : sourceChild.props) === null || _c === void 0 ? void 0 : _c['data-generaltranslation']) === null || _d === void 0 ? void 0 : _d.variableType];
                    const variableValue = sourceChild.props.defaultValue || sourceChild.props.children;
                    if (variableName && variableValue && typeof ((_e = metadata === null || metadata === void 0 ? void 0 : metadata.variables) === null || _e === void 0 ? void 0 : _e[variableName]) === 'undefined') {
                        metadata.variables = Object.assign(Object.assign({}, metadata.variables), { [variableName]: variableValue });
                    }
                    const variableType = ((_g = (_f = sourceChild === null || sourceChild === void 0 ? void 0 : sourceChild.props) === null || _f === void 0 ? void 0 : _f['data-generaltranslation']) === null || _g === void 0 ? void 0 : _g.variableType) || "variable";
                    if (variableType === "number" || variableType === "currency" || variableType === "date") {
                        const variableOptions = (_h = sourceChild === null || sourceChild === void 0 ? void 0 : sourceChild.props) === null || _h === void 0 ? void 0 : _h.options;
                        if (variableOptions)
                            metadata.variableOptions = Object.assign(Object.assign({}, metadata.variableOptions), { [variableName]: Object.assign({}, variableOptions) });
                    }
                    if (variableType === "currency") {
                        const variableCurrency = (_j = sourceChild === null || sourceChild === void 0 ? void 0 : sourceChild.props) === null || _j === void 0 ? void 0 : _j.currency;
                        if (variableCurrency)
                            metadata.variableOptions = Object.assign(Object.assign({}, metadata.variableOptions), { [variableName]: Object.assign({ currency: variableCurrency }, (_k = metadata.variableOptions) === null || _k === void 0 ? void 0 : _k[variableName]) });
                    }
                }
                else {
                    validSourceElements.push(sourceChild);
                }
            }
        }
        // Find matching source elements based on ID
        const findMatchingSource = (targetElement) => {
            return validSourceElements.find(sourceChild => {
                var _a, _b, _c;
                const { props } = sourceChild;
                if (typeof ((_a = props === null || props === void 0 ? void 0 : props['data-generaltranslation']) === null || _a === void 0 ? void 0 : _a.id) !== 'undefined') {
                    const sourceID = props['data-generaltranslation'].id;
                    const targetID = (_c = (_b = targetElement === null || targetElement === void 0 ? void 0 : targetElement.props) === null || _b === void 0 ? void 0 : _b['data-generaltranslation']) === null || _c === void 0 ? void 0 : _c.id;
                    return sourceID === targetID;
                }
                return false;
            });
        };
        // Return targets
        return target.map((targetChild, index) => {
            var _a, _b, _c, _d, _e;
            // Most straightforward case, return a valid React node
            if (isValidReactNode(targetChild)) {
                return _jsx(React.Fragment, { children: targetChild }, `string_${index}`);
            }
            // if target is a variable
            if (isTargetVariable(targetChild)) {
                const key = targetChild.key;
                let value;
                if (metadata.variables && (typeof metadata.variables[key] !== null && typeof metadata.variables[key] !== 'undefined')) {
                    value = metadata.variables[key];
                }
                if (targetChild.variable === "number") {
                    return _jsx(ClientNum, { defaultValue: value, name: key, options: Object.assign({}, (_a = metadata === null || metadata === void 0 ? void 0 : metadata.variableOptions) === null || _a === void 0 ? void 0 : _a[key]) }, `num_${index}`);
                }
                if (targetChild.variable === "date") {
                    return _jsx(ClientDateTime, { defaultValue: value, name: key, options: Object.assign({}, (_b = metadata === null || metadata === void 0 ? void 0 : metadata.variableOptions) === null || _b === void 0 ? void 0 : _b[key]) }, `date_${index}`);
                }
                if (targetChild.variable === "currency") {
                    return _jsx(ClientCurrency, { defaultValue: value, name: key, currency: ((_d = (_c = metadata === null || metadata === void 0 ? void 0 : metadata.variableOptions) === null || _c === void 0 ? void 0 : _c[key]) === null || _d === void 0 ? void 0 : _d.currency) || undefined, options: Object.assign({}, (_e = metadata === null || metadata === void 0 ? void 0 : metadata.variableOptions) === null || _e === void 0 ? void 0 : _e[key]) }, `currency_${index}`);
                }
                return _jsx(ClientVar, { defaultValue: isValidReactNode(value) ? value : undefined, name: key }, `var_${index}`);
            }
            // If target is a normal ReactElement
            const matchingSource = findMatchingSource(targetChild);
            if (React.isValidElement(matchingSource)) {
                return _jsx(React.Fragment, { children: renderClientElement(Object.assign({ sourceElement: matchingSource, targetElement: targetChild }, metadata)) }, `element_${index}`);
            }
        });
    }
    // Target is a single object, could be a component or a variable
    if (typeof target === 'object' && !Array.isArray(target)) {
        const sourceIsValidElement = React.isValidElement(source);
        if (sourceIsValidElement) {
            const { props } = source;
            if (((_l = props === null || props === void 0 ? void 0 : props['data-generaltranslation']) === null || _l === void 0 ? void 0 : _l.transformation) === "variable") {
                const variableName = source.props.name || defaultVariableNames[(_o = (_m = source === null || source === void 0 ? void 0 : source.props) === null || _m === void 0 ? void 0 : _m['data-generaltranslation']) === null || _o === void 0 ? void 0 : _o.variableType];
                const variableValue = source.props.defaultValue || source.props.children;
                if (variableName && variableValue && typeof ((_p = metadata === null || metadata === void 0 ? void 0 : metadata.variables) === null || _p === void 0 ? void 0 : _p[variableName]) === 'undefined') {
                    metadata.variables = Object.assign(Object.assign({}, metadata.variables), { [variableName]: variableValue });
                }
                const variableType = ((_r = (_q = source === null || source === void 0 ? void 0 : source.props) === null || _q === void 0 ? void 0 : _q['data-generaltranslation']) === null || _r === void 0 ? void 0 : _r.variableType) || "variable";
                if (variableType === "number" || variableType === "currency" || variableType === "date") {
                    const variableOptions = (_s = source === null || source === void 0 ? void 0 : source.props) === null || _s === void 0 ? void 0 : _s.options;
                    if (variableOptions)
                        metadata.variableOptions = Object.assign(Object.assign({}, metadata.variableOptions), { [variableName]: Object.assign({}, variableOptions) });
                }
                if (variableType === "currency") {
                    const variableCurrency = (_t = source === null || source === void 0 ? void 0 : source.props) === null || _t === void 0 ? void 0 : _t.currency;
                    if (variableCurrency)
                        metadata.variableOptions = Object.assign(Object.assign({}, metadata.variableOptions), { [variableName]: Object.assign({ currency: variableCurrency }, (_u = metadata.variableOptions) === null || _u === void 0 ? void 0 : _u[variableName]) });
                }
            }
        }
        // if target is a variable
        if (isTargetVariable(target)) {
            const key = target.key;
            let value;
            if (metadata.variables && (typeof metadata.variables[key] !== null && typeof metadata.variables[key] !== 'undefined')) {
                value = metadata.variables[key];
            }
            if (target.variable === "number") {
                return _jsx(ClientNum, { defaultValue: value, name: key, options: Object.assign({}, (_v = metadata === null || metadata === void 0 ? void 0 : metadata.variableOptions) === null || _v === void 0 ? void 0 : _v[key]) });
            }
            if (target.variable === "date") {
                return _jsx(ClientDateTime, { defaultValue: value, name: key, options: Object.assign({}, (_w = metadata === null || metadata === void 0 ? void 0 : metadata.variableOptions) === null || _w === void 0 ? void 0 : _w[key]) });
            }
            if (target.variable === "currency") {
                return _jsx(ClientCurrency, { defaultValue: value, name: key, currency: ((_y = (_x = metadata === null || metadata === void 0 ? void 0 : metadata.variableOptions) === null || _x === void 0 ? void 0 : _x[key]) === null || _y === void 0 ? void 0 : _y.currency) || undefined, options: Object.assign({}, (_z = metadata === null || metadata === void 0 ? void 0 : metadata.variableOptions) === null || _z === void 0 ? void 0 : _z[key]) });
            }
            return _jsx(ClientVar, { defaultValue: isValidReactNode(value) ? value : undefined, name: key });
        }
        // if component
        if (sourceIsValidElement) {
            return renderClientElement(Object.assign({ sourceElement: source, targetElement: target }, metadata));
        }
    }
}
//# sourceMappingURL=renderClientChildren.js.map