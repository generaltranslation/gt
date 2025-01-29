"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTranslatedContent = isTranslatedContent;
exports.isValidTaggedElement = isValidTaggedElement;
exports.isEmptyReactFragment = isEmptyReactFragment;
var react_1 = __importDefault(require("react"));
function isTranslatedContent(target) {
    if (typeof target === "string") {
        return true;
    }
    if (!Array.isArray(target)) {
        return false;
    }
    return target.every(function (item) {
        if (typeof item === "string") {
            return true;
        }
        if (typeof item === "object" && item !== null) {
            var hasKey = "key" in item && typeof item.key === "string";
            var hasValidVariable = item.variable === undefined || typeof item.variable === "string";
            return hasKey && hasValidVariable;
        }
        return false;
    });
}
function isValidTaggedElement(target) {
    return react_1.default.isValidElement(target);
}
function isEmptyReactFragment(target) {
    if (react_1.default.isValidElement(target) && target.type === react_1.default.Fragment) {
        var props = target.props;
        return !props.children || react_1.default.Children.count(props.children) === 0;
    }
    return false;
}
//# sourceMappingURL=utils.js.map