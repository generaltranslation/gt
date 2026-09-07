import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { ElementPath } from './syntax.js';
import { prependImport } from './imports.js';
export { runtimeAllowsJsx } from './runtimePragmas.js';

// Scoped to automatic insertion; other CLI extraction keeps its existing import policy.
const sources = new Set([
  'gt-next',
  'gt-next/server',
  'gt-react',
  'gt-react/client',
  'gt-react/browser',
  'gt-i18n',
]);
const reactSources = new Set([
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]);
export const variables = new Set([
  'Var',
  'Num',
  'Currency',
  'DateTime',
  'RelativeTime',
]);
export const opaque = new Set(['Branch', 'Plural', 'Derive']);

type RuntimeBinding = {
  source: string;
  imported: 'jsx' | 'jsxs' | 'jsxDEV';
  local: t.Identifier;
};

export function runtimeBinding(path: NodePath): RuntimeBinding | undefined {
  if (!path.isCallExpression()) return;
  const callee = path.get('callee');
  if (!callee.isIdentifier()) return;
  const binding = callee.scope.getBinding(callee.node.name)?.path;
  const declaration = binding?.parentPath;
  if (
    !binding?.isImportSpecifier() ||
    !declaration?.isImportDeclaration() ||
    declaration.node.importKind === 'type' ||
    binding.node.importKind === 'type' ||
    !reactSources.has(declaration.node.source.value)
  )
    return;
  const imported = binding.node.imported;
  const name = t.isIdentifier(imported) ? imported.name : imported.value;
  if (name !== 'jsx' && name !== 'jsxs' && name !== 'jsxDEV') return;
  return {
    source: declaration.node.source.value,
    imported: name,
    local: callee.node,
  };
}

export function componentName(path: ElementPath): string | undefined {
  let name: string;
  if (path.isJSXElement()) {
    const tag = path.node.openingElement.name;
    if (!t.isJSXIdentifier(tag) || t.react.isCompatTag(tag.name)) return;
    name = tag.name;
  } else if (path.isCallExpression()) {
    const tag = path.node.arguments[0];
    if (!t.isIdentifier(tag)) return;
    name = tag.name;
  } else return;
  const binding = path.scope.getBinding(name)?.path;
  const declaration = binding?.parentPath;
  if (
    !binding?.isImportSpecifier() ||
    !declaration?.isImportDeclaration() ||
    declaration.node.importKind === 'type' ||
    binding.node.importKind === 'type'
  )
    return;
  const source = declaration.node.source.value;
  const directSource =
    /^__barrel_optimize__\?names=[^!]*!=!(.+)$/.exec(source)?.[1] ?? source;
  if (!sources.has(directSource)) return;
  const imported = binding.node.imported;
  return t.isIdentifier(imported) ? imported.name : imported.value;
}

function ensureHelper(
  context: NodePath,
  source: string,
  name: 'jsx' | 'jsxs'
): t.Identifier {
  const program = context.findParent((path) => path.isProgram());
  if (!program?.isProgram())
    throw new Error(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'Automatic JSX insertion could not resolve its module',
        fix: 'Parse the source file as a module before inserting translation components',
      })
    );
  for (const statement of program.get('body')) {
    if (
      !statement.isImportDeclaration() ||
      statement.node.importKind === 'type' ||
      statement.node.source.value !== source
    )
      continue;
    for (const specifier of statement.get('specifiers')) {
      if (
        !specifier.isImportSpecifier() ||
        specifier.node.importKind === 'type'
      )
        continue;
      const imported = specifier.node.imported;
      if (
        (t.isIdentifier(imported) ? imported.name : imported.value) === name &&
        context.scope.getBinding(specifier.node.local.name)?.path === specifier
      )
        return t.cloneNode(specifier.node.local);
    }
  }
  let local = program.scope.generateUidIdentifier(name);
  while (context.scope.getBinding(local.name))
    local = program.scope.generateUidIdentifier(name);
  const added = prependImport(
    program,
    t.importDeclaration(
      [t.importSpecifier(local, t.identifier(name))],
      t.stringLiteral(source)
    )
  );
  program.scope.registerDeclaration(added);
  return t.cloneNode(local);
}

export function ensureStaticHelper(context: NodePath): t.Identifier {
  return ensureHelper(context, 'react/jsx-runtime', 'jsxs');
}

/** Keep the user's runtime module and helper values intact when editing a lowered call. */
export function runtimeHelper(
  owner: NodePath<t.CallExpression>,
  multiple: boolean
): { callee: t.Identifier; development: boolean } {
  const binding = runtimeBinding(owner)!;
  if (binding.imported === 'jsxDEV')
    return { callee: t.cloneNode(binding.local), development: true };
  return {
    callee: ensureHelper(owner, binding.source, multiple ? 'jsxs' : 'jsx'),
    development: false,
  };
}

export function updateRuntimeToSingle(owner: NodePath<t.CallExpression>): void {
  const runtime = runtimeHelper(owner, false);
  if (runtime.development) {
    const flag = owner.get('arguments')[3];
    if (flag?.isBooleanLiteral({ value: true }))
      flag.replaceWith(t.booleanLiteral(false));
  } else owner.node.callee = runtime.callee;
}
