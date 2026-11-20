import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { isReactFunction } from '../react/helpers';
import { isJsxImportSource } from '../react/jsxImportSources';

/**
 * Given an identifier node, determine if it is a React Jsx function
 * jsxDEV, jsx, jsxs, ...
 *
 * TODO: handle default imports and namespace imports
 */
export function isReactJsxFunction(
  path: NodePath<t.Identifier | t.MemberExpression>,
  jsxImportSources: readonly string[]
): boolean {
  if (path.isIdentifier()) {
    return isReactJsxFunctionImportSpecifier(path, jsxImportSources);
  } else if (path.isMemberExpression()) {
    return isReactJsxFunctionMemberExpression(path);
  }
  return false;
}

// --- Helpers --- //

/**
 * Check if the identifier is a React Jsx function import specifier
 * import { jsxDEV, jsx, jsxs } from 'react'
 */
function isReactJsxFunctionImportSpecifier(
  identifierPath: NodePath<t.Identifier>,
  jsxImportSources: readonly string[]
): boolean {
  // Check that binding is being imported
  // import { jsxDEV, jsx, jsxs } from '...'
  const binding = identifierPath.scope.getBinding(identifierPath.node.name);
  if (!binding || !binding.path.isImportSpecifier()) {
    return false;
  }

  // Check the original name is a React Jsx function
  const imported = binding.path.node.imported;
  const originalName = t.isIdentifier(imported)
    ? imported.name
    : imported.value;
  if (!isReactFunction(originalName)) {
    return false;
  }

  // Check the import source is from React
  const parentPath = binding.path.parentPath;
  if (!parentPath || !parentPath.isImportDeclaration()) {
    return false;
  }
  const importSource = parentPath.node.source.value;
  if (!isJsxImportSource(importSource, jsxImportSources)) {
    return false;
  }

  return true;
}

/**
 * Check if the member expression is a React Jsx function
 * React.jsxDEV, React.jsx, React.jsxs, ...
 */
function isReactJsxFunctionMemberExpression(
  _memberExpressionPath: NodePath<t.MemberExpression>
): boolean {
  // TODO: implement
  return false;
}
