import * as t from '@babel/types';
import { validateChildrenPropertyFromObjectExpression } from '../../../utils/validation/validateChildrenFromObjectExpression';

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
    errors.push(`Failed to construct JsxElement! Missing parameter field`);
    return { errors };
  }
  if (!t.isObjectExpression(args[1])) {
    errors.push(
      `Failed to construct JsxElement! Parameter field must be an object expression`
    );
    return { errors };
  }

  return validateChildrenPropertyFromObjectExpression(args[1]);
}
