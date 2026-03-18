import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { isGTImportSource } from '../constants/gt/helpers';
import { GT_DERIVE_STRING_FUNCTIONS } from '../constants/gt/constants';

/**
 * Skip un-interpolation step for derive invocations
 * @param {t.Expression} expr - The expression to check
 * @returns {boolean} True if the expression is a derive invocation, false otherwise
 */
export function isDeriveInvocation(
  expr: t.Expression,
  tPath: NodePath
): boolean {
  if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) return false;
  const scope = tPath.scope;
  const binding = scope.getBinding(expr.callee.name);
  if (!binding) return false;
  if (!binding.path.isImportSpecifier()) return false;
  const importDecl = binding.path.parentPath;
  if (!importDecl?.isImportDeclaration()) return false;
  const importSource = importDecl.node.source.value;
  if (!isGTImportSource(importSource)) return false;
  const imported = binding.path.node.imported;
  const originalName = t.isIdentifier(imported)
    ? imported.name
    : imported.value;
  return GT_DERIVE_STRING_FUNCTIONS.includes(
    originalName as (typeof GT_DERIVE_STRING_FUNCTIONS)[number]
  );
}
