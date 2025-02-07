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
const t = __importStar(require("@babel/types"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
const findJsxFilepath_1 = require("gt-react-cli/fs/findJsxFilepath");
const evaluateJsx_1 = require("gt-react-cli/jsx/evaluateJsx");
const wrapJsx_1 = require("gt-react-cli/jsx/wrapJsx");
const findFilepath_1 = require("gt-react-cli/fs/findFilepath");
const parseAst_1 = require("gt-react-cli/jsx/parse/parseAst");
const IMPORT_MAP = {
    T: { name: 'T', source: 'gt-next' },
    Var: { name: 'Var', source: 'gt-next' },
    GTT: { name: 'T', source: 'gt-next' },
    GTVar: { name: 'Var', source: 'gt-next' },
    GTProvider: { name: 'GTProvider', source: 'gt-next' },
    getLocale: { name: 'getLocale', source: 'gt-next/server' },
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
        const files = srcDirectory.flatMap((dir) => (0, findJsxFilepath_1.getFiles)(dir));
        const filesUpdated = [];
        for (const file of files) {
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
            let { importAlias, initialImports } = (0, parseAst_1.generateImportMap)(ast, framework);
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
                    const opts = Object.assign(Object.assign({}, importAlias), { idPrefix: relativePath, idCount: globalId, usedImports, modified: false, createIds: !options.disableIds });
                    const wrapped = (0, wrapJsx_1.handleJsxElement)(path.node, opts, evaluateJsx_1.isMeaningful);
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
