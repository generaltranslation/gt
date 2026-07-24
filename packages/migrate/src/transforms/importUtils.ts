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
