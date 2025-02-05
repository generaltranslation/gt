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
exports.buildJSXTree = buildJSXTree;
exports.parseJSXElement = parseJSXElement;
const generator_1 = __importDefault(require("@babel/generator"));
const t = __importStar(require("@babel/types"));
const addGTIdentifierToSyntaxTree_1 = __importDefault(require("../data-_gt/addGTIdentifierToSyntaxTree"));
const warnings_1 = require("../console/warnings");
const internal_1 = require("generaltranslation/internal");
const trimJsxStringChildren_1 = require("./trimJsxStringChildren");
const isStaticExpression_1 = require("./isStaticExpression");
// Valid variable components
const VARIABLE_COMPONENTS = ['Var', 'DateTime', 'Currency', 'Num'];
/**
 * Builds a JSX tree from a given node, recursively handling children.
 * @param node - The node to build the tree from
 * @param unwrappedExpressions - An array to store unwrapped expressions
 * @param updates - The updates array
 * @param errors - The errors array
 * @param file - The file name
 * @returns The built JSX tree
 */
function buildJSXTree(node, unwrappedExpressions, updates, errors, file) {
    if (t.isJSXExpressionContainer(node)) {
        const expr = node.expression;
        const staticAnalysis = (0, isStaticExpression_1.isStaticExpression)(expr);
        if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
            // Preserve the exact whitespace for static string expressions
            return {
                expression: true,
                result: staticAnalysis.value,
            };
        }
        // Keep existing behavior for non-static expressions
        const code = (0, generator_1.default)(node).code;
        unwrappedExpressions.push(code); // Keep track of unwrapped expressions for error reporting
        return code;
    }
    else if (t.isJSXText(node)) {
        // Updated JSX Text handling
        // JSX Text handling following React's rules
        let text = node.value;
        return text;
    }
    else if (t.isJSXElement(node)) {
        const element = node;
        const elementName = element.openingElement.name;
        let typeName;
        if (t.isJSXIdentifier(elementName)) {
            typeName = elementName.name;
        }
        else if (t.isJSXMemberExpression(elementName)) {
            typeName = (0, generator_1.default)(elementName).code;
        }
        else {
            typeName = null;
        }
        // If this JSXElement is one of the recognized variable components,
        const elementIsVariable = VARIABLE_COMPONENTS.includes(typeName !== null && typeName !== void 0 ? typeName : '');
        const props = {};
        const elementIsPlural = typeName === 'Plural';
        const elementIsBranch = typeName === 'Branch';
        element.openingElement.attributes.forEach((attr) => {
            if (t.isJSXAttribute(attr)) {
                const attrName = attr.name.name;
                let attrValue = null;
                if (attr.value) {
                    if (t.isStringLiteral(attr.value)) {
                        attrValue = attr.value.value;
                    }
                    else if (t.isJSXExpressionContainer(attr.value)) {
                        if ((elementIsPlural && (0, internal_1.isAcceptedPluralForm)(attrName)) ||
                            (elementIsBranch && attrName !== 'branch')) {
                            // Make sure that variable strings like {`I have ${count} book`} are invalid!
                            if (t.isTemplateLiteral(attr.value.expression) &&
                                !(0, isStaticExpression_1.isStaticExpression)(attr.value.expression).isStatic) {
                                unwrappedExpressions.push((0, generator_1.default)(attr.value).code);
                            }
                        }
                        attrValue = buildJSXTree(attr.value.expression, unwrappedExpressions, updates, errors, file);
                    }
                }
                props[attrName] = attrValue;
            }
        });
        if (elementIsVariable) {
            parseJSXElement(element, updates, errors, file);
            return {
                type: typeName,
                props,
            };
        }
        const children = element.children.map((child) => buildJSXTree(child, unwrappedExpressions, updates, errors, file));
        if (children.length === 1) {
            props.children = children[0];
        }
        else if (children.length > 1) {
            props.children = children;
        }
        return {
            type: typeName,
            props,
        };
    }
    // If it's a JSX fragment
    else if (t.isJSXFragment(node)) {
        const children = node.children
            .map((child) => buildJSXTree(child, unwrappedExpressions, updates, errors, file))
            .filter((child) => child !== null && child !== '');
        return {
            type: '',
            props: {
                children: children.length === 1 ? children[0] : children,
            },
        };
    }
    // If it's a string literal (standalone)
    else if (t.isStringLiteral(node)) {
        return node.value;
    }
    // If it's some other JS expression
    else if (t.isIdentifier(node) ||
        t.isMemberExpression(node) ||
        t.isCallExpression(node) ||
        t.isBinaryExpression(node) ||
        t.isLogicalExpression(node) ||
        t.isConditionalExpression(node)) {
        return (0, generator_1.default)(node).code;
    }
    else {
        return (0, generator_1.default)(node).code;
    }
}
// end buildJSXTree
// Parses a JSX element and adds it to the updates array
function parseJSXElement(node, updates, errors, file) {
    const openingElement = node.openingElement;
    const name = openingElement.name;
    // Only proceed if it's <T> ...
    if (name.type === 'JSXIdentifier' && name.name === 'T') {
        const componentObj = { props: {} };
        // We'll track this flag to know if any unwrapped {variable} is found in children
        const unwrappedExpressions = [];
        // Gather <T>'s props
        openingElement.attributes.forEach((attr) => {
            if (!t.isJSXAttribute(attr))
                return;
            const attrName = attr.name.name;
            if (typeof attrName !== 'string')
                return;
            if (attr.value) {
                // If it's a plain string literal like id="hello"
                if (t.isStringLiteral(attr.value)) {
                    componentObj.props[attrName] = attr.value.value;
                }
                // If it's an expression container like id={"hello"}, id={someVar}, etc.
                else if (t.isJSXExpressionContainer(attr.value)) {
                    const expr = attr.value.expression;
                    const code = (0, generator_1.default)(expr).code;
                    // Only check for static expressions on id and context props
                    if (attrName === 'id' || attrName === 'context') {
                        const staticAnalysis = (0, isStaticExpression_1.isStaticExpression)(expr);
                        if (!staticAnalysis.isStatic) {
                            errors.push((0, warnings_1.warnVariableProp)(file, attrName, code));
                        }
                    }
                    // Store the value (for all props)
                    componentObj.props[attrName] = code;
                }
            }
        });
        // Build the JSX tree for this component
        const initialTree = buildJSXTree(node, unwrappedExpressions, updates, errors, file).props.children;
        const whitespaceHandledTree = (0, trimJsxStringChildren_1.handleChildrenWhitespace)(initialTree);
        const tree = (0, addGTIdentifierToSyntaxTree_1.default)(whitespaceHandledTree);
        componentObj.tree = tree.length === 1 ? tree[0] : tree;
        // Check the id ...
        const id = componentObj.props.id;
        // If user forgot to provide an `id`, warn
        // if (!id) {
        //   errors.push(warnNoId(file));
        // }
        // If we found an unwrapped expression, skip
        if (unwrappedExpressions.length > 0) {
            errors.push((0, warnings_1.warnHasUnwrappedExpression)(file, id, unwrappedExpressions));
        }
        if (errors.length > 0)
            return;
        // <T> is valid here
        // displayFoundTMessage(file, id);
        updates.push({
            type: 'jsx',
            source: componentObj.tree,
            metadata: componentObj.props,
        });
    }
}
