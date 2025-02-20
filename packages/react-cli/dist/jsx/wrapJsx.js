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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapJsxElement = wrapJsxElement;
exports.handleJsxElement = handleJsxElement;
const t = __importStar(require("@babel/types"));
const evaluateJsx_1 = require("./evaluateJsx");
const generator_1 = __importDefault(require("@babel/generator"));
const warnings_1 = require("../console/warnings");
function wrapJsxExpression(node, options, isMeaningful, mark) {
    const expression = t.isParenthesizedExpression(node.expression)
        ? node.expression.expression
        : node.expression;
    // Handle JSX Element directly, no need to wrap with Var
    if (t.isJSXElement(expression)) {
        const result = wrapJsxElement(expression, options, isMeaningful, mark);
        // re-wrap the result in a JSXExpressionContainer
        if (t.isParenthesizedExpression(node.expression)) {
            node.expression.expression = result.node;
        }
        else {
            node.expression = result.node;
        }
        return {
            node,
            hasMeaningfulContent: result.hasMeaningfulContent,
        };
    }
    // Handle conditional expressions (ternary)
    else if (t.isConditionalExpression(expression)) {
        const consequent = t.isParenthesizedExpression(expression.consequent)
            ? expression.consequent.expression
            : expression.consequent;
        const alternate = t.isParenthesizedExpression(expression.alternate)
            ? expression.alternate.expression
            : expression.alternate;
        // Handle consequent
        if (t.isJSXElement(consequent)) {
            const result = handleJsxElement(consequent, options, isMeaningful);
            // Re-insert into parenthesized expression if necessary
            if (t.isParenthesizedExpression(expression.consequent)) {
                expression.consequent.expression = result.node;
            }
            else {
                expression.consequent = result.node;
            }
            // Warn about ternary (should use branch instead)
            console.log(result.hasMeaningfulContent, mark);
            if (result.hasMeaningfulContent && !mark) {
                console.log('found ternary');
                console.log(options.warnings);
                options.warnings.push((0, warnings_1.warnTernary)(options.file));
            }
        }
        else if (t.isConditionalExpression(consequent) ||
            t.isLogicalExpression(consequent)) {
            // Recursively handle nested ternary in consequent
            const consequentResult = wrapJsxExpression(t.jsxExpressionContainer(consequent), options, isMeaningful, mark);
            if (t.isJSXExpressionContainer(consequentResult.node) &&
                t.isExpression(consequentResult.node.expression)) {
                expression.consequent = consequentResult.node.expression;
                // Re-insert into parenthesized expression if necessary
                if (t.isParenthesizedExpression(expression.consequent)) {
                    expression.consequent.expression = consequentResult.node.expression;
                }
                else {
                    expression.consequent = consequentResult.node.expression;
                }
            }
        }
        else {
            if ((0, evaluateJsx_1.isStaticValue)(consequent)) {
                const wrapped = wrapExpressionWithT(consequent, options, false);
                // Re-insert into parenthesized expression if necessary
                if (t.isParenthesizedExpression(expression.consequent)) {
                    expression.consequent.expression = wrapped;
                }
                else {
                    expression.consequent = wrapped;
                }
            }
        }
        // Handle alternate
        if (t.isJSXElement(alternate)) {
            const result = handleJsxElement(alternate, options, isMeaningful);
            // Re-insert into parenthesized expression if necessary
            if (t.isParenthesizedExpression(expression.alternate)) {
                expression.alternate.expression = result.node;
            }
            else {
                expression.alternate = result.node;
            }
        }
        else if (t.isConditionalExpression(alternate) ||
            t.isLogicalExpression(alternate)) {
            // Recursively handle nested ternary in alternate
            const alternateResult = wrapJsxExpression(t.jsxExpressionContainer(alternate), options, isMeaningful, mark);
            if (t.isJSXExpressionContainer(alternateResult.node) &&
                t.isExpression(alternateResult.node.expression)) {
                expression.alternate = alternateResult.node.expression;
                // Re-insert into parenthesized expression if necessary
                if (t.isParenthesizedExpression(expression.alternate)) {
                    expression.alternate.expression = alternateResult.node.expression;
                }
                else {
                    expression.alternate = alternateResult.node.expression;
                }
            }
        }
        else {
            if ((0, evaluateJsx_1.isStaticValue)(alternate)) {
                const wrapped = wrapExpressionWithT(alternate, options, false);
                // Re-insert into parenthesized expression if necessary
                if (t.isParenthesizedExpression(expression.alternate)) {
                    expression.alternate.expression = wrapped;
                }
                else {
                    expression.alternate = wrapped;
                }
            }
        }
    }
    // Handle logical expressions (&& and ||)
    else if (t.isLogicalExpression(expression)) {
        const left = t.isParenthesizedExpression(expression.left)
            ? expression.left.expression
            : expression.left;
        const right = t.isParenthesizedExpression(expression.right)
            ? expression.right.expression
            : expression.right;
        if (t.isJSXElement(left)) {
            const result = handleJsxElement(left, options, isMeaningful);
            // Re-insert into parenthesized expression if necessary
            if (t.isParenthesizedExpression(expression.left)) {
                expression.left.expression = result.node;
            }
            else {
                expression.left = result.node;
            }
        }
        else if (t.isLogicalExpression(left) || t.isConditionalExpression(left)) {
            // Recursively handle nested logical expressions
            const leftResult = wrapJsxExpression(t.jsxExpressionContainer(left), options, isMeaningful, mark);
            if (t.isJSXExpressionContainer(leftResult.node) &&
                t.isExpression(leftResult.node.expression)) {
                // Re-insert into parenthesized expression if necessary
                if (t.isParenthesizedExpression(expression.left)) {
                    expression.left.expression = leftResult.node.expression;
                }
                else {
                    expression.left = leftResult.node.expression;
                }
            }
        }
        else {
            if ((0, evaluateJsx_1.isStaticValue)(left) && expression.operator !== '&&') {
                const wrapped = wrapExpressionWithT(left, options, false);
                // Re-insert into parenthesized expression if necessary
                if (t.isParenthesizedExpression(expression.left)) {
                    expression.left.expression = wrapped;
                }
                else {
                    expression.left = wrapped;
                }
            }
        }
        if (t.isJSXElement(right)) {
            const result = handleJsxElement(right, options, isMeaningful);
            // Re-insert into parenthesized expression if necessary
            if (t.isParenthesizedExpression(expression.right)) {
                expression.right.expression = result.node;
            }
            else {
                expression.right = result.node;
            }
        }
        else if (t.isLogicalExpression(right) ||
            t.isConditionalExpression(right)) {
            // Recursively handle nested logical expressions
            const rightResult = wrapJsxExpression(t.jsxExpressionContainer(right), options, isMeaningful, mark);
            if (t.isJSXExpressionContainer(rightResult.node) &&
                t.isExpression(rightResult.node.expression)) {
                // Re-insert into parenthesized expression if necessary
                if (t.isParenthesizedExpression(expression.right)) {
                    expression.right.expression = rightResult.node.expression;
                }
                else {
                    expression.right = rightResult.node.expression;
                }
            }
        }
        else {
            if ((0, evaluateJsx_1.isStaticValue)(right)) {
                const wrapped = wrapExpressionWithT(right, options, false);
                // Re-insert into parenthesized expression if necessary
                if (t.isParenthesizedExpression(expression.right)) {
                    expression.right.expression = wrapped;
                }
                else {
                    expression.right = wrapped;
                }
            }
        }
    }
    const staticCheck = (0, evaluateJsx_1.isStaticExpression)(expression);
    // If the expression is not static or if it's already wrapped in T,
    // wrap with Var
    if (!staticCheck.isStatic) {
        return {
            node: wrapWithVar(node, options, mark),
            hasMeaningfulContent: false,
        };
    }
    // If it's a static expression, check if it's meaningful
    return {
        node,
        hasMeaningfulContent: false,
    };
}
/**
 * Recursively traverse a JSX element and wrap variables with a <Var> component
 * @param node - The JSX element to wrap
 * @param options - Optional component names for T and Var
 * @param isMeaningful - A function to determine if a node is meaningful
 * @returns The wrapped JSX element
 */
function wrapJsxElement(node, options, isMeaningful, mark) {
    const TComponentName = options.TComponent || 'T';
    const VarComponentName = options.VarComponent || 'Var';
    // Handle JSX Element
    if (t.isJSXElement(node)) {
        // Don't process if it's already a T or Var component
        const name = node.openingElement.name;
        if (t.isJSXIdentifier(name) &&
            (name.name === TComponentName || name.name === VarComponentName)) {
            return {
                node,
                hasMeaningfulContent: false,
            };
        }
        // Process children recursively (DFS postorder)
        let hasMeaningfulContent = false;
        const processedChildren = node.children.map((child) => {
            if (t.isJSXElement(child)) {
                const result = wrapJsxElement(child, options, isMeaningful, mark);
                hasMeaningfulContent =
                    hasMeaningfulContent || result.hasMeaningfulContent;
                return result.node;
            }
            if (t.isJSXExpressionContainer(child)) {
                const result = wrapJsxExpression(child, options, isMeaningful, mark);
                // Expressions are never meaningful because they will either:
                // 1. be sub-wrapped in a T (if they contain meaningful content)
                // 2. be wrapped in a Var (if they are not static)
                return result.node;
            }
            const isMeaningfulVal = isMeaningful(child);
            if (isMeaningfulVal) {
                hasMeaningfulContent = true;
            }
            return child;
        });
        node.children = processedChildren;
        return {
            node,
            hasMeaningfulContent: hasMeaningfulContent,
        };
    }
    // For any other node types, return as-is
    return {
        node,
        hasMeaningfulContent: false,
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
    const result = wrapJsxElement(rootNode, options, isMeaningful, true);
    console.log(result.hasMeaningfulContent, (0, generator_1.default)(rootNode).code);
    // Only wrap with T at the root level if there's meaningful content
    if (result.hasMeaningfulContent) {
        const output = wrapJsxElement(result.node, options, isMeaningful, false);
        const node = wrapWithT(output.node, options, false);
        return {
            node,
            hasMeaningfulContent: true,
        };
    }
    return {
        node: result.node,
        hasMeaningfulContent: false,
    };
}
function wrapWithT(node, options, mark) {
    if (mark) {
        return node;
    }
    const TComponentName = options.TComponent || 'T';
    const uniqueId = `${options.idPrefix}.${options.idCount}`;
    options.modified = true;
    options.idCount++;
    if (!options.usedImports.includes(TComponentName)) {
        options.usedImports.push(TComponentName);
    }
    if (options.createIds) {
        return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(TComponentName), [t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral(uniqueId))], false), t.jsxClosingElement(t.jsxIdentifier(TComponentName)), [node], false);
    }
    return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(TComponentName), [], false), t.jsxClosingElement(t.jsxIdentifier(TComponentName)), [node], false);
}
function wrapExpressionWithT(node, options, mark) {
    if (mark) {
        return node;
    }
    const TComponentName = options.TComponent || 'T';
    const uniqueId = `${options.idPrefix}.${options.idCount}`;
    options.modified = true;
    options.idCount++;
    if (!options.usedImports.includes(TComponentName)) {
        options.usedImports.push(TComponentName);
    }
    if (options.createIds) {
        return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(TComponentName), [t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral(uniqueId))], false), t.jsxClosingElement(t.jsxIdentifier(TComponentName)), [t.jsxExpressionContainer(node)], false);
    }
    return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(TComponentName), [], false), t.jsxClosingElement(t.jsxIdentifier(TComponentName)), [t.jsxExpressionContainer(node)], false);
}
function wrapWithVar(node, options, mark) {
    if (mark) {
        return node;
    }
    const VarComponentName = options.VarComponent || 'Var';
    options.modified = true;
    if (!options.usedImports.includes(VarComponentName)) {
        options.usedImports.push(VarComponentName);
    }
    return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(VarComponentName), [], false), t.jsxClosingElement(t.jsxIdentifier(VarComponentName)), [node], false);
}
