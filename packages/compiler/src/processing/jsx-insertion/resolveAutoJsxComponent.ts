import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';
import { isGTImportSource } from '../../utils/constants/gt/helpers';
import { resolveFirstArgGTName as resolveDirectGtName } from '../../utils/constants/resolveIdentifier/isGTComponent';

/** Next retains the package after its internal barrel-optimization request. */
export function isAutoJsxImportSource(source: string): boolean {
  if (isGTImportSource(source)) return true;
  const request = /^__barrel_optimize__\?names=[^!]*!=!(.+)$/.exec(source);
  return !!request && isGTImportSource(request[1]);
}

/** Preserve GT boundaries after Next rewrites a bound, named package import. */
export function resolveFirstArgGTName(
  path: NodePath<t.Expression>
): string | null {
  const direct = resolveDirectGtName(path);
  if (direct) return direct;
  if (!path.isIdentifier()) return null;
  const binding = path.scope.getBinding(path.node.name);
  if (!binding?.path.isImportSpecifier()) return null;
  const declaration = binding.path.parentPath;
  if (
    !declaration?.isImportDeclaration() ||
    !isAutoJsxImportSource(declaration.node.source.value)
  )
    return null;
  const imported = binding.path.node.imported;
  return t.isIdentifier(imported) ? imported.name : imported.value;
}

export function isUserTranslationComponent(
  path: NodePath<t.Expression>
): boolean {
  return resolveFirstArgGTName(path) === GT_COMPONENT_TYPES.T;
}

export function isUserVariableComponent(path: NodePath<t.Expression>): boolean {
  return [
    GT_COMPONENT_TYPES.Var,
    GT_COMPONENT_TYPES.Num,
    GT_COMPONENT_TYPES.Currency,
    GT_COMPONENT_TYPES.DateTime,
    GT_COMPONENT_TYPES.RelativeTime,
  ].includes((resolveFirstArgGTName(path) ?? '') as GT_COMPONENT_TYPES);
}

export function isGTBranchComponent(path: NodePath<t.Expression>): boolean {
  const name = resolveFirstArgGTName(path);
  return (
    name === GT_COMPONENT_TYPES.Branch || name === GT_COMPONENT_TYPES.Plural
  );
}

export function isGTDeriveComponent(path: NodePath<t.Expression>): boolean {
  return resolveFirstArgGTName(path) === GT_COMPONENT_TYPES.Derive;
}
