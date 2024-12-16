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
const internal_1 = require("gt-react/internal");
function createInlineUpdates(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const updates = [];
        // Use the provided app directory or default to the current directory
        const appDirectory = options.app || './';
        // Define the file extensions to look for
        const extensions = ['.js', '.jsx', '.tsx'];
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
                if (item.startsWith('.'))
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
        const files = getFiles(appDirectory);
        for (const file of files) {
            const code = fs_1.default.readFileSync(file, 'utf8');
            let ast;
            try {
                ast = (0, parser_1.parse)(code, {
                    sourceType: 'module',
                    plugins: ['jsx', 'typescript'],
                });
            }
            catch (error) {
                console.error(`Error parsing file ${file}:`, error);
                continue;
            }
            (0, traverse_1.default)(ast, {
                JSXElement(path) {
                    var _a, _b;
                    const openingElement = path.node.openingElement;
                    const name = openingElement.name;
                    if (name.type === 'JSXIdentifier' && name.name === 'T') {
                        const componentObj = { props: {} };
                        openingElement.attributes.forEach((attr) => {
                            if (attr.type === 'JSXAttribute') {
                                const attrName = attr.name.name;
                                let attrValue = null;
                                if (attr.value) {
                                    if (attr.value.type === 'StringLiteral') {
                                        attrValue = attr.value.value;
                                    }
                                    else if (attr.value.type === 'JSXExpressionContainer') {
                                        attrValue = buildJSXTree(attr.value.expression);
                                    }
                                }
                                componentObj.props[attrName] = attrValue;
                            }
                        });
                        function buildJSXTree(node) {
                            if (t.isJSXText(node)) {
                                // Trim the text and replace multiple whitespaces with a single space
                                return node.value.trim().replace(/\s+/g, ' ');
                            }
                            else if (t.isJSXExpressionContainer(node)) {
                                return buildJSXTree(node.expression);
                            }
                            else if (t.isJSXElement(node)) {
                                const element = node;
                                const openingElement = element.openingElement;
                                const elementName = openingElement.name;
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
                                const props = {};
                                openingElement.attributes.forEach((attr) => {
                                    if (t.isJSXAttribute(attr)) {
                                        const attrName = attr.name.name;
                                        let attrValue = null;
                                        if (attr.value) {
                                            if (t.isStringLiteral(attr.value)) {
                                                attrValue = attr.value.value;
                                            }
                                            else if (t.isJSXExpressionContainer(attr.value)) {
                                                attrValue = buildJSXTree(attr.value.expression);
                                            }
                                        }
                                        props[attrName] = attrValue;
                                    }
                                    else if (t.isJSXSpreadAttribute(attr)) {
                                        props['...'] = (0, generator_1.default)(attr.argument).code;
                                    }
                                });
                                const children = element.children
                                    .map((child) => buildJSXTree(child))
                                    .filter((child) => child !== null && child !== '');
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
                            else if (t.isJSXFragment(node)) {
                                const children = node.children
                                    .map((child) => buildJSXTree(child))
                                    .filter((child) => child !== null && child !== '');
                                return {
                                    type: "",
                                    props: {
                                        children: children.length === 1 ? children[0] : children
                                    }
                                };
                            }
                            else if (t.isStringLiteral(node)) {
                                return node.value;
                            }
                            else if (t.isIdentifier(node) || t.isMemberExpression(node) ||
                                t.isCallExpression(node) || t.isBinaryExpression(node) ||
                                t.isLogicalExpression(node) || t.isConditionalExpression(node)) {
                                return (0, generator_1.default)(node).code;
                            }
                            else {
                                return (0, generator_1.default)(node).code;
                            }
                        }
                        const tree = path.node.children
                            .map((child) => buildJSXTree(child))
                            .filter((child) => child !== null && child !== '');
                        componentObj.tree = tree.length === 1 ? tree[0] : tree;
                        const id = componentObj.props.id;
                        if (id) {
                            if (/[{}]/.test(id)) {
                                console.warn(`Found <T> component in ${file} with potentially variable id: "${id}". <T> components with variable IDs are translated at runtime.`);
                            }
                            else if (/[{}]/.test(((_a = componentObj.props) === null || _a === void 0 ? void 0 : _a.context) || '')) {
                                console.warn(`Found <T> component in ${file} with potentially variable context. { id: "${id}", context: "${(_b = componentObj.props) === null || _b === void 0 ? void 0 : _b.context}" }. <T> components with variable context are translated at runtime.`);
                            }
                            else {
                                const childrenAsObjects = (0, addGTIdentifierToSyntaxTree_1.default)(componentObj.tree);
                                console.log(`Found <T> component in ${file} with id "${id}".`);
                                updates.push({
                                    type: "jsx",
                                    data: {
                                        source: childrenAsObjects,
                                        metadata: componentObj.props
                                    }
                                });
                            }
                        }
                        else {
                            console.warn(`Found <T> component in ${file} with no id. <T> components without IDs are translated at runtime.`);
                        }
                    }
                },
            });
        }
        yield Promise.all(updates.map((update) => __awaiter(this, void 0, void 0, function* () {
            const context = update.data.metadata.context;
            const hash = (0, internal_1.hashReactChildrenObjects)(context ? [update.data.children, context] : update.data.children);
            update.data.metadata.hash = hash;
        })));
        return updates;
    });
}
