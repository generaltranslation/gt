import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

/**
 * Builds a map of imported function names to their import paths from a given program path.
 * Handles both named imports and default imports.
 *
 * Example: import { getInfo } from './constants' -> Map { 'getInfo' => './constants' }
 * Example: import utils from './utils' -> Map { 'utils' => './utils' }
 */
export function buildImportMap(programPath: NodePath): Map<string, string> {
  const importMap = new Map<string, string>();

  programPath.traverse({
    ImportDeclaration(importPath) {
      if (t.isStringLiteral(importPath.node.source)) {
        const importSource = importPath.node.source.value;
        importPath.node.specifiers.forEach((spec) => {
          if (
            t.isImportSpecifier(spec) &&
            t.isIdentifier(spec.imported) &&
            t.isIdentifier(spec.local)
          ) {
            importMap.set(spec.local.name, importSource);
          } else if (
            t.isImportDefaultSpecifier(spec) &&
            t.isIdentifier(spec.local)
          ) {
            importMap.set(spec.local.name, importSource);
          }
        });
      }
    },
  });

  return importMap;
}
