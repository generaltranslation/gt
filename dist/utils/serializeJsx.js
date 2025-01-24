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
exports.default = serializeJsx;
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = __importStar(require("react"));
var internal_1 = require("generaltranslation/internal");
/**
 * Replaces fragment tags with spans. This is because they get serialized as strings when passed to client as a dictionary entry.
 * @param children
 * @param startingIndex
 * @returns
 */
function serializeJsx(children, startingIndex) {
    if (startingIndex === void 0) { startingIndex = 0; }
    // Object to keep track of the current index for GT IDs
    var index = startingIndex;
    /**
     * Function to create a GTProp object for a ReactElement
     * @param child - The ReactElement for which the GTProp is created
     * @returns - The GTProp object
     */
    var createGTProp = function (child) {
        var type = child.type, props = child.props;
        index += 1;
        var result = { id: index };
        var transformation;
        try {
            transformation = typeof type === 'function' ? (type.gtTransformation || '') : '';
        }
        catch (error) {
            transformation = '';
        }
        if (transformation) {
            var transformationParts = transformation.split('-');
            if (transformationParts[0] === "translate") {
                // throw new Error(createNestedTError(child))
                // console.log
                // TODO: get a better error:
                throw new Error('Nested T error');
            }
            if (transformationParts[0] === "variable") {
                result.variableType = (transformationParts === null || transformationParts === void 0 ? void 0 : transformationParts[1]) || "variable";
            }
            if (transformationParts[0] === "plural") {
                var pluralBranches = Object.entries(props).reduce(function (acc, _a) {
                    var branchName = _a[0], branch = _a[1];
                    if ((0, internal_1.isAcceptedPluralForm)(branchName)) {
                        acc[branchName] = serializeJsx(branch, index);
                    }
                    return acc;
                }, {});
                if (Object.keys(pluralBranches).length)
                    result.branches = pluralBranches;
            }
            if (transformationParts[0] === "branch") {
                var children_1 = props.children, branch = props.branch, branches = __rest(props, ["children", "branch"]);
                var resultBranches = Object.entries(branches).reduce(function (acc, _a) {
                    var branchName = _a[0], branch = _a[1];
                    acc[branchName] = serializeJsx(branch, index);
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
        var props = child.props;
        // if (props['data-_gt']) throw new Error(createNestedDataGTError(child));
        // Create new props for the element, including the GT identifier and a key
        var generaltranslation = createGTProp(child);
        var newProps = __assign({}, props);
        if (props.children && !generaltranslation.variableType) {
            newProps.children = handleChildren(props.children);
        }
        if (child.type === react_1.default.Fragment) {
            var fragment = (0, jsx_runtime_1.jsx)("span", __assign({ style: { all: 'unset', display: 'contents' } }, newProps));
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
;
//# sourceMappingURL=serializeJsx.js.map