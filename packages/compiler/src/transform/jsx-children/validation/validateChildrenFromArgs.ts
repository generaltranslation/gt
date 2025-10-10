import * as t from '@babel/types';
import { validateChildrenPropertyFromObjectExpression } from '../../../utils/validation/validateChildrenFromObjectExpression';
import { createErrorLocation } from '../../../utils/errors';

/**
 * Given (t.ArgumentPlaceholder | t.SpreadElement | t.Expression)[] extracts children and validates
 */
export function validateChildrenFromArgs(
  args: (t.ArgumentPlaceholder | t.SpreadElement | t.Expression)[]
): {
  errors: string[];
  value?: t.Expression;
} {
  const errors: string[] = [];

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

  return validateChildrenPropertyFromObjectExpression(args[1]);
}
