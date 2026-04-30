import {
  INVALID_IDENTIFIERS,
  InvalidIdentifier,
  OTHER_IDENTIFIERS,
  OtherIdentifier,
  REQUIRE_FUNCTION,
} from './constants';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

/**
 * Checks if the string is an other identifier
 */
export function isOtherIdentifier(name: string): name is OtherIdentifier {
  return OTHER_IDENTIFIERS.includes(name as OtherIdentifier);
}

/**
 * Checks if the string is an invalid identifier
 */
export function isInvalidIdentifier(name: string): name is InvalidIdentifier {
  return INVALID_IDENTIFIERS.includes(name as InvalidIdentifier);
}

/**
 * Checks if a call expression is a dynamic import().
 */
export function isImportFunction(
  callExpressionPath: NodePath<t.CallExpression>
): boolean {
  return callExpressionPath.node.callee.type === 'Import';
}

/**
 * Checks if a call expression is a CommonJS require().
 */
export function isRequireFunction(
  callExpressionPath: NodePath<t.CallExpression>
): boolean {
  return (
    t.isIdentifier(callExpressionPath.node.callee) &&
    callExpressionPath.node.callee.name === REQUIRE_FUNCTION
  );
}
