import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

/**
 * The npm package a module specifier resolves to
 * ('@formatjs/intl-pluralrules/polyfill' -> '@formatjs/intl-pluralrules',
 * 'next-intl/server' -> 'next-intl').
 */
export function packageNameOf(source: string): string {
  const segments = source.split('/');
  return source.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

/**
 * True when a declaration can host added VALUE ImportSpecifiers: named and
 * default imports qualify. `import * as ns` cannot syntactically hold named
 * specifiers alongside the namespace, and a type-only declaration
 * (`import type { ... }`) would silently erase an added value binding at
 * build time.
 */
export function canHostNamedSpecifiers(
  declaration: t.ImportDeclaration
): boolean {
  return (
    declaration.importKind !== 'type' &&
    !declaration.specifiers.some((specifier) =>
      t.isImportNamespaceSpecifier(specifier)
    )
  );
}

/**
 * Ensures `import { <names> } from '<module>'` exists, merging into an
 * existing compatible declaration when present. Names already bound are not
 * duplicated. Callers reference each name verbatim in generated code, so
 * "present" means the module's OWN symbol is VALUE-bound under its own name;
 * an alias of it (`withGTConfig as wgc`) still gets a plain specifier added
 * (legal: one symbol may be imported twice), a namespace import
 * (`import * as gt`) can never host named specifiers and gets a separate
 * declaration instead, and a TYPE-ONLY binding of a needed symbol is promoted
 * to a value import (a value import satisfies both value and type uses;
 * leaving it type-only would strand the generated value references).
 */
export function ensureNamedImports(
  ast: t.File,
  module: string,
  names: string[]
): void {
  const wanted = new Set(names);
  let target: t.ImportDeclaration | null = null;
  const present = new Set<string>();
  const conflictingLocals = new Set<string>();
  const typeOnlyPromotions: Array<{
    declaration: t.ImportDeclaration;
    specifier: t.ImportSpecifier;
    name: string;
  }> = [];
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== module) return;
      if (!target && canHostNamedSpecifiers(path.node)) target = path.node;
      const declarationTypeOnly = path.node.importKind === 'type';
      for (const specifier of path.node.specifiers) {
        if (t.isImportSpecifier(specifier)) {
          const imported = t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value;
          const typeOnly =
            declarationTypeOnly || specifier.importKind === 'type';
          if (imported !== specifier.local.name) {
            // `import { other as withGTConfig }`: the local name is taken by
            // a DIFFERENT symbol, so adding a plain specifier would redeclare
            // it.
            conflictingLocals.add(specifier.local.name);
          } else if (!typeOnly) {
            present.add(imported);
          } else if (wanted.has(imported)) {
            typeOnlyPromotions.push({
              declaration: path.node,
              specifier,
              name: imported,
            });
            present.add(imported);
          }
        } else {
          conflictingLocals.add(specifier.local.name);
        }
      }
    },
  });

  for (const { declaration, specifier, name } of typeOnlyPromotions) {
    if (declaration.importKind === 'type') {
      if (declaration.specifiers.length === 1) {
        declaration.importKind = 'value';
      } else {
        // Sibling type specifiers must stay type-only: pull ours out and let
        // the missing-names path below re-bind it as a value import.
        declaration.specifiers = declaration.specifiers.filter(
          (candidate) => candidate !== specifier
        );
        present.delete(name);
      }
    } else {
      specifier.importKind = null;
    }
  }

  const missing = names.filter(
    (name) => !present.has(name) && !conflictingLocals.has(name)
  );
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

/**
 * React's own dependency-array hooks. Deliberately NOT any `use*` name: a
 * custom hook can genuinely consume its array argument's values (a
 * `useStore([t])` typed against the source library would then convert into a
 * type error), so only the built-ins whose dep arrays React treats as pure
 * identity lists are exempt. A custom hook's dep array over-holds
 * conservatively with the escape reason instead.
 */
const REACT_DEP_ARRAY_HOOKS = new Set([
  'useMemo',
  'useCallback',
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',
  'useImperativeHandle',
]);

/**
 * True when `path` (an identifier reference) sits directly inside a React
 * hook's dependency array: an element of an ArrayExpression that is itself an
 * argument of a built-in dependency-array hook call (`useMemo(...)`,
 * `React.useCallback(...)`), unwrapping TS cast wrappers (`[t] as const`). A
 * translation binding listed there (required by react-hooks/exhaustive-deps)
 * is an identity read with no call-signature contract, so the escape audits
 * must not treat it as a disqualifying value escape (the round-7 re-attack).
 */
export function isHookDependencyArrayElement(path: NodePath): boolean {
  const arrayPath = path.parentPath;
  if (!arrayPath?.isArrayExpression()) return false;
  if (!(arrayPath.node.elements as t.Node[]).includes(path.node)) return false;
  // `[t] as const` / `[t] satisfies ...` / parenthesized arrays still reach
  // the call as the same dependency list; walk out through the wrappers.
  let argumentPath: NodePath = arrayPath;
  while (
    argumentPath.parentPath?.isTSAsExpression() ||
    argumentPath.parentPath?.isTSSatisfiesExpression() ||
    argumentPath.parentPath?.isParenthesizedExpression()
  ) {
    argumentPath = argumentPath.parentPath;
  }
  const callPath = argumentPath.parentPath;
  if (!callPath?.isCallExpression()) return false;
  if (!(callPath.node.arguments as t.Node[]).includes(argumentPath.node)) {
    return false;
  }
  const callee = callPath.node.callee;
  const hookName = t.isIdentifier(callee)
    ? callee.name
    : t.isMemberExpression(callee) &&
        !callee.computed &&
        t.isIdentifier(callee.property)
      ? callee.property.name
      : null;
  return hookName !== null && REACT_DEP_ARRAY_HOOKS.has(hookName);
}
