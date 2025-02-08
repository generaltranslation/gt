import * as t from '@babel/types';
/**
 * Checks if a node is meaningful. Does not recurse into children.
 * @param node - The node to check
 * @returns Whether the node is meaningful
 */
export declare function isMeaningful(node: t.Node): boolean;
/**
 * Checks if an expression is static (does not contain any variables which could change at runtime).
 * @param expr - The expression to check
 * @returns An object containing the result of the static check
 */
export declare function isStaticExpression(
  expr: t.Expression | t.JSXEmptyExpression
): {
  isStatic: boolean;
  value?: string;
};
export declare function isStaticValue(
  expr: t.Expression | t.JSXEmptyExpression
): boolean;
