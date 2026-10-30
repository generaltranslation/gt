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

  let operator = '';
  if (unaryExpression.operator === '-') {
    operator = unaryExpression.operator;
  }
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
