import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import { GT_COMPONENT_TYPES } from '../constants/gt/constants';
import { getObjectPropertyPathFromObjectExpression } from '../parsing/getObjectPropertyFromObjectExpression';

/**
 * Given an object expression path validates and extracts children property
 * This is only for use as children of <T> components
 */
export function validateChildrenPropertyFromObjectExpression(
  argsPath: NodePath<t.ObjectExpression>
): {
  errors: string[];
  value?: NodePath<t.Expression>;
} {
  const errors: string[] = [];

  // Get the children property
  const childrenObjectPropertyPath = getObjectPropertyPathFromObjectExpression(
    argsPath,
    'children'
  );
  if (!childrenObjectPropertyPath) {
    return { errors, value: undefined };
  }
  if (!childrenObjectPropertyPath.isObjectProperty()) {
    errors.push(
      `The children property of the <${GT_COMPONENT_TYPES.T}> component must be an object property`
    );
    return { errors };
  }

  const valuePath = childrenObjectPropertyPath.get('value');
  if (!valuePath.isExpression()) {
    errors.push(
      `The children properties of the <${GT_COMPONENT_TYPES.T}> component must be an expression`
    );
    return { errors };
  }

  return { errors, value: valuePath as NodePath<t.Expression> };
}
