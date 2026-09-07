import traverseModule, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { AutoJsxRuntimeContext } from './projectRuntime.js';

const traverse = traverseModule.default || traverseModule;
const whitespace = /\p{White_Space}+/u;
const trim = (value: string) =>
  value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, '');

function directives(comments: readonly t.Comment[]) {
  let runtime: string | undefined;
  let source: string | undefined;
  let factory: string | undefined;
  let fragment: string | undefined;
  for (const comment of comments) {
    if (comment.type !== 'CommentBlock') continue;
    for (const raw of comment.value.split('\n')) {
      const line = trim(trim(raw).replace(/^\*/, ''));
      if (!line.startsWith('@jsx')) continue;
      const words = line.split(whitespace);
      for (let index = 0; index + 1 < words.length; index += 2) {
        const [name, value] = words.slice(index, index + 2);
        if (name === '@jsxRuntime' && ['automatic', 'classic'].includes(value))
          runtime = value;
        else if (name === '@jsxImportSource') {
          runtime = 'automatic';
          source = value;
        } else if (
          (name === '@jsx' || name === '@jsxFrag') &&
          /^[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}.]*$/u.test(value)
        ) {
          if (name === '@jsx') factory = value.split('.')[0];
          else fragment = value.split('.')[0];
        }
      }
    }
  }
  return {
    runtime,
    source,
    factory,
    fragment,
    found:
      runtime !== undefined ||
      source !== undefined ||
      factory !== undefined ||
      fragment !== undefined,
  };
}

function valueReference(path: NodePath): boolean {
  let current = path;
  while (current.parentPath) {
    const parent = current.parentPath;
    if (parent.isTSType()) return false;
    if (
      (parent.isTSAsExpression() || parent.isTSSatisfiesExpression()) &&
      current.key !== 'expression'
    )
      return false;
    current = parent;
  }
  return true;
}

function erased(
  path: NodePath<t.Statement | t.ModuleDeclaration>,
  implicitRoots: ReadonlySet<string>
): boolean {
  if (path.isExportNamedDeclaration()) {
    if (path.node.exportKind === 'type') return true;
    const declaration = path.get('declaration');
    if (declaration.node)
      return erased(declaration as NodePath<t.Statement>, implicitRoots);
  }
  if (
    path.isTSTypeAliasDeclaration() ||
    path.isTSInterfaceDeclaration() ||
    path.isTSDeclareFunction() ||
    ((path.isTSEnumDeclaration() ||
      path.isTSModuleDeclaration() ||
      path.isClassDeclaration() ||
      path.isVariableDeclaration()) &&
      path.node.declare)
  )
    return true;
  if (path.isImportDeclaration()) {
    if (path.node.importKind === 'type') return true;
    if (!path.node.specifiers.length) return false;
    return path.node.specifiers.every(
      (specifier) =>
        (t.isImportSpecifier(specifier) && specifier.importKind === 'type') ||
        (!implicitRoots.has(specifier.local.name) &&
          !path.scope
            .getBinding(specifier.local.name)
            ?.referencePaths.some(valueReference))
    );
  }
  return false;
}

/** Match the host's block-only, first-top-level-group JSX directive selection. */
export function runtimeAllowsJsx(
  ast: t.File,
  context: AutoJsxRuntimeContext = {}
): boolean {
  let runtime = 'automatic';
  let source = context.jsxImportSource ?? 'react';
  const apply = (comments: readonly t.Comment[]) => {
    const selected = directives(comments);
    runtime = selected.runtime ?? runtime;
    source = selected.source ?? source;
    return selected.found;
  };
  let program!: NodePath<t.Program>;
  traverse(ast, {
    Program(path) {
      program = path;
      path.stop();
    },
  });
  const statements = [...ast.program.directives, ...ast.program.body];
  const first = statements[0];
  // The TypeScript frontend retains its configured JSX factory and fragment
  // roots as implicit value references, even with the automatic runtime. Its
  // factory overrides come from the initial module comment group.
  const initial = directives(first?.leadingComments ?? []);
  const implicitRoots = new Set(
    ['React', initial.factory, initial.fragment].filter(
      (name): name is string => name !== undefined
    )
  );
  // The initial comment group belongs to the module even when its first type
  // declaration is erased. Later erased items do not carry host directives.
  apply(first?.leadingComments ?? []);
  for (const statement of statements) {
    const body = program.get('body').find((path) => path.node === statement);
    if (body && erased(body, implicitRoots)) continue;
    const before = [...statements]
      .reverse()
      .find(
        (item) =>
          item !== statement &&
          item.end !== null &&
          item.end !== undefined &&
          statement.start !== null &&
          statement.start !== undefined &&
          item.end <= statement.start
      );
    const comments = (statement.leadingComments ?? []).filter(
      (comment) =>
        !before?.loc || comment.loc?.start.line !== before.loc.end.line
    );
    if (apply(comments)) break;
  }
  return runtime === 'automatic' && source === 'react';
}
