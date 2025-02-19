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

export type ImportItem =
  | string
  | {
      local: string;
      imported: string;
      source: string;
    };

export function generateImports(
  needsImport: ImportItem[],
  isESM: boolean,
  importMap: Record<string, { name: string; source: string }>
) {
  // Group imports by their source
  const importsBySource = needsImport.reduce(
    (acc, imp) => {
      if (typeof imp === 'string') {
        // Handle standard GT component imports
        const importInfo = importMap[imp];
        const source = importInfo.source;
        if (!acc[source]) acc[source] = [];
        acc[source].push({ local: imp, imported: importInfo.name });
      } else {
        // Handle custom imports (like config)
        const source = imp.source;
        if (!acc[source]) acc[source] = [];
        acc[source].push({ local: imp.local, imported: imp.imported });
      }
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
            imp.imported === 'default'
              ? babel.importDefaultSpecifier(babel.identifier(imp.local))
              : babel.importSpecifier(
                  babel.identifier(imp.local),
                  babel.identifier(imp.imported)
                )
          ),
          babel.stringLiteral(source)
        );
      } else {
        // For CommonJS, handle default imports differently
        return babel.variableDeclaration('const', [
          babel.variableDeclarator(
            imports.some((imp) => imp.imported === 'default')
              ? babel.identifier(imports[0].local)
              : babel.objectPattern(
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

export function generateImportMap(ast: ParseResult<t.File>, pkg: string) {
  let importAlias = { TComponent: 'T', VarComponent: 'Var' };
  // Check existing imports
  let initialImports: string[] = [];
  traverse(ast, {
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
  needsImport: ImportItem[],
  importMap: Record<string, { name: string; source: string }>
) {
  const isESM = determineModuleType(ast);

  const importNodes = generateImports(needsImport, isESM, importMap);

  insertImports(ast, importNodes);
}
