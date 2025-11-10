import { NodePath } from '@babel/traverse';
import { JsxTree, MultiplicationNode } from '../../../types.js';
import * as t from '@babel/types';

type Options = {
  warnings: Set<string>;
  file: string;
};

/**
 * Given a createElement call expression, returns the children
 * @param createElementCallExpression - The createElement call expression to get the children from
 * @returns The children
 *
 * TODO: this function
 */
export function getChildren(
  createElementCallExpression: NodePath<t.CallExpression>
): NodePath | undefined {
  // If there are no arguments, return null
  if (createElementCallExpression.node.arguments.length < 3) {
    return undefined;
  }
  // If the second argument is not an array expression, return null
  if (!createElementCallExpression.get('arguments.2').isArrayExpression()) {
    return undefined;
  }
  // If the second argument is an array expression, return the elements
  return createElementCallExpression.get('arguments.2');
}
