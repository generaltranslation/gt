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
exports.determineModuleType = determineModuleType;
exports.generateImports = generateImports;
exports.generateImportMap = generateImportMap;
exports.insertImports = insertImports;
exports.createImports = createImports;
exports.extractImportName = extractImportName;
const traverse_1 = __importDefault(require("@babel/traverse"));
const babel = __importStar(require("@babel/types"));
function determineModuleType(ast) {
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
    return isESM;
}
function generateImports(needsImport, isESM, importMap) {
    // Group imports by their source
    const importsBySource = needsImport.reduce((acc, imp) => {
        if (typeof imp === 'string') {
            // Handle standard GT component imports
            const importInfo = importMap[imp];
            const source = importInfo.source;
            if (!acc[source])
                acc[source] = [];
            acc[source].push({ local: imp, imported: importInfo.name });
        }
        else {
            // Handle custom imports (like config)
            const source = imp.source;
            if (!acc[source])
                acc[source] = [];
            acc[source].push({ local: imp.local, imported: imp.imported });
        }
        return acc;
    }, {});
    // Generate import nodes for each source
    const importNodes = Object.entries(importsBySource).map(([source, imports]) => {
        if (isESM) {
            return babel.importDeclaration(imports.map((imp) => imp.imported === 'default'
                ? babel.importDefaultSpecifier(babel.identifier(imp.local))
                : babel.importSpecifier(babel.identifier(imp.local), babel.identifier(imp.imported))), babel.stringLiteral(source));
        }
        else {
            // For CommonJS, handle default imports differently
            return babel.variableDeclaration('const', [
                babel.variableDeclarator(imports.some((imp) => imp.imported === 'default')
                    ? babel.identifier(imports[0].local)
                    : babel.objectPattern(imports.map((imp) => babel.objectProperty(babel.identifier(imp.local), babel.identifier(imp.imported), false, imp.local === imp.imported))), babel.callExpression(babel.identifier('require'), [
                    babel.stringLiteral(source),
                ])),
            ]);
        }
    });
    return importNodes;
}
function generateImportMap(ast, pkg) {
    let importAlias = { TComponent: 'T', VarComponent: 'Var' };
    // Check existing imports
    let initialImports = [];
    (0, traverse_1.default)(ast, {
        ImportDeclaration(path) {
            const source = path.node.source.value;
            if (source === pkg) {
                initialImports = [
                    ...initialImports,
                    ...path.node.specifiers.map((spec) => spec.local.name),
                ];
            }
            // Check for conflicting imports only if they're not from gt libraries
            if (source !== pkg) {
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
    return { initialImports, importAlias };
}
function insertImports(ast, importNodes) {
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
function createImports(ast, needsImport, importMap) {
    const isESM = determineModuleType(ast);
    const importNodes = generateImports(needsImport, isESM, importMap);
    insertImports(ast, importNodes);
}
function extractImportName(node, pkg, translationFuncs) {
    var _a, _b, _c, _d, _e, _f;
    if (node.type === 'ImportDeclaration') {
        // Handle ES6 imports
        if (node.source.value.startsWith(pkg)) {
            for (const specifier of node.specifiers) {
                if (specifier.type === 'ImportSpecifier' &&
                    'name' in specifier.imported &&
                    translationFuncs.includes(specifier.imported.name)) {
                    return {
                        local: specifier.local.name,
                        original: specifier.imported.name,
                    };
                }
            }
        }
    }
    else if (node.type === 'VariableDeclaration') {
        // Handle CJS requires
        for (const declaration of node.declarations) {
            // Handle direct require with destructuring
            if (((_a = declaration.init) === null || _a === void 0 ? void 0 : _a.type) === 'CallExpression' &&
                declaration.init.callee.type === 'Identifier' &&
                declaration.init.callee.name === 'require' &&
                ((_b = declaration.init.arguments[0]) === null || _b === void 0 ? void 0 : _b.type) === 'StringLiteral' &&
                declaration.init.arguments[0].value.startsWith(pkg)) {
                // Handle destructuring case: const { T } = require('gt-next')
                if (declaration.id.type === 'ObjectPattern') {
                    for (const prop of declaration.id.properties) {
                        if (prop.type === 'ObjectProperty' &&
                            prop.key.type === 'Identifier' &&
                            translationFuncs.includes(prop.key.name) &&
                            prop.value.type === 'Identifier') {
                            return {
                                local: prop.value.name,
                                original: prop.key.name,
                            };
                        }
                    }
                }
                // Handle intermediate variable case: const temp = require('gt-next')
                else if (declaration.id.type === 'Identifier') {
                    const requireVarName = declaration.id.name;
                    const parentBody = (_c = node.parent) === null || _c === void 0 ? void 0 : _c.body;
                    if (parentBody) {
                        for (let i = 0; i < parentBody.length; i++) {
                            const stmt = parentBody[i];
                            if (stmt.type === 'VariableDeclaration' &&
                                ((_e = (_d = stmt.declarations[0]) === null || _d === void 0 ? void 0 : _d.init) === null || _e === void 0 ? void 0 : _e.type) === 'MemberExpression' &&
                                stmt.declarations[0].init.object.type === 'Identifier' &&
                                stmt.declarations[0].init.object.name === requireVarName &&
                                stmt.declarations[0].init.property.type === 'Identifier' &&
                                translationFuncs.includes(stmt.declarations[0].init.property.name)) {
                                return {
                                    local: stmt.declarations[0].id.name,
                                    original: stmt.declarations[0].init.property.name,
                                };
                            }
                        }
                    }
                }
            }
            // Handle member expression assignment: const TranslateFunc = temp.T
            if (((_f = declaration.init) === null || _f === void 0 ? void 0 : _f.type) === 'MemberExpression' &&
                declaration.init.property.type === 'Identifier' &&
                translationFuncs.includes(declaration.init.property.name) &&
                declaration.id.type === 'Identifier') {
                return {
                    local: declaration.id.name,
                    original: declaration.init.property.name,
                };
            }
        }
    }
    return null;
}
