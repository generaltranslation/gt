import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { validateChildrenPropertyFromObjectExpression } from '../../../utils/validation/validateChildrenFromObjectExpression';
import { createErrorLocation } from '../../../utils/errors';

/**
 * Given a CallExpression path, extracts children and validates them.
 */
export function validateChildrenFromArgs(
  callExprPath: NodePath<t.CallExpression>
): {
  errors: string[];
  value?: NodePath<t.Expression>;
} {
  const errors: string[] = [];
  const args = callExprPath.node.arguments;

  if (args.length < 2) {
    errors.push(
      `Failed to construct JsxElement! Missing parameter field` +
        (args.length > 0 ? createErrorLocation(args[0]) : '')
    );
    return { errors };
  }
  if (!t.isObjectExpression(args[1])) {
    errors.push(
      `Failed to construct JsxElement! Parameter field must be an object expression` +
        createErrorLocation(args[1])
    );
    return { errors };
  }

  const argsPath = callExprPath.get('arguments')[1];
  if (!argsPath?.isObjectExpression()) {
    return {
      errors: [
        `Failed to construct JsxElement! Parameter field must be an object expression` +
          createErrorLocation(args[1]),
      ],
    };
  }

  return validateChildrenPropertyFromObjectExpression(
    argsPath as NodePath<t.ObjectExpression>
  );
}
