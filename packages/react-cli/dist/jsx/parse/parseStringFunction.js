"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStrings = parseStrings;
function parseStrings(path, updates, errors, file, pkg) {
    const translationFuncs = ['useStringTranslation', 'getStringTranslation']; // placeholder for now
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
                        updates.push({
                            type: 'content',
                            source: arg.value,
                            metadata: {},
                        });
                    }
                }
            });
        }
    });
}
