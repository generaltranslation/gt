"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.default = addGTIdentifier;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importStar(require("react"));
const internal_1 = require("generaltranslation/internal");
const createMessages_1 = require("../messages/createMessages");
function addGTIdentifier(children, startingIndex = 0) {
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
                throw new Error((0, createMessages_1.createNestedTError)(child));
            }
            if (transformationParts[0] === "variable") {
                result.variableType = (transformationParts === null || transformationParts === void 0 ? void 0 : transformationParts[1]) || "variable";
            }
            if (transformationParts[0] === "plural") {
                const pluralBranches = Object.entries(props).reduce((acc, [branchName, branch]) => {
                    if ((0, internal_1.isAcceptedPluralForm)(branchName)) {
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
            throw new Error((0, createMessages_1.createNestedDataGTError)(child));
        // Create new props for the element, including the GT identifier and a key
        let generaltranslation = createGTProp(child);
        let newProps = Object.assign(Object.assign({}, props), { "data-_gt": generaltranslation });
        if (props.children && !generaltranslation.variableType) {
            newProps.children = handleChildren(props.children);
        }
        if (child.type === react_1.default.Fragment) {
            const fragment = ((0, jsx_runtime_1.jsx)("span", Object.assign({ style: { all: "unset", display: "contents" } }, newProps)));
            return fragment;
        }
        return react_1.default.cloneElement(child, newProps);
    }
    function handleSingleChild(child) {
        if ((0, react_1.isValidElement)(child)) {
            return handleSingleChildElement(child);
        }
        return child;
    }
    function handleChildren(children) {
        if (Array.isArray(children)) {
            return react_1.default.Children.map(children, handleSingleChild);
        }
        else {
            return handleSingleChild(children);
        }
    }
    return handleChildren(children);
}
//# sourceMappingURL=addGTIdentifier.js.map