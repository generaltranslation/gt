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
exports.default = scanForContent;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const t = __importStar(require("@babel/types"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
const babel = __importStar(require("@babel/types"));
const wrapJsx_1 = require("../jsx/wrapJsx");
const isStaticExpression_1 = require("../jsx/isStaticExpression");
const MEANINGFUL_REGEX = /[\p{L}\p{N}]/u;
/**
 * Checks if a node is meaningful. Does not recurse into children.
 * @param node - The node to check
 * @returns Whether the node is meaningful
 */
function isMeaningful(node) {
    if (t.isStringLiteral(node) || t.isJSXText(node)) {
        return MEANINGFUL_REGEX.test(node.value);
    }
    // Handle template literals without expressions
    if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
        return MEANINGFUL_REGEX.test(node.quasis[0].value.raw);
    }
    if (t.isJSXExpressionContainer(node)) {
        const value = (0, isStaticExpression_1.isStaticExpression)(node.expression);
        if (value.isStatic && value.value) {
            return MEANINGFUL_REGEX.test(value.value);
        }
    }
    if (t.isBinaryExpression(node)) {
        if (node.operator === '+') {
            return isMeaningful(node.left) || isMeaningful(node.right);
        }
    }
    return false;
}
const IMPORT_MAP = {
    T: { name: 'T', source: '{framework}' },
    Var: { name: 'Var', source: '{framework}' },
    GTT: { name: 'T', source: '{framework}' },
    GTVar: { name: 'Var', source: '{framework}' },
    GTProvider: { name: 'GTProvider', source: '{framework}' },
    getLocale: { name: 'getLocale', source: '{framework}/server' },
};
/**
 * Wraps all JSX elements in the src directory with a <T> tag, with unique ids.
 * - Ignores pure strings
 *
 * @param options - The options object
 * @returns An object containing the updates and errors
 */
function scanForContent(options, framework) {
    return __awaiter(this, void 0, void 0, function* () {
        const errors = [];
        const warnings = [];
        const srcDirectory = options.src || ['./'];
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
        const files = srcDirectory.flatMap((dir) => getFiles(dir));
        const filesUpdated = [];
        for (const file of files) {
            const code = fs_1.default.readFileSync(file, 'utf8');
            // Create relative path from src directory and remove extension
            const relativePath = path_1.default
                .relative(srcDirectory[0], file.replace(/\.[^/.]+$/, '') // Remove file extension
            )
                .replace(/\\/g, '.') // Replace Windows backslashes with dots
                .split(/[./]/) // Split on dots or forward slashes
                .filter(Boolean) // Remove empty segments that might cause extra dots
                .map((segment) => segment.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()) // Convert each segment to snake case
                .join('.'); // Rejoin with dots
            let ast;
            try {
                ast = (0, parser_1.parse)(code, {
                    sourceType: 'module',
                    plugins: ['jsx', 'typescript'],
                    tokens: true,
                    createParenthesizedExpressions: true,
                });
            }
            catch (error) {
                console.error(`Error parsing file ${file}:`, error);
                errors.push(`Failed to parse ${file}: ${error}`);
                continue;
            }
            let modified = false;
            let importAlias = { TComponent: 'T', VarComponent: 'Var' };
            // Check existing imports
            let initialImports = [];
            let usedImports = [];
            (0, traverse_1.default)(ast, {
                ImportDeclaration(path) {
                    const source = path.node.source.value;
                    if (source === framework) {
                        initialImports = [
                            ...initialImports,
                            ...path.node.specifiers.map((spec) => spec.local.name),
                        ];
                    }
                    // Check for conflicting imports only if they're not from gt-next/gt-react
                    if (source !== framework) {
                        path.node.specifiers.forEach((spec) => {
                            if (babel.isImportSpecifier(spec)) {
                                if (spec.local.name === 'T')
                                    importAlias.TComponent = 'GTT';
                                if (spec.local.name === 'Var')
                                    importAlias.VarComponent = 'GTVar';
                            }
                        });
                    }
                },
            });
            // If the file already has a T import, skip processing it
            if (initialImports.includes(IMPORT_MAP.T.name)) {
                continue;
            }
            let globalId = 0;
            (0, traverse_1.default)(ast, {
                JSXElement(path) {
                    // Check if this JSX element has any JSX element ancestors
                    let currentPath = path;
                    while (currentPath.parentPath) {
                        if (t.isJSXElement(currentPath.parentPath.node)) {
                            // If we found a JSX parent, skip processing this node
                            return;
                        }
                        currentPath = currentPath.parentPath;
                    }
                    // At this point, we're only processing top-level JSX elements
                    const opts = Object.assign(Object.assign({}, importAlias), { idPrefix: relativePath, idCount: globalId, usedImports, modified: false });
                    const wrapped = (0, wrapJsx_1.handleJsxElement)(path.node, opts, isMeaningful);
                    path.replaceWith(wrapped);
                    path.skip();
                    // Update global counters
                    modified = opts.modified;
                    globalId = opts.idCount;
                },
            });
            if (!modified)
                continue;
            let needsImport = usedImports.filter((imp) => !initialImports.includes(imp));
            if (needsImport.length > 0) {
                // Check if file uses ESM or CommonJS
                let isESM = false;
                (0, traverse_1.default)(ast, {
                    ImportDeclaration() {
                        isESM = true;
                    },
                    ExportDefaultDeclaration() {
                        isESM = true;
                    },
                    ExportNamedDeclaration() {
                        isESM = true;
                    },
                });
                // Group imports by their source
                const importsBySource = needsImport.reduce((acc, imp) => {
                    const importInfo = IMPORT_MAP[imp];
                    const source = importInfo.source.replace('{framework}', framework);
                    if (!acc[source])
                        acc[source] = [];
                    acc[source].push({ local: imp, imported: importInfo.name });
                    return acc;
                }, {});
                // Generate import nodes for each source
                const importNodes = Object.entries(importsBySource).map(([source, imports]) => {
                    if (isESM) {
                        return babel.importDeclaration(imports.map((imp) => babel.importSpecifier(babel.identifier(imp.imported), babel.identifier(imp.local))), babel.stringLiteral(source));
                    }
                    else {
                        return babel.variableDeclaration('const', [
                            babel.variableDeclarator(babel.objectPattern(imports.map((imp) => babel.objectProperty(babel.identifier(imp.local), babel.identifier(imp.imported), false, imp.local === imp.imported))), babel.callExpression(babel.identifier('require'), [
                                babel.stringLiteral(source),
                            ])),
                        ]);
                    }
                });
                // Find the best position to insert the imports
                let insertIndex = 0;
                for (let i = 0; i < ast.program.body.length; i++) {
                    if (!babel.isImportDeclaration(ast.program.body[i])) {
                        insertIndex = i;
                        break;
                    }
                    insertIndex = i + 1;
                }
                // Insert all import nodes
                ast.program.body.splice(insertIndex, 0, ...importNodes);
            }
            try {
                const output = (0, generator_1.default)(ast, {
                    retainLines: true,
                    retainFunctionParens: true,
                    comments: true,
                    compact: 'auto',
                }, code);
                // Post-process the output to fix import spacing
                let processedCode = output.code;
                if (needsImport.length > 0) {
                    // Add newline after the comment only
                    processedCode = processedCode.replace(/((?:import\s*{\s*(?:T|GTT|Var|GTVar|GTProvider|getLocale)(?:\s*,\s*(?:T|GTT|Var|GTVar|GTProvider|getLocale))*\s*}\s*from|const\s*{\s*(?:T|GTT|Var|GTVar|GTProvider|getLocale)(?:\s*,\s*(?:T|GTT|Var|GTVar|GTProvider|getLocale))*\s*}\s*=\s*require)\s*['"]gt-(?:next|react)(?:\/server)?['"];?)/, '\n$1\n');
                }
                // Write the modified code back to the file
                fs_1.default.writeFileSync(file, processedCode);
                filesUpdated.push(file);
            }
            catch (error) {
                console.error(`Error writing file ${file}:`, error);
                errors.push(`Failed to write ${file}: ${error}`);
            }
        }
        return { errors, filesUpdated, warnings };
    });
}
