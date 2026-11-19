import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  isGTMessageHelperName,
  isGTMessageImportSource,
  type GTMessageHelperName,
} from 'generaltranslation/internal';

/** Original name of the message helper a callee or tag refers to. */
export function getHelperName(
  callee: NodePath
): GTMessageHelperName | undefined {
  const imported = getNamedImport(callee);
  if (
    imported &&
    isGTMessageImportSource(imported.source) &&
    isGTMessageHelperName(imported.name)
  ) {
    return imported.name;
  }
}

function getNamedImport(
  callee: NodePath
): { name: string; source: string } | undefined {
  if (!callee.isIdentifier()) return;
  const binding = callee.scope.getBinding(callee.node.name);
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
