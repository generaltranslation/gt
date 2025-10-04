import * as t from '@babel/types';
import { GT_COMPONENT_TYPES } from '../constants/gt/constants';
import { getObjectPropertyFromObjectExpression } from '../jsx/getObjectPropertyFromObjectExpression';

/**
 * Given an object expression validates and extracts children property
 * This is only for use as children of <T> components
 */
export function validateChildrenPropertyFromObjectExpression(
  args: t.ObjectExpression
): {
  errors: string[];
  value?: t.Expression;
} {
  const errors: string[] = [];

  // Get the children property
  const childrenObjExpression = getObjectPropertyFromObjectExpression(
    args,
    'children'
  );
  if (!childrenObjExpression) {
    return { errors, value: undefined };
  }
  if (!t.isObjectProperty(childrenObjExpression)) {
    errors.push(
      `The children property of the <${GT_COMPONENT_TYPES.T}> component must be an object property`
    );
    return { errors };
  }
  if (!t.isExpression(childrenObjExpression.value)) {
    errors.push(
      `The children properties of the <${GT_COMPONENT_TYPES.T}> component must be an expression`
    );
    return { errors };
  }

  return { errors, value: childrenObjExpression.value };
}
