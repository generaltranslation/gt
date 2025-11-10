import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import {
  identifierReferencesImport,
  memberExpressionReferencesImport,
} from './validateIdentifier.js';

const REACT_ELEMENT_CREATOR_FUNCTIONS_BY_IMPORT = {
  react: ['createElement'],
  'react/jsx-runtime': ['jsx', 'jsxs'],
  'react/jsx-dev-runtime': ['jsxDEV'],
} as const;

/**
 * Given a call expression, checks if it is a call to createElement
 * @param callExpression - The call expression to check
 * @returns True if the call expression is a call to createElement, false otherwise
 */
export function isCreateElement(
  callExpression: NodePath<t.CallExpression>
): boolean {
  if (callExpression.get('callee').isIdentifier()) {
    const identifier = callExpression.get('callee');
    if (!identifier.isIdentifier()) return false;
    for (const [importSource, importNames] of Object.entries(
      REACT_ELEMENT_CREATOR_FUNCTIONS_BY_IMPORT
    )) {
      for (const importName of importNames) {
        if (
          identifierReferencesImport({
            identifier,
            importSource,
            importName,
          })
        ) {
          return true;
        }
      }
    }
  } else if (callExpression.get('callee').isMemberExpression()) {
    const memberExpression = callExpression.get('callee');
    if (!memberExpression.isMemberExpression()) return false;
    for (const [importSource, importNames] of Object.entries(
      REACT_ELEMENT_CREATOR_FUNCTIONS_BY_IMPORT
    )) {
      for (const importName of importNames) {
        if (
          memberExpressionReferencesImport({
            memberExpression,
            propertyName: importName,
            importSource,
          })
        ) {
          return true;
        }
      }
    }
  }
  return false;
}
