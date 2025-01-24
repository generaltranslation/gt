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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const internal_1 = require("generaltranslation/internal");
// Declare which components are considered valid "variable containers"
const VARIABLE_COMPONENTS = ["Var", "DateTime", "Currency", "Num"];
function handleStringChild(child, index, childrenTypes) {
    // Normalize line endings to \n for consistency across platforms
    let result = child.replace(/\r\n|\r/g, "\n");
    // Collapse multiple spaces/tabs into a single space
    result = result.replace(/[\t ]+/g, " ");
    // If it's the first child, trim the start
    if (index === 0) {
        result = result.trimStart();
    }
    // If it's the last child, trim the end
    if (index === childrenTypes.length - 1) {
        result = result.trimEnd();
    }
    let newResult = "";
    let newline = false;
    for (const char of result) {
        if (char === "\n") {
            if (newResult.trim())
                newResult += " ";
            else
                newResult = "";
            newline = true;
            continue;
        }
        if (!newline) {
            newResult += char;
            continue;
        }
        if (char.trim() === "")
            continue;
        newResult += char;
        newline = false;
    }
    if (newline)
        newResult = newResult.trimEnd();
    result = newResult;
    // Collapse multiple spaces/tabs into a single space
    result = result.replace(/[\t ]+/g, " ");
    return result;
}
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
function parseJSXElement(node, updates, errors, file) {
    const openingElement = node.openingElement;
    const name = openingElement.name;
    // Only proceed if it's <T> ...
    if (name.type === "JSXIdentifier" && name.name === "T") {
        const componentObj = { props: {} };
        // We'll track this flag to know if any unwrapped {variable} is found in children
        const unwrappedExpressions = [];
        // The buildJSXTree function that handles children recursion
        function buildJSXTree(node) {
            if (t.isJSXExpressionContainer(node)) {
                const expr = node.expression;
                const staticAnalysis = isStaticExpression(expr);
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
            // Updated JSX Text handling
            // JSX Text handling following React's rules
            if (t.isJSXText(node)) {
                let text = node.value;
                return text;
            }
            else if (t.isJSXExpressionContainer(node)) {
                return buildJSXTree(node.expression);
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
                const elementIsVariable = VARIABLE_COMPONENTS.includes(typeName !== null && typeName !== void 0 ? typeName : "");
                const props = {};
                const elementIsPlural = typeName === "Plural";
                const elementIsBranch = typeName === "Branch";
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
                                    (elementIsBranch && attrName !== "branch")) {
                                    // Make sure that variable strings like {`I have ${count} book`} are invalid!
                                    if (t.isTemplateLiteral(attr.value.expression) &&
                                        !isStaticExpression(attr.value.expression).isStatic) {
                                        unwrappedExpressions.push((0, generator_1.default)(attr.value).code);
                                    }
                                }
                                attrValue = buildJSXTree(attr.value.expression);
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
                const children = element.children.map((child) => buildJSXTree(child));
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
                    .map((child) => buildJSXTree(child))
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
                    const code = (0, generator_1.default)(expr).code;
                    // Only check for static expressions on id and context props
                    if (attrName === "id" || attrName === "context") {
                        const staticAnalysis = isStaticExpression(expr);
                        if (!staticAnalysis.isStatic) {
                            errors.push((0, warnings_1.warnVariableProp)(file, attrName, code));
                        }
                    }
                    // Store the value (for all props)
                    componentObj.props[attrName] = code;
                }
            }
        });
        // Build and store the "children" / tree
        const initialTree = buildJSXTree(node).props.children;
        const handleChildrenWhitespace = (currentTree) => {
            var _a;
            if (Array.isArray(currentTree)) {
                const childrenTypes = currentTree.map((child) => {
                    if (typeof child === "string")
                        return "text";
                    if (typeof child === "object" && "expression" in child)
                        return "expression";
                    return "element";
                });
                const newChildren = [];
                currentTree.forEach((child, index) => {
                    if (childrenTypes[index] === "text") {
                        const string = handleStringChild(child, index, childrenTypes);
                        if (string)
                            newChildren.push(string);
                    }
                    else if (childrenTypes[index] === "expression") {
                        newChildren.push(child.result);
                    }
                    else {
                        newChildren.push(handleChildrenWhitespace(child));
                    }
                });
                return newChildren.length === 1 ? newChildren[0] : newChildren;
            }
            else if ((_a = currentTree === null || currentTree === void 0 ? void 0 : currentTree.props) === null || _a === void 0 ? void 0 : _a.children) {
                const currentTreeChildren = handleChildrenWhitespace(currentTree.props.children);
                return Object.assign(Object.assign({}, currentTree), { props: Object.assign(Object.assign({}, currentTree.props), (currentTreeChildren && { children: currentTreeChildren })) });
            }
            else if (typeof currentTree === "object" &&
                "expression" in currentTree === true) {
                return currentTree.result;
            }
            else if (typeof currentTree === "string") {
                return handleStringChild(currentTree, 0, ["text"]);
            }
            return currentTree;
        };
        const whitespaceHandledTree = handleChildrenWhitespace(initialTree);
        const tree = (0, addGTIdentifierToSyntaxTree_1.default)(whitespaceHandledTree);
        componentObj.tree = tree.length === 1 ? tree[0] : tree;
        // Check the id ...
        const id = componentObj.props.id;
        // If user forgot to provide an `id`, warn
        if (!id) {
            errors.push((0, warnings_1.warnNoId)(file));
        }
        // If we found an unwrapped expression, skip
        if (unwrappedExpressions.length > 0) {
            errors.push((0, warnings_1.warnHasUnwrappedExpression)(file, id, unwrappedExpressions));
        }
        if (errors.length > 0)
            return;
        // <T> is valid here
        // displayFoundTMessage(file, id);
        updates.push({
            type: "jsx",
            source: componentObj.tree,
            metadata: componentObj.props,
        });
    }
}
function createInlineUpdates(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const updates = [];
        const errors = [];
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
                    parseJSXElement(path.node, updates, errors, file);
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
        return { updates, errors };
    });
}
