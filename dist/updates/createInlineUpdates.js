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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createInlineUpdates;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
const t = __importStar(require("@babel/types"));
const addGTIdentifierToSyntaxTree_1 = __importDefault(require("../data-_gt/addGTIdentifierToSyntaxTree"));
const warnings_1 = require("../console/warnings");
const id_1 = require("generaltranslation/id");
function isStaticExpression(expr) {
    // Handle empty expressions
    if (t.isJSXEmptyExpression(expr)) {
        return { isStatic: true, value: "" };
    }
    // Handle direct string literals
    if (t.isStringLiteral(expr)) {
        return { isStatic: true, value: expr.value };
    }
    // Handle template literals without expressions
    if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
        return { isStatic: true, value: expr.quasis[0].value.raw };
    }
    // Handle binary expressions (string concatenation)
    if (t.isBinaryExpression(expr)) {
        // Only handle string concatenation
        if (expr.operator !== "+") {
            return { isStatic: false };
        }
        // Type guard to ensure we only process Expression types
        if (t.isExpression(expr.left) && t.isExpression(expr.right)) {
            const left = isStaticExpression(expr.left);
            const right = isStaticExpression(expr.right);
            if (left.isStatic &&
                right.isStatic &&
                left.value !== undefined &&
                right.value !== undefined) {
                return { isStatic: true, value: left.value + right.value };
            }
        }
    }
    // Handle parenthesized expressions
    if (t.isParenthesizedExpression(expr)) {
        return isStaticExpression(expr.expression);
    }
    // Handle numeric literals by converting them to strings
    if (t.isNumericLiteral(expr)) {
        return { isStatic: true, value: String(expr.value) };
    }
    // Handle boolean literals by converting them to strings
    if (t.isBooleanLiteral(expr)) {
        return { isStatic: true, value: String(expr.value) };
    }
    // Handle null literal
    if (t.isNullLiteral(expr)) {
        return { isStatic: true, value: "null" };
    }
    // Not a static expression
    return { isStatic: false };
}
function createInlineUpdates(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const updates = [];
        // Use the provided app directory or default to the current directory
        const srcDirectory = options.src || ["./"];
        // Define the file extensions to look for
        const extensions = [".js", ".jsx", ".tsx"];
        /**
         * Recursively scan the directory and collect all files with the specified extensions,
         * excluding files or directories that start with a dot (.)
         * @param dir - The directory to scan
         * @returns An array of file paths
         */
        function getFiles(dir) {
            let files = [];
            const items = fs_1.default.readdirSync(dir);
            for (const item of items) {
                // Skip hidden files and directories
                if (item.startsWith("."))
                    continue;
                const fullPath = path_1.default.join(dir, item);
                const stat = fs_1.default.statSync(fullPath);
                if (stat.isDirectory()) {
                    // Recursively scan subdirectories
                    files = files.concat(getFiles(fullPath));
                }
                else if (extensions.includes(path_1.default.extname(item))) {
                    // Add files with the specified extensions
                    files.push(fullPath);
                }
            }
            return files;
        }
        const files = srcDirectory.flatMap((dir) => getFiles(dir));
        // Declare which components are considered valid "variable containers"
        const variableComponents = ["Var", "DateTime", "Currency", "Num"];
        for (const file of files) {
            const code = fs_1.default.readFileSync(file, "utf8");
            let ast;
            try {
                ast = (0, parser_1.parse)(code, {
                    sourceType: "module",
                    plugins: ["jsx", "typescript"],
                });
            }
            catch (error) {
                console.error(`Error parsing file ${file}:`, error);
                continue;
            }
            (0, traverse_1.default)(ast, {
                JSXElement(path) {
                    const openingElement = path.node.openingElement;
                    const name = openingElement.name;
                    // Only proceed if it's <T> ...
                    if (name.type === "JSXIdentifier" && name.name === "T") {
                        const componentObj = { props: {} };
                        // We'll track this flag to know if any unwrapped {variable} is found in children
                        let hasUnwrappedExpression = false;
                        // We'll also track if `id` or `context` is variable
                        let hasVariableIdOrContext = false;
                        // The buildJSXTree function that handles children recursion
                        function buildJSXTree(node, isInsideVar = false) {
                            if (t.isJSXExpressionContainer(node) && !isInsideVar) {
                                const expr = node.expression;
                                const staticAnalysis = isStaticExpression(expr);
                                if (staticAnalysis.isStatic &&
                                    staticAnalysis.value !== undefined) {
                                    // Preserve the exact whitespace for static string expressions
                                    return staticAnalysis.value;
                                }
                                // Keep existing behavior for non-static expressions
                                hasUnwrappedExpression = true;
                                return (0, generator_1.default)(node).code;
                            }
                            // Updated JSX Text handling
                            if (t.isJSXText(node)) {
                                const text = node.value
                                    .replace(/\s*\n\s*/g, " ") // Replace newlines (and their surrounding whitespace) with a single space
                                    .replace(/\s+/g, " "); // Collapse multiple spaces into one
                                return text;
                            }
                            // If we are inside a variable component, keep going
                            else if (t.isJSXExpressionContainer(node)) {
                                return buildJSXTree(node.expression, isInsideVar);
                                // If it's a JSX element
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
                                // then for its children we set isInsideVar = true
                                const nextInsideVar = variableComponents.includes(typeName !== null && typeName !== void 0 ? typeName : "")
                                    ? true
                                    : isInsideVar;
                                const props = {};
                                element.openingElement.attributes.forEach((attr) => {
                                    if (t.isJSXAttribute(attr)) {
                                        const attrName = attr.name.name;
                                        let attrValue = null;
                                        if (attr.value) {
                                            if (t.isStringLiteral(attr.value)) {
                                                attrValue = attr.value.value;
                                            }
                                            else if (t.isJSXExpressionContainer(attr.value)) {
                                                attrValue = buildJSXTree(attr.value.expression, nextInsideVar);
                                            }
                                        }
                                        props[attrName] = attrValue;
                                    }
                                    else if (t.isJSXSpreadAttribute(attr)) {
                                        props["..."] = (0, generator_1.default)(attr.argument).code;
                                    }
                                });
                                const children = element.children
                                    .map((child) => buildJSXTree(child, nextInsideVar))
                                    .filter((child) => child !== null && child !== "")
                                    // Process whitespace between elements
                                    .map((child, index, array) => {
                                    if (typeof child === "string") {
                                        // Always trim start of first child and end of last child
                                        if (index === 0) {
                                            child = child.trimStart();
                                        }
                                        if (index === array.length - 1) {
                                            child = child.trimEnd();
                                        }
                                        // If previous or next item is a JSX expression or element,
                                        // trim whitespace accordingly
                                        const prevItem = index > 0 ? array[index - 1] : null;
                                        const nextItem = index < array.length - 1 ? array[index + 1] : null;
                                        if (typeof prevItem === "object" ||
                                            typeof nextItem === "object") {
                                            if (typeof prevItem === "object") {
                                                child = child.trimStart();
                                            }
                                            if (typeof nextItem === "object") {
                                                child = child.trimEnd();
                                            }
                                        }
                                    }
                                    return child;
                                })
                                    .filter((child) => child !== "" && child !== " "); // Remove empty strings after trimming
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
                                    .map((child) => buildJSXTree(child, isInsideVar))
                                    .filter((child) => child !== null && child !== "");
                                return {
                                    type: "",
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
                        // Gather <T>'s props
                        openingElement.attributes.forEach((attr) => {
                            if (!t.isJSXAttribute(attr))
                                return;
                            const attrName = attr.name.name;
                            if (typeof attrName !== "string")
                                return;
                            if (attr.value) {
                                // If it's a plain string literal like id="hello"
                                if (t.isStringLiteral(attr.value)) {
                                    componentObj.props[attrName] = attr.value.value;
                                }
                                // If it's an expression container like id={"hello"}, id={someVar}, etc.
                                else if (t.isJSXExpressionContainer(attr.value)) {
                                    const expr = attr.value.expression;
                                    // Only check for static expressions on id and context props
                                    if (attrName === "id" || attrName === "context") {
                                        const staticAnalysis = isStaticExpression(expr);
                                        if (!staticAnalysis.isStatic) {
                                            (0, warnings_1.warnVariableProp)(file, attrName, (0, generator_1.default)(expr).code);
                                            hasVariableIdOrContext = true;
                                        }
                                    }
                                    // Store the value (for all props)
                                    componentObj.props[attrName] = (0, generator_1.default)(expr).code;
                                }
                            }
                        });
                        // If we already found a variable `id` or `context`, skip immediately
                        if (hasVariableIdOrContext) {
                            return;
                        }
                        // Build and store the "children" / tree
                        const tree = path.node.children
                            .map((child) => buildJSXTree(child))
                            .filter((child) => child !== null && child !== "")
                            // Additional processing to ensure no extra whitespace between components
                            .map((child, index, array) => {
                            if (typeof child === "string") {
                                child = child.trim();
                                // Only preserve a single space between text nodes
                                const prevItem = index > 0 ? array[index - 1] : null;
                                const nextItem = index < array.length - 1 ? array[index + 1] : null;
                                if (typeof prevItem === "object" ||
                                    typeof nextItem === "object") {
                                    // If adjacent to a component/expression, trim that side
                                    if (typeof prevItem === "object") {
                                        child = child.trimStart();
                                    }
                                    if (typeof nextItem === "object") {
                                        child = child.trimEnd();
                                    }
                                }
                            }
                            return child;
                        })
                            .filter((child) => child !== "" && child !== " ");
                        componentObj.tree = tree.length === 1 ? tree[0] : tree;
                        // Check the id ...
                        const id = componentObj.props.id;
                        // If user forgot to provide an `id`, warn
                        if (!id) {
                            (0, warnings_1.warnNoId)(file);
                            return;
                        }
                        // If we found an unwrapped expression, skip
                        if (hasUnwrappedExpression) {
                            (0, warnings_1.warnHasUnwrappedExpression)(file, id);
                            return;
                        }
                        // If we reached here, this <T> is valid
                        const childrenAsObjects = (0, addGTIdentifierToSyntaxTree_1.default)(componentObj.tree);
                        // displayFoundTMessage(file, id);
                        updates.push({
                            type: "jsx",
                            source: childrenAsObjects,
                            metadata: componentObj.props,
                        });
                    }
                },
            });
        }
        // Post-process to add a hash to each update
        yield Promise.all(updates.map((update) => __awaiter(this, void 0, void 0, function* () {
            const context = update.metadata.context;
            const hash = (0, id_1.hashJsxChildren)(context
                ? {
                    source: update.source,
                    context,
                }
                : { source: update.source });
            update.metadata.hash = hash;
        })));
        return updates;
    });
}
