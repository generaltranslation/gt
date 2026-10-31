import * as t from '@babel/types';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import type { TreeContext } from './types.js';

/** Original name of the unstable helper a callee or tag refers to. */
export function getHelperName(
  callee: t.Node,
  context: TreeContext
): string | undefined {
  const imported = getNamedImport(callee, context);
  if (imported && isUnstableGTImportSource(imported.source)) {
    return imported.name;
  }
}

export function getNamedImport(
  callee: t.Node,
  context: TreeContext
): { name: string; source: string } | undefined {
  if (!t.isIdentifier(callee)) return;
  const binding = context.scopePath.scope.getBinding(callee.name);
  if (
    !binding?.path.isImportSpecifier() ||
    !binding.path.parentPath.isImportDeclaration()
  ) {
    return;
  }
  return {
    name: getImportedName(binding.path.node),
    source: binding.path.parentPath.node.source.value,
  };
}

export function getImportedName(specifier: t.ImportSpecifier): string {
  return t.isIdentifier(specifier.imported)
    ? specifier.imported.name
    : specifier.imported.value;
}
