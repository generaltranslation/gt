import * as t from '@babel/types';
import traverse from '@babel/traverse';
import { ParseResult } from '@babel/parser';
import * as babel from '@babel/types';

export function determineModuleType(ast: ParseResult<t.File>) {
  let isESM = false;
  traverse(ast, {
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

export function generateImports(
  needsImport: string[],
  isESM: boolean,
  importMap: Record<string, { name: string; source: string }>
) {
  // Group imports by their source
  const importsBySource = needsImport.reduce(
    (acc, imp) => {
      const importInfo = importMap[imp as keyof typeof importMap];
      const source = importInfo.source;
      if (!acc[source]) acc[source] = [];
      acc[source].push({ local: imp, imported: importInfo.name });
      return acc;
    },
    {} as Record<string, { local: string; imported: string }[]>
  );

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

export function generateImportMap(ast: ParseResult<t.File>, framework: string) {
  let importAlias = { TComponent: 'T', VarComponent: 'Var' };
  // Check existing imports
  let initialImports: string[] = [];
  traverse(ast, {
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

export function insertImports(
  ast: ParseResult<t.File>,
  importNodes: (t.ImportDeclaration | t.VariableDeclaration)[]
) {
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

export function createImports(
  ast: ParseResult<t.File>,
  needsImport: string[],
  importMap: Record<string, { name: string; source: string }>
) {
  const isESM = determineModuleType(ast);

  const importNodes = generateImports(needsImport, isESM, importMap);

  insertImports(ast, importNodes);
}
