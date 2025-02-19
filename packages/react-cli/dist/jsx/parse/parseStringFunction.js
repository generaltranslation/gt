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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStrings = parseStrings;
const generaltranslation_1 = require("generaltranslation");
const t = __importStar(require("@babel/types"));
const evaluateJsx_1 = require("../evaluateJsx");
function parseStrings(path, updates, errors, file, pkg) {
    const translationFuncs = ['useGT', 'getGT']; // placeholder for now
    if (path.node.type === 'ImportDeclaration') {
        // Handle ES6 imports
        if (path.node.source.value === pkg) {
            path.node.specifiers.forEach((specifier) => {
                if (specifier.type === 'ImportSpecifier' &&
                    'name' in specifier.imported &&
                    translationFuncs.includes(specifier.imported.name)) {
                    handleTranslationFunction(specifier.local.name, path, updates);
                }
            });
        }
    }
    else if (path.node.type === 'VariableDeclaration') {
        // Handle CJS requires
        path.node.declarations.forEach((declaration) => {
            var _a, _b;
            if (((_a = declaration.init) === null || _a === void 0 ? void 0 : _a.type) === 'CallExpression' &&
                declaration.init.callee.type === 'Identifier' &&
                declaration.init.callee.name === 'require' &&
                ((_b = declaration.init.arguments[0]) === null || _b === void 0 ? void 0 : _b.type) === 'StringLiteral' &&
                declaration.init.arguments[0].value === pkg &&
                declaration.id.type === 'ObjectPattern') {
                declaration.id.properties.forEach((prop) => {
                    if (prop.type === 'ObjectProperty' &&
                        prop.key.type === 'Identifier' &&
                        translationFuncs.includes(prop.key.name) &&
                        prop.value.type === 'Identifier') {
                        handleTranslationFunction(prop.value.name, path, updates);
                    }
                });
            }
        });
    }
}
function handleTranslationFunction(importName, path, updates) {
    var _a;
    (_a = path.scope.bindings[importName]) === null || _a === void 0 ? void 0 : _a.referencePaths.forEach((refPath) => {
        var _a;
        const varDecl = refPath.findParent((p) => p.isVariableDeclarator());
        if (varDecl && varDecl.node.id.type === 'Identifier') {
            const tFuncName = varDecl.node.id.name;
            (_a = path.scope.bindings[tFuncName]) === null || _a === void 0 ? void 0 : _a.referencePaths.forEach((tPath) => {
                if (tPath.parent.type === 'CallExpression' &&
                    tPath.parent.arguments.length > 0) {
                    const arg = tPath.parent.arguments[0];
                    if (arg.type === 'StringLiteral') {
                        const source = arg.value;
                        const content = (0, generaltranslation_1.splitStringToContent)(source);
                        const options = tPath.parent.arguments[1];
                        let metadata = {};
                        // Only process options if they exist
                        if (options && options.type === 'ObjectExpression') {
                            options.properties.forEach((prop) => {
                                if (prop.type === 'ObjectProperty' &&
                                    prop.key.type === 'Identifier') {
                                    // Check for id property
                                    if (prop.key.name === 'id' && t.isExpression(prop.value)) {
                                        const idResult = (0, evaluateJsx_1.isStaticExpression)(prop.value);
                                        if (idResult.isStatic && idResult.value) {
                                            metadata.id = idResult.value;
                                        }
                                    }
                                    // Check for context property
                                    if (prop.key.name === 'context' &&
                                        t.isExpression(prop.value)) {
                                        const contextResult = (0, evaluateJsx_1.isStaticExpression)(prop.value);
                                        if (contextResult.isStatic && contextResult.value) {
                                            metadata.context = contextResult.value;
                                        }
                                    }
                                }
                            });
                        }
                        updates.push({
                            type: 'content',
                            source: content,
                            metadata,
                        });
                    }
                }
            });
        }
    });
}
