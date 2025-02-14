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
import React, { isValidElement } from "react";
import { isAcceptedPluralForm } from "generaltranslation/internal";
import { createNestedDataGTError, createNestedTError, } from "../messages/createMessages";
export default function addGTIdentifier(children, startingIndex = 0) {
    // Object to keep track of the current index for GT IDs
    let index = startingIndex;
    /**
     * Function to create a GTProp object for a ReactElement
     * @param child - The ReactElement for which the GTProp is created
     * @returns - The GTProp object
     */
    const createGTProp = (child) => {
        const { type, props } = child;
        index += 1;
        let result = { id: index };
        let transformation;
        try {
            transformation =
                typeof type === "function" ? type.gtTransformation || "" : "";
        }
        catch (error) {
            transformation = "";
        }
        if (transformation) {
            const transformationParts = transformation.split("-");
            if (transformationParts[0] === "translate") {
                throw new Error(createNestedTError(child));
            }
            if (transformationParts[0] === "variable") {
                result.variableType = (transformationParts === null || transformationParts === void 0 ? void 0 : transformationParts[1]) || "variable";
            }
            if (transformationParts[0] === "plural") {
                const pluralBranches = Object.entries(props).reduce((acc, [branchName, branch]) => {
                    if (isAcceptedPluralForm(branchName)) {
                        acc[branchName] = addGTIdentifier(branch, index);
                    }
                    return acc;
                }, {});
                if (Object.keys(pluralBranches).length)
                    result.branches = pluralBranches;
            }
            if (transformationParts[0] === "branch") {
                const { children, branch } = props, branches = __rest(props, ["children", "branch"]);
                const resultBranches = Object.entries(branches).reduce((acc, [branchName, branch]) => {
                    acc[branchName] = addGTIdentifier(branch, index);
                    return acc;
                }, {});
                if (Object.keys(resultBranches).length)
                    result.branches = resultBranches;
            }
            result.transformation = transformationParts[0];
        }
        return result;
    };
    function handleSingleChildElement(child) {
        const { props } = child;
        if (props["data-_gt"])
            throw new Error(createNestedDataGTError(child));
        // Create new props for the element, including the GT identifier and a key
        let generaltranslation = createGTProp(child);
        let newProps = Object.assign(Object.assign({}, props), { "data-_gt": generaltranslation });
        if (props.children && !generaltranslation.variableType) {
            newProps.children = handleChildren(props.children);
        }
        if (child.type === React.Fragment) {
            const fragment = (_jsx("span", Object.assign({ style: { all: "unset", display: "contents" } }, newProps)));
            return fragment;
        }
        return React.cloneElement(child, newProps);
    }
    function handleSingleChild(child) {
        if (isValidElement(child)) {
            return handleSingleChildElement(child);
        }
        return child;
    }
    function handleChildren(children) {
        if (Array.isArray(children)) {
            return React.Children.map(children, handleSingleChild);
        }
        else {
            return handleSingleChild(children);
        }
    }
    return handleChildren(children);
}
