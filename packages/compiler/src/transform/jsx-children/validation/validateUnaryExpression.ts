import * as t from '@babel/types';
import { createErrorLocation } from '../../../utils/errors';
/**
 * Given a UnaryExpression, validates the operator
 * @returns {errors: string[]; value?: string}
 */
export function validateUnaryExpression(unaryExpression: t.UnaryExpression): {
  errors: string[];
  value?: string;
} {
  const errors: string[] = [];
  let value: string | undefined;

  // Only - and + keep a number's value: `void 0`, `!0`, `~0` or `typeof 0`
  // render something else than the literal
  if (unaryExpression.operator !== '-' && unaryExpression.operator !== '+') {
    errors.push(
      `Failed to construct JsxChild! Unary expression operator must be - or +` +
        createErrorLocation(unaryExpression)
    );
    return { errors };
  }
  const operator = unaryExpression.operator === '-' ? '-' : '';
  if (t.isNumericLiteral(unaryExpression.argument)) {
    if (unaryExpression.argument.value === 0) {
      value = '0';
    } else {
      value = operator + unaryExpression.argument.value.toString();
    }
  } else {
    errors.push(
      `Failed to construct JsxChild! Unary expression argument must be a numeric literal` +
        createErrorLocation(unaryExpression.argument)
    );
    return { errors };
  }

  return { errors, value };
}
