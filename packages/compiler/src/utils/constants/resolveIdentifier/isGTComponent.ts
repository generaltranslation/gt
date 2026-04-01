import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { isGTImportSource } from '../gt/helpers';
import { GT_COMPONENT_TYPES } from '../gt/constants';

/**
 * Given a NodePath to the first argument of a jsx() call (the component identifier),
 * resolve it to its original imported name from a GT source.
 * Returns null if the identifier is not imported from a GT library.
 */
export function resolveFirstArgGTName(firstArgPath: NodePath): string | null {
  if (!firstArgPath.isIdentifier()) return null;

  const binding = firstArgPath.scope.getBinding(firstArgPath.node.name);
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
export function isUserTranslationComponent(firstArgPath: NodePath): boolean {
  return resolveFirstArgGTName(firstArgPath) === GT_COMPONENT_TYPES.T;
}

/** Check if first arg is user-written Var, Num, Currency, or DateTime */
export function isUserVariableComponent(firstArgPath: NodePath): boolean {
  const name = resolveFirstArgGTName(firstArgPath);
  return [
    GT_COMPONENT_TYPES.Var,
    GT_COMPONENT_TYPES.Num,
    GT_COMPONENT_TYPES.Currency,
    GT_COMPONENT_TYPES.DateTime,
  ].includes((name ?? '') as GT_COMPONENT_TYPES);
}

/** Check if first arg is Branch or Plural */
export function isGTBranchComponent(firstArgPath: NodePath): boolean {
  const name = resolveFirstArgGTName(firstArgPath);
  return (
    name === GT_COMPONENT_TYPES.Branch || name === GT_COMPONENT_TYPES.Plural
  );
}

/** Check if first arg is Derive or Static */
export function isGTDeriveComponent(firstArgPath: NodePath): boolean {
  const name = resolveFirstArgGTName(firstArgPath);
  return (
    name === GT_COMPONENT_TYPES.Derive || name === GT_COMPONENT_TYPES.Static
  );
}
