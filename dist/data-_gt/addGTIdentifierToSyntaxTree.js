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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = addGTIdentifierToSyntaxTree;
const internal_1 = require("gt-react/internal");
const internal_2 = require("generaltranslation/internal");
// recreates addGTIdentifier and writeChildrenAsObjects
function addGTIdentifierToSyntaxTree(tree, startingIndex = 0) {
    // Object to keep track of the current index for GT IDs
    let indexObject = { index: startingIndex };
    const handleSingleChild = (child) => {
        if (child && typeof child === 'object') {
            const { type, props } = child;
            indexObject.index += 1;
            let generaltranslation = { id: indexObject.index };
            if (type === "Var") {
                return { variable: "variable", key: (0, internal_1.getVariableName)(props, "variable") };
            }
            else if (type === "Num") {
                return { variable: "number", key: (0, internal_1.getVariableName)(props, "number") };
            }
            else if (type === "Currency") {
                return { variable: "currency", key: (0, internal_1.getVariableName)(props, "currency") };
            }
            else if (type === "DateTime") {
                return { variable: "datetime", key: (0, internal_1.getVariableName)(props, "datetime") };
            }
            if (type === "Plural") {
                generaltranslation.transformation = "plural";
                const pluralBranches = Object.entries(props).reduce((acc, [branchName, branch]) => {
                    if ((0, internal_2.isAcceptedPluralForm)(branchName)) {
                        acc[branchName] = addGTIdentifierToSyntaxTree(branch, indexObject.index);
                    }
                    return acc;
                }, {});
                if (Object.keys(pluralBranches).length)
                    generaltranslation.branches = pluralBranches;
            }
            else if (type === "Branch") {
                generaltranslation.transformation = "branch";
                const { children, branch } = props, branches = __rest(props, ["children", "branch"]);
                const resultBranches = Object.entries(branches).reduce((acc, [branchName, branch]) => {
                    acc[branchName] = addGTIdentifierToSyntaxTree(branch, indexObject.index);
                    return acc;
                }, {});
                if (Object.keys(resultBranches).length)
                    generaltranslation.branches = resultBranches;
            }
            return {
                type: type || `C${generaltranslation.id}`,
                props: Object.assign({ 'data-_gt': generaltranslation }, (typeof props.children !== 'undefined' && { children: handleChildren(props.children) }))
            };
        }
        return child.toString();
    };
    const handleChildren = (children) => {
        return Array.isArray(children) ? children.map(handleSingleChild) : handleSingleChild(children);
    };
    return handleChildren(tree);
}
