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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHtmlElement = isHtmlElement;
exports.isBodyElement = isBodyElement;
exports.hasGTProviderChild = hasGTProviderChild;
exports.addDynamicLangAttribute = addDynamicLangAttribute;
exports.makeParentFunctionAsync = makeParentFunctionAsync;
const t = __importStar(require("@babel/types"));
// Helper function to check if is the <html> fragment
function isHtmlElement(element) {
    return (t.isJSXIdentifier(element.name) &&
        element.name.name.toLowerCase() === 'html');
}
// Helper function to check if is the <body> fragment
function isBodyElement(element) {
    return (t.isJSXIdentifier(element.name) &&
        element.name.name.toLowerCase() === 'body');
}
// Helper function to check if the <body> element has a <GTProvider> child
function hasGTProviderChild(element) {
    return element.children.some((child) => t.isJSXElement(child) &&
        t.isJSXIdentifier(child.openingElement.name) &&
        child.openingElement.name.name === 'GTProvider');
}
function addDynamicLangAttribute(element) {
    // Remove existing lang attribute if present
    const langAttrIndex = element.attributes.findIndex((attr) => t.isJSXAttribute(attr) &&
        t.isJSXIdentifier(attr.name) &&
        attr.name.name === 'lang');
    if (langAttrIndex !== -1) {
        element.attributes.splice(langAttrIndex, 1);
    }
    // Add lang={await getLocale()} attribute
    element.attributes.push(t.jsxAttribute(t.jsxIdentifier('lang'), t.jsxExpressionContainer(t.awaitExpression(t.callExpression(t.identifier('getLocale'), [])))));
}
function makeParentFunctionAsync(path) {
    const functionParent = path.getFunctionParent();
    if (!functionParent)
        return false;
    const node = functionParent.node;
    if ((t.isFunctionDeclaration(node) ||
        t.isFunctionExpression(node) ||
        t.isArrowFunctionExpression(node)) &&
        !node.async) {
        node.async = true;
        return true;
    }
    return false;
}
