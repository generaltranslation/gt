"use strict";
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
const id_1 = require("generaltranslation/id");
const parseJsx_1 = require("../jsx/parseJsx");
const parseStringFunction_1 = require("../jsx/parse/parseStringFunction");
const parseAst_1 = require("../jsx/parse/parseAst");
function createInlineUpdates(options, pkg) {
    return __awaiter(this, void 0, void 0, function* () {
        const updates = [];
        const errors = [];
        // Use the provided app directory or default to the current directory
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
            const translationFuncs = [
                'useGT',
                'getGT',
                'T',
                'Var',
                'DateTime',
                'Currency',
                'Num',
                'Branch',
                'Plural',
            ];
            const importAliases = {};
            // handle imports & alias & handle string functions
            (0, traverse_1.default)(ast, {
                ImportDeclaration(path) {
                    if (path.node.source.value.startsWith(pkg)) {
                        const importName = (0, parseAst_1.extractImportName)(path.node, pkg, translationFuncs);
                        for (const name of importName) {
                            if (name.original === 'useGT' || name.original === 'getGT') {
                                (0, parseStringFunction_1.parseStrings)(name.local, path, updates, errors, file);
                            }
                            else {
                                importAliases[name.local] = name.original;
                            }
                        }
                    }
                },
                VariableDeclarator(path) {
                    var _a;
                    // Check if the init is a require call
                    if (((_a = path.node.init) === null || _a === void 0 ? void 0 : _a.type) === 'CallExpression' &&
                        path.node.init.callee.type === 'Identifier' &&
                        path.node.init.callee.name === 'require') {
                        // Check if it's requiring our package
                        const args = path.node.init.arguments;
                        if (args.length === 1 &&
                            args[0].type === 'StringLiteral' &&
                            args[0].value.startsWith(pkg)) {
                            const parentPath = path.parentPath;
                            if (parentPath.isVariableDeclaration()) {
                                const importName = (0, parseAst_1.extractImportName)(parentPath.node, pkg, translationFuncs);
                                for (const name of importName) {
                                    if (name.original === 'useGT' || name.original === 'getGT') {
                                        (0, parseStringFunction_1.parseStrings)(name.local, parentPath, updates, errors, file);
                                    }
                                    else {
                                        importAliases[name.local] = name.original;
                                    }
                                }
                            }
                        }
                    }
                },
            });
            // Parse <T> components
            (0, traverse_1.default)(ast, {
                JSXElement(path) {
                    (0, parseJsx_1.parseJSXElement)(importAliases, path.node, updates, errors, file);
                },
            });
        }
        // Post-process to add a hash to each update
        yield Promise.all(updates.map((update) => __awaiter(this, void 0, void 0, function* () {
            const context = update.metadata.context;
            const hash = (0, id_1.hashJsxChildren)(Object.assign(Object.assign({ source: update.source }, (context && { context })), (update.metadata.id && { id: update.metadata.id })));
            update.metadata.hash = hash;
        })));
        console.log('updates', updates);
        return { updates, errors };
    });
}
