import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { isGTImportSource } from '../gt/helpers';

/**
 * Given the first argument of a jsx() call (the component identifier),
 * resolve it to its original imported name from a GT source.
 * Returns null if the identifier is not imported from a GT library.
 */
export function resolveFirstArgGTName(
  firstArg: t.Expression,
  path: NodePath
): string | null {
  if (!t.isIdentifier(firstArg)) return null;

  const binding = path.scope.getBinding(firstArg.name);
  if (!binding || !binding.path.isImportSpecifier()) return null;

  const imported = binding.path.node.imported;
  const originalName = t.isIdentifier(imported)
    ? imported.name
    : imported.value;

  const parentPath = binding.path.parentPath;
  if (!parentPath?.isImportDeclaration()) return null;

  const importSource = parentPath.node.source.value;
  if (!isGTImportSource(importSource)) return null;

  return originalName;
}

/** Check if first arg of jsx call is user-written T (not GtInternalTranslateJsx) */
export function isUserTranslationComponent(
  firstArg: t.Expression,
  path: NodePath
): boolean {
  return resolveFirstArgGTName(firstArg, path) === 'T';
}

/** Check if first arg is user-written Var, Num, Currency, or DateTime */
export function isUserVariableComponent(
  firstArg: t.Expression,
  path: NodePath
): boolean {
  const name = resolveFirstArgGTName(firstArg, path);
  return ['Var', 'Num', 'Currency', 'DateTime'].includes(name ?? '');
}

/** Check if first arg is Branch or Plural */
export function isGTBranchComponent(
  firstArg: t.Expression,
  path: NodePath
): boolean {
  const name = resolveFirstArgGTName(firstArg, path);
  return name === 'Branch' || name === 'Plural';
}

/** Check if first arg is Derive or Static */
export function isGTDeriveComponent(
  firstArg: t.Expression,
  path: NodePath
): boolean {
  const name = resolveFirstArgGTName(firstArg, path);
  return name === 'Derive' || name === 'Static';
}
