import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { GT_DERIVE_STRING_FUNCTIONS } from '../../constants.js';
import { GT_LIBRARIES, GTLibrary } from '../../../../../types/libraries.js';

/**
 * Given an expression, determine if it is a derive call
 * @param expr - The expression to check
 * @returns True if the expression is a derive call, false otherwise
 */
export function isDeriveCall({
  expr,
  tPath,
}: {
  expr: t.Expression;
  tPath: NodePath;
}): boolean {
  // Check if the expression is a call expression
  if (!t.isCallExpression(expr)) return false;
  const callee = expr.callee;
  if (!t.isIdentifier(callee)) return false;

  // Fail if no binding
  const calleeName = callee.name;
  const binding = tPath.scope.getBinding(calleeName);
  if (!binding) return false;

  // Check if the callee is imported from GT
  if (!binding.path.isImportSpecifier()) return false;
  const source = binding.path.parentPath?.isImportDeclaration()
    ? binding.path.parentPath?.node.source.value
    : undefined;
  if (!GT_LIBRARIES.includes(source as GTLibrary)) return false;

  // Fail if the original name is not 'derive' (or the deprecated 'declareStatic')
  const imported = binding.path.node.imported;
  const originalName = t.isIdentifier(imported)
    ? imported.name
    : imported.value;
  if (
    !GT_DERIVE_STRING_FUNCTIONS.includes(
      originalName as (typeof GT_DERIVE_STRING_FUNCTIONS)[number]
    )
  ) {
    return false;
  }

  return true;
}
