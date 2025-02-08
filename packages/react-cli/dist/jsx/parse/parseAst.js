'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.determineModuleType = determineModuleType;
exports.generateImports = generateImports;
exports.generateImportMap = generateImportMap;
exports.insertImports = insertImports;
exports.createImports = createImports;
const traverse_1 = __importDefault(require('@babel/traverse'));
const babel = __importStar(require('@babel/types'));
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
    const importInfo = importMap[imp];
    const source = importInfo.source;
    if (!acc[source]) acc[source] = [];
    acc[source].push({ local: imp, imported: importInfo.name });
    return acc;
  }, {});
  // Generate import nodes for each source
  const importNodes = Object.entries(importsBySource).map(
    ([source, imports]) => {
      if (isESM) {
        return babel.importDeclaration(
          imports.map((imp) =>
            babel.importSpecifier(
              babel.identifier(imp.imported),
              babel.identifier(imp.local)
            )
          ),
          babel.stringLiteral(source)
        );
      } else {
        return babel.variableDeclaration('const', [
          babel.variableDeclarator(
            babel.objectPattern(
              imports.map((imp) =>
                babel.objectProperty(
                  babel.identifier(imp.local),
                  babel.identifier(imp.imported),
                  false,
                  imp.local === imp.imported
                )
              )
            ),
            babel.callExpression(babel.identifier('require'), [
              babel.stringLiteral(source),
            ])
          ),
        ]);
      }
    }
  );
  return importNodes;
}
function generateImportMap(ast, framework) {
  let importAlias = { TComponent: 'T', VarComponent: 'Var' };
  // Check existing imports
  let initialImports = [];
  (0, traverse_1.default)(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      if (source === framework) {
        initialImports = [
          ...initialImports,
          ...path.node.specifiers.map((spec) => spec.local.name),
        ];
      }
      // Check for conflicting imports only if they're not from gt libraries
      if (source !== framework) {
        path.node.specifiers.forEach((spec) => {
          if (babel.isImportSpecifier(spec)) {
            if (spec.local.name === 'T') importAlias.TComponent = 'GTT';
            if (spec.local.name === 'Var') importAlias.VarComponent = 'GTVar';
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
