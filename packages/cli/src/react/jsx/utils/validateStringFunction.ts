import { NodePath } from '@babel/traverse';
import { Updates } from '../../../types/index.js';
import { warnAsyncUseGT, warnSyncGetGT } from '../../../console/index.js';

/**
 * Validate useGT() / await getGT() calls
 * 1. Validates that the call does not violate the rules of React (no hooks in async functions)
 */
export function validateStringFunction(
  localImportName: string,
  path: NodePath,
  updates: Updates,
  errors: string[],
  file: string,
  originalImportName: string
): void {
  // Get the root program node to traverse the entire file
  const program = path.scope.getProgramParent().path;

  program.traverse({
    CallExpression(callPath) {
      if (
        callPath.node.callee.type === 'Identifier' &&
        callPath.node.callee.name === localImportName
      ) {
        // Check the function scope
        const functionScope = callPath.getFunctionParent();

        if (originalImportName === 'useGT') {
          // useGT should NOT be in an async function
          if (functionScope && functionScope.node.async) {
            errors.push(
              warnAsyncUseGT(
                file,
                `${callPath.node.loc?.start?.line}:${callPath.node.loc?.start?.column}`
              )
            );
          }
        } else if (originalImportName === 'getGT') {
          // getGT should be in an async function
          if (!functionScope || !functionScope.node.async) {
            errors.push(
              warnSyncGetGT(
                file,
                `${callPath.node.loc?.start?.line}:${callPath.node.loc?.start?.column}`
              )
            );
          }
        }
      }
    },
  });
}
