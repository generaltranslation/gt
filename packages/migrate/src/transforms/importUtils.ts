import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

/**
 * Ensures `import { <names> } from '<module>'` exists, merging into an
 * existing declaration when present. Names already bound are not duplicated.
 */
export function ensureNamedImports(
  ast: t.File,
  module: string,
  names: string[]
): void {
  let target: t.ImportDeclaration | null = null;
  const present = new Set<string>();
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== module) return;
      if (!target) target = path.node;
      for (const specifier of path.node.specifiers) {
        if (t.isImportSpecifier(specifier)) {
          present.add(specifier.local.name);
        }
      }
    },
  });

  const missing = names.filter((name) => !present.has(name));
  if (missing.length === 0) return;
  const specifiers = missing.map((name) =>
    t.importSpecifier(t.identifier(name), t.identifier(name))
  );
  if (target) {
    (target as t.ImportDeclaration).specifiers.push(...specifiers);
    return;
  }
  const declaration = t.importDeclaration(specifiers, t.stringLiteral(module));
  const body = ast.program.body;
  let insertIndex = 0;
  while (
    insertIndex < body.length &&
    t.isImportDeclaration(body[insertIndex])
  ) {
    insertIndex += 1;
  }
  body.splice(insertIndex, 0, declaration);
}

/**
 * Drops import specifiers whose local names have no remaining references;
 * removes the whole declaration when it ends up empty. Only checks the
 * provided local names.
 */
export function removeUnusedNamedImports(ast: t.File, locals: string[]): void {
  const uses = new Map<string, number>(locals.map((name) => [name, 0]));
  traverse(ast, {
    Identifier(path) {
      if (!uses.has(path.node.name)) return;
      if (
        path.isReferencedIdentifier() &&
        !path.findParent((parent) => parent.isImportDeclaration())
      ) {
        uses.set(path.node.name, uses.get(path.node.name)! + 1);
      }
    },
    JSXIdentifier(path) {
      if (uses.has(path.node.name)) {
        uses.set(path.node.name, uses.get(path.node.name)! + 1);
      }
    },
  });

  traverse(ast, {
    ImportDeclaration(path) {
      // A declaration that was already specifier-less (a side-effect import
      // like `import './globals.css'`) is not this cleanup's to touch: only
      // remove a declaration this pruning itself emptied.
      if (path.node.specifiers.length === 0) return;
      path.node.specifiers = path.node.specifiers.filter((specifier) => {
        const local = specifier.local.name;
        return !uses.has(local) || uses.get(local)! > 0;
      });
      if (path.node.specifiers.length === 0) {
        path.remove();
      }
    },
  });
}
