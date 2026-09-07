import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

function headerDeclaration(node: t.Node): boolean {
  if (t.isExportNamedDeclaration(node) && node.declaration)
    return headerDeclaration(node.declaration);
  return (
    t.isImportDeclaration(node) ||
    t.isTSTypeAliasDeclaration(node) ||
    t.isTSInterfaceDeclaration(node) ||
    t.isTSDeclareFunction(node) ||
    t.isTSEnumDeclaration(node) ||
    t.isTSModuleDeclaration(node) ||
    ((t.isClassDeclaration(node) || t.isVariableDeclaration(node)) &&
      !!node.declare)
  );
}

/** Insert helpers without moving JSX directives onto imports the host may erase. */
export function prependImport(
  program: NodePath<t.Program>,
  declaration: t.ImportDeclaration
): NodePath<t.ImportDeclaration> {
  const first = program.node.body[0];
  // A leading type-only item's comment also belongs to the module. Keep that
  // item first so its directive survives the host's later TypeScript erasure.
  const afterFirst = first && headerDeclaration(first);
  const next = program.node.body[afterFirst ? 1 : 0];
  const previous = afterFirst ? first : program.node.directives.at(-1);
  if (previous && next?.leadingComments?.length) {
    // Babel attaches an inter-item leading comment to both adjacent nodes.
    // Printing it from the earlier node would make it belong to our new import.
    const leading = new Set(next.leadingComments);
    previous.trailingComments = previous.trailingComments?.filter(
      (comment) => !leading.has(comment)
    );
  }
  return afterFirst
    ? (program
        .get('body')[0]
        .insertAfter(declaration)[0] as NodePath<t.ImportDeclaration>)
    : program.unshiftContainer('body', declaration)[0];
}
