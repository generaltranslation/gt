/**
 * Helpers for finding and managing GT import declarations in ESLint fixers.
 * Shared across rules that auto-fix by adding component imports.
 */

import { TSESTree } from '@typescript-eslint/utils';
import type { RuleFixer } from '@typescript-eslint/utils/ts-eslint';
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint';

/**
 * Collects all import declarations whose source matches one of the
 * configured GT library names.
 */
export function getGTImportDecls(
  sourceCode: SourceCode,
  libs: readonly string[]
): TSESTree.ImportDeclaration[] {
  return sourceCode.ast.body.filter(
    (stmt): stmt is TSESTree.ImportDeclaration =>
      stmt.type === TSESTree.AST_NODE_TYPES.ImportDeclaration &&
      libs.includes(stmt.source.value as string)
  );
}

/**
 * Searches across all GT import declarations for a named import specifier
 * matching `componentName`. Returns the specifier (which carries the local
 * alias) or undefined.
 */
export function findImportedSpecifier(
  gtImportDecls: TSESTree.ImportDeclaration[],
  componentName: string
): TSESTree.ImportSpecifier | undefined {
  for (const decl of gtImportDecls) {
    const spec = decl.specifiers.find(
      (s): s is TSESTree.ImportSpecifier =>
        s.type === TSESTree.AST_NODE_TYPES.ImportSpecifier &&
        s.imported.type === TSESTree.AST_NODE_TYPES.Identifier &&
        s.imported.name === componentName
    );
    if (spec) return spec;
  }
  return undefined;
}

/**
 * Returns the local tag name for `componentName`. If the component is
 * already imported (possibly aliased), returns the alias. Otherwise
 * appends an import-fix to `fixes` and returns the canonical name.
 *
 * NOTE: If the GT import has no named specifiers (e.g. namespace import
 * `import * as GT from 'gt-react'`), no import fix is emitted. The
 * generated JSX will reference the canonical name without a matching
 * import — this is acceptable because namespace imports don't currently
 * trigger the rule's component detection via `isGTFunction`.
 */
export function addComponentImport(
  gtImportDecls: TSESTree.ImportDeclaration[],
  componentName: string,
  fixes: ReturnType<RuleFixer['replaceText']>[],
  fixer: RuleFixer
): string {
  const spec = findImportedSpecifier(gtImportDecls, componentName);
  if (spec) return spec.local.name;
  if (gtImportDecls.length > 0) {
    const namedSpecs = gtImportDecls[0].specifiers.filter(
      (s): s is TSESTree.ImportSpecifier =>
        s.type === TSESTree.AST_NODE_TYPES.ImportSpecifier
    );
    if (namedSpecs.length > 0) {
      fixes.push(
        fixer.insertTextAfter(
          namedSpecs[namedSpecs.length - 1],
          `, ${componentName}`
        )
      );
    }
  }
  return componentName;
}
