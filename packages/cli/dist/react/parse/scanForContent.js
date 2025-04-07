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
exports.default = scanForContent;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const t = __importStar(require("@babel/types"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
const findJsxFilepath_1 = require("../../fs/findJsxFilepath");
const evaluateJsx_1 = require("../jsx/evaluateJsx");
const wrapJsx_1 = require("../jsx/wrapJsx");
const findFilepath_1 = require("../../fs/findFilepath");
const parseAst_1 = require("../jsx/utils/parseAst");
const IMPORT_MAP = {
    T: { name: 'T', source: 'gt-react' },
    Var: { name: 'Var', source: 'gt-react' },
    GTT: { name: 'T', source: 'gt-react' },
    GTVar: { name: 'Var', source: 'gt-react' },
    GTProvider: { name: 'GTProvider', source: 'gt-react' },
    // getLocale: { name: 'getLocale', source: 'gt-react/server' },
};
/**
 * Wraps all JSX elements in the src directory with a <T> tag, with unique ids.
 * - Ignores pure strings
 *
 * @param options - The options object
 * @returns An object containing the updates and errors
 */
function scanForContent(options, pkg, framework) {
    return __awaiter(this, void 0, void 0, function* () {
        const errors = [];
        const warnings = [];
        const srcDirectory = options.src || ['./'];
        const files = srcDirectory.flatMap((dir) => (0, findJsxFilepath_1.getFiles)(dir));
        const filesUpdated = [];
        for (const file of files) {
            const baseFileName = path_1.default.basename(file);
            const configPath = path_1.default.relative(path_1.default.dirname(file), path_1.default.resolve(process.cwd(), options.config));
            // Ensure the path starts with ./ or ../
            const normalizedConfigPath = configPath.startsWith('.')
                ? configPath
                : './' + configPath;
            const code = fs_1.default.readFileSync(file, 'utf8');
            // Create relative path from src directory and remove extension
            const relativePath = (0, findFilepath_1.getRelativePath)(file, srcDirectory[0]);
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
            let usedImports = [];
            let { importAlias, initialImports } = (0, parseAst_1.generateImportMap)(ast, pkg);
            // If the file already has a T import, skip processing it
            if (initialImports.includes(IMPORT_MAP.T.name)) {
                continue;
            }
            let globalId = 0;
            (0, traverse_1.default)(ast, {
                JSXElement(path) {
                    var _a;
                    if (framework === 'next-pages' &&
                        options.addGTProvider &&
                        (baseFileName === '_app.tsx' || baseFileName === '_app.jsx')) {
                        // Check if this is the Component element with pageProps
                        const isComponentWithPageProps = t.isJSXElement(path.node) &&
                            t.isJSXIdentifier(path.node.openingElement.name) &&
                            path.node.openingElement.name.name === 'Component' &&
                            path.node.openingElement.attributes.some((attr) => t.isJSXSpreadAttribute(attr) &&
                                t.isIdentifier(attr.argument) &&
                                attr.argument.name === 'pageProps');
                        if (!isComponentWithPageProps) {
                            return;
                        }
                        // Check if GTProvider already exists in the ancestors
                        let hasGTProvider = false;
                        let currentPath = path;
                        while (currentPath.parentPath) {
                            if (t.isJSXElement(currentPath.node) &&
                                t.isJSXIdentifier(currentPath.node.openingElement.name) &&
                                currentPath.node.openingElement.name.name === 'GTProvider') {
                                hasGTProvider = true;
                                break;
                            }
                            currentPath = currentPath.parentPath;
                        }
                        if (!hasGTProvider) {
                            // Wrap the Component element with GTProvider
                            const gtProviderJsx = t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('GTProvider'), [t.jsxSpreadAttribute(t.identifier('gtConfig'))], false), t.jsxClosingElement(t.jsxIdentifier('GTProvider')), [path.node]);
                            path.replaceWith(gtProviderJsx);
                            usedImports.push('GTProvider');
                            usedImports.push({
                                local: 'gtConfig',
                                imported: 'default',
                                source: normalizedConfigPath,
                            });
                            modified = true;
                            path.skip();
                            return;
                        }
                    }
                    // Check if this JSX element has any JSX element ancestors
                    let currentPath = path;
                    if (t.isJSXElement((_a = currentPath.parentPath) === null || _a === void 0 ? void 0 : _a.node)) {
                        // If we found a JSX parent, skip processing this node
                        return;
                    }
                    // At this point, we're only processing top-level JSX elements
                    const opts = Object.assign(Object.assign({}, importAlias), { idPrefix: relativePath, idCount: globalId, usedImports, modified: false, createIds: !options.disableIds, warnings,
                        file });
                    const wrapped = (0, wrapJsx_1.handleJsxElement)(path.node, opts, evaluateJsx_1.isMeaningful);
                    path.replaceWith(wrapped.node);
                    // Update global counters
                    modified = modified || opts.modified;
                    globalId = opts.idCount;
                },
            });
            if (!modified)
                continue;
            let needsImport = usedImports.filter((imp) => typeof imp === 'string'
                ? !initialImports.includes(imp)
                : !initialImports.includes(imp.local));
            if (needsImport.length > 0) {
                (0, parseAst_1.createImports)(ast, needsImport, IMPORT_MAP);
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
