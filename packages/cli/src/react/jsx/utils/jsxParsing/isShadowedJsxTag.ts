import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { GT_LIBRARIES } from '../../../../types/libraries.js';

/**
 * A destructured `require('<gt library>')` introduces a GT name from a local
 * binding rather than module scope, so it is an import for this check.
 */
function isGtRequireDeclarator(
  declarator: NodePath<t.VariableDeclarator>
): boolean {
  const init = declarator.node.init;
  if (
    !t.isCallExpression(init) ||
    !t.isIdentifier(init.callee, { name: 'require' })
  ) {
    return false;
  }
  const [source] = init.arguments;
  if (!t.isStringLiteral(source)) return false;
  return GT_LIBRARIES.some((lib) => source.value.startsWith(lib));
}

/**
 * A tag name that an enclosing scope rebinds (a parameter, or a local variable
 * declared in the function or block) renders that binding, not the GT import.
 * ESM import names live on the module scope, and a destructured GT
 * `require()` declares its names locally, so both count as the import.
 */
export function isShadowedJsxTag(path: NodePath, typeName: string): boolean {
  const binding = path.scope.getBinding(typeName);
  if (!binding) return false;
  if (binding.kind === 'module') return false;
  if (
    binding.path.isVariableDeclarator() &&
    isGtRequireDeclarator(binding.path)
  ) {
    return false;
  }
  return true;
}
