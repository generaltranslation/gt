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
exports.wrapJsxElement = wrapJsxElement;
exports.handleJsxElement = handleJsxElement;
const t = __importStar(require("@babel/types"));
const isStaticExpression_1 = require("./isStaticExpression");
function wrapJsxExpression(node, options, isMeaningful) {
    const expression = node.expression;
    let wrappedInT = false;
    // Handle JSX Element directly, no need to wrap with Var
    if (t.isJSXElement(expression)) {
        return wrapJsxElement(expression, options, isMeaningful);
    }
    // Handle conditional expressions (ternary)
    else if (t.isConditionalExpression(expression)) {
        if (t.isJSXElement(expression.consequent)) {
            const consequentResult = wrapJsxElement(expression.consequent, options, isMeaningful);
            if (consequentResult.needsWrapping) {
                expression.consequent = wrapWithT(consequentResult.node, options);
                wrappedInT = true;
            }
        }
        if (t.isJSXElement(expression.alternate)) {
            const alternateResult = wrapJsxElement(expression.alternate, options, isMeaningful);
            if (alternateResult.needsWrapping) {
                expression.alternate = wrapWithT(alternateResult.node, options);
                wrappedInT = true;
            }
        }
    }
    // Handle logical expressions (&& and ||)
    else if (t.isLogicalExpression(expression)) {
        if (t.isJSXElement(expression.left)) {
            const leftResult = wrapJsxElement(expression.left, options, isMeaningful);
            if (leftResult.needsWrapping && t.isJSXElement(leftResult.node)) {
                expression.left = wrapWithT(leftResult.node, options);
                wrappedInT = true;
            }
        }
        else if (t.isLogicalExpression(expression.left)) {
            // Recursively handle nested logical expressions
            const leftResult = wrapJsxExpression(t.jsxExpressionContainer(expression.left), options, isMeaningful);
            if (t.isJSXExpressionContainer(leftResult.node) &&
                t.isExpression(leftResult.node.expression)) {
                expression.left = leftResult.node.expression;
            }
        }
        if (t.isJSXElement(expression.right)) {
            const rightResult = wrapJsxElement(expression.right, options, isMeaningful);
            if (rightResult.needsWrapping && t.isJSXElement(rightResult.node)) {
                expression.right = wrapWithT(rightResult.node, options);
                wrappedInT = true;
            }
        }
        else if (t.isLogicalExpression(expression.right)) {
            // Recursively handle nested logical expressions
            const rightResult = wrapJsxExpression(t.jsxExpressionContainer(expression.right), options, isMeaningful);
            if (t.isJSXExpressionContainer(rightResult.node) &&
                t.isExpression(rightResult.node.expression)) {
                expression.right = rightResult.node.expression;
            }
        }
    }
    // Handle binary expressions (+)
    else if (t.isBinaryExpression(expression)) {
        if (t.isJSXElement(expression.left)) {
            const leftResult = wrapJsxElement(expression.left, options, isMeaningful);
            if (leftResult.needsWrapping && t.isJSXElement(leftResult.node)) {
                expression.left = wrapWithT(leftResult.node, options);
                wrappedInT = true;
            }
        }
        if (t.isJSXElement(expression.right)) {
            const rightResult = wrapJsxElement(expression.right, options, isMeaningful);
            if (rightResult.needsWrapping && t.isJSXElement(rightResult.node)) {
                expression.right = wrapWithT(rightResult.node, options);
                wrappedInT = true;
            }
        }
    }
    const staticCheck = (0, isStaticExpression_1.isStaticExpression)(expression);
    // If the expression is not static or if it's already wrapped in T,
    // wrap with Var
    if (!staticCheck.isStatic || wrappedInT) {
        return {
            node: wrapWithVar(node, options),
            needsWrapping: true,
        };
    }
    return {
        node,
        needsWrapping: false, // If the expression needed wrapping, it's already wrapped by <T>
    };
}
/**
 * Recursively traverse a JSX element and wrap variables with a <Var> component
 * @param node - The JSX element to wrap
 * @param options - Optional component names for T and Var
 * @param isMeaningful - A function to determine if a node is meaningful
 * @returns The wrapped JSX element
 */
function wrapJsxElement(node, options, isMeaningful) {
    const TComponentName = options.TComponent || 'T';
    const VarComponentName = options.VarComponent || 'Var';
    // Handle JSX Expression Container
    if (t.isJSXExpressionContainer(node)) {
        return wrapJsxExpression(node, options, isMeaningful);
    }
    // Handle JSX Element
    if (t.isJSXElement(node)) {
        // Don't process if it's already a T or Var component
        const name = node.openingElement.name;
        if (t.isJSXIdentifier(name) &&
            (name.name === TComponentName || name.name === VarComponentName)) {
            return {
                node,
                needsWrapping: false,
            };
        }
        // Process children recursively (DFS postorder)
        let needsWrapping = false;
        const processedChildren = node.children.map((child) => {
            if (t.isJSXElement(child) || t.isJSXExpressionContainer(child)) {
                const result = wrapJsxElement(child, options, isMeaningful);
                needsWrapping = needsWrapping || result.needsWrapping;
                return result.node;
            }
            if (t.isJSXText(child) && isMeaningful(child)) {
                needsWrapping = true;
            }
            return child;
        });
        node.children = processedChildren;
        return {
            node,
            needsWrapping: needsWrapping,
        };
    }
    // For any other node types, return as-is
    return {
        node,
        needsWrapping: true,
    };
}
/**
 * Wraps a JSX element with a <T> component and unique id
 * @param rootNode - The JSX element to wrap
 * @param options - Optional component names for T and Var
 * @param isMeaningful - A function to determine if a node is meaningful
 * @returns The wrapped JSX element
 */
function handleJsxElement(rootNode, options, isMeaningful) {
    const result = wrapJsxElement(rootNode, options, isMeaningful);
    // Only wrap with T at the root level if there's meaningful content
    if (result.needsWrapping) {
        return wrapWithT(result.node, options);
    }
    return result.node;
}
function wrapWithT(node, options) {
    const TComponentName = options.TComponent || 'T';
    const uniqueId = `${options.idPrefix}.${options.idCount}`;
    options.modified = true;
    options.idCount++;
    if (!options.usedImports.includes(TComponentName)) {
        options.usedImports.push(TComponentName);
    }
    return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(TComponentName), [t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral(uniqueId))], false), t.jsxClosingElement(t.jsxIdentifier(TComponentName)), [node], false);
}
function wrapWithVar(node, options) {
    const VarComponentName = options.VarComponent || 'Var';
    options.modified = true;
    if (!options.usedImports.includes(VarComponentName)) {
        options.usedImports.push(VarComponentName);
    }
    return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(VarComponentName), [], false), t.jsxClosingElement(t.jsxIdentifier(VarComponentName)), [node], false);
}
