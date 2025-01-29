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
exports.default = writeChildrenAsObjects;
var getVariableName_1 = __importDefault(require("../variables/getVariableName"));
var utils_1 = require("../utils/utils");
/**
 * Gets the tag name of a React element.
 * @param {ReactElement} child - The React element.
 * @returns {string} - The tag name of the React element.
 */
var getTagName = function (child) {
    var _a;
    if (!child)
        return "";
    var type = child.type, props = child.props;
    if (type && typeof type === "function") {
        if ("displayName" in type &&
            typeof type.displayName === "string" &&
            type.displayName)
            return type.displayName;
        if ("name" in type && typeof type.name === "string" && type.name)
            return type.name;
    }
    if (type && typeof type === "string")
        return type;
    if (props.href)
        return "a";
    if ((_a = props["data-_gt"]) === null || _a === void 0 ? void 0 : _a.id)
        return "C".concat(props["data-_gt"].id);
    return "function";
};
var handleSingleChildElement = function (child) {
    var type = child.type, props = child.props;
    var objectElement = {
        type: getTagName(child),
        props: {},
    };
    if (props["data-_gt"]) {
        var generaltranslation = props["data-_gt"];
        var newGTProp = __assign({}, generaltranslation);
        var transformation = generaltranslation.transformation;
        if (transformation === "variable") {
            var variableType = generaltranslation.variableType || "variable";
            var variableName = (0, getVariableName_1.default)(props, variableType);
            return {
                variable: variableType,
                key: variableName,
                id: generaltranslation.id,
            };
        }
        if (transformation === "plural" && generaltranslation.branches) {
            objectElement.type = "Plural";
            var newBranches_1 = {};
            Object.entries(generaltranslation.branches).forEach(function (_a) {
                var key = _a[0], value = _a[1];
                newBranches_1[key] = writeChildrenAsObjects(value);
            });
            newGTProp = __assign(__assign({}, newGTProp), { branches: newBranches_1 });
        }
        if (transformation === "branch" && generaltranslation.branches) {
            objectElement.type = "Branch";
            var newBranches_2 = {};
            Object.entries(generaltranslation.branches).forEach(function (_a) {
                var key = _a[0], value = _a[1];
                newBranches_2[key] = writeChildrenAsObjects(value);
            });
            newGTProp = __assign(__assign({}, newGTProp), { branches: newBranches_2 });
        }
        objectElement.props["data-_gt"] = newGTProp;
    }
    if (props.children) {
        objectElement.props.children = writeChildrenAsObjects(props.children);
    }
    return objectElement;
};
var handleSingleChild = function (child) {
    if ((0, utils_1.isValidTaggedElement)(child)) {
        return handleSingleChildElement(child);
    }
    if (typeof child === "number")
        return child.toString();
    return child;
};
/**
 * Transforms children elements into objects, processing each child recursively if needed.
 * @param {Children} children - The children to process.
 * @returns {object} The processed children as objects.
 */
function writeChildrenAsObjects(children) {
    return Array.isArray(children)
        ? children.map(handleSingleChild)
        : handleSingleChild(children);
}
//# sourceMappingURL=writeChildrenAsObjects.js.map