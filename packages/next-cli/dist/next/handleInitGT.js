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
exports.default = handleInitGT;
const fs_1 = __importDefault(require("fs"));
const parser_1 = require("@babel/parser");
const generator_1 = __importDefault(require("@babel/generator"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
function handleInitGT(filepath) {
    return __awaiter(this, void 0, void 0, function* () {
        const errors = [];
        const warnings = [];
        const filesUpdated = [];
        const code = fs_1.default.readFileSync(filepath, 'utf8');
        let ast;
        try {
            ast = (0, parser_1.parse)(code, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
                tokens: true,
                createParenthesizedExpressions: true,
            });
            // Add import statement for withGTConfig
            ast.program.body.unshift(t.importDeclaration([t.importDefaultSpecifier(t.identifier('withGTConfig'))], t.stringLiteral('gt-next/config')));
            // Find and transform the default export
            (0, traverse_1.default)(ast, {
                ExportDefaultDeclaration(path) {
                    const oldExport = path.node.declaration;
                    let exportExpression;
                    if (t.isFunctionDeclaration(oldExport)) {
                        exportExpression = t.functionExpression(oldExport.id, oldExport.params, oldExport.body, oldExport.generator, oldExport.async);
                    }
                    else if (t.isClassDeclaration(oldExport)) {
                        exportExpression = t.classExpression(oldExport.id, oldExport.superClass, oldExport.body, oldExport.decorators);
                    }
                    else if (t.isTSDeclareFunction(oldExport)) {
                        // For TypeScript declare functions, create an empty function expression
                        // since declare functions don't have a runtime implementation
                        warnings.push(`Found TypeScript declare function in ${filepath}. Converting to empty function.`);
                        exportExpression = t.functionExpression(oldExport.id, oldExport.params, t.blockStatement([]), false, false);
                    }
                    else {
                        exportExpression = oldExport;
                    }
                    // Validate that we have a valid Next.js config export
                    if (!t.isObjectExpression(exportExpression) &&
                        !t.isFunctionExpression(exportExpression) &&
                        !t.isArrowFunctionExpression(exportExpression)) {
                        warnings.push(`Unexpected export type in ${filepath}. Next.js config should export an object or a function returning an object.`);
                    }
                    path.node.declaration = t.callExpression(t.identifier('withGTConfig'), [
                        exportExpression,
                        t.objectExpression([]),
                    ]);
                },
            });
            // Generate the modified code
            const output = (0, generator_1.default)(ast, {
                retainLines: true,
                retainFunctionParens: true,
                comments: true,
                compact: 'auto',
            }, code);
            // Write the changes back to the file
            fs_1.default.writeFileSync(filepath, output.code);
            filesUpdated.push(filepath);
        }
        catch (error) {
            console.error(`Error parsing file ${filepath}:`, error);
            errors.push(`Failed to parse ${filepath}: ${error}`);
        }
        return { errors, filesUpdated, warnings };
    });
}
