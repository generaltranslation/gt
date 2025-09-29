import * as t from '@babel/types';
import { TransformState } from './types';
import { ScopedVariable } from '../visitor/scope-tracker';

export function extractPropFromJSXCall(
  callExpr: t.CallExpression,
  propName: string
): t.Expression | null {
  // Ensure it's a JSX call with at least 2 arguments
  if (callExpr.arguments.length < 2) {
    return null;
  }

  const propsArg = callExpr.arguments[1];

  // Check if second argument is an object expression (props)
  if (!t.isObjectExpression(propsArg)) {
    return null;
  }

  // Find the children property
  for (const prop of propsArg.properties) {
    if (
      t.isObjectProperty(prop) &&
      t.isIdentifier(prop.key) &&
      prop.key.name === propName
    ) {
      return prop.value as t.Expression;
    }
  }

  return null;
}

export function extractComponentNameFromJSXCall(
  callExpr: t.CallExpression
): string | null {
  // Ensure it has at least 1 argument (the component)
  if (callExpr.arguments.length < 1) {
    return null;
  }

  const componentArg = callExpr.arguments[0];

  // Direct identifier: _jsxDEV(T, ...)
  if (t.isIdentifier(componentArg)) {
    return componentArg.name;
  }

  // Member expression: _jsxDEV(GT.T, ...)
  if (t.isMemberExpression(componentArg)) {
    if (
      t.isIdentifier(componentArg.object) &&
      t.isIdentifier(componentArg.property)
    ) {
      return `${componentArg.object.name}.${componentArg.property.name}`;
    }
  }

  // String literal (less common): _jsxDEV("div", ...)
  if (t.isStringLiteral(componentArg)) {
    return componentArg.value;
  }

  return null;
}

export function getOriginalNameFromExpression(
  state: TransformState,
  expression: t.Expression
): string | null {
  // Get local name
  const localName = extractComponentNameFromJSXCall(
    expression as t.CallExpression
  );
  if (!localName) {
    return null;
  }

  // Map it back to an original name
  const translationVariable =
    state.importTracker.scopeTracker.getTranslationVariable(localName);

  if (!translationVariable) {
    return null;
  }
  return translationVariable.canonicalName;
}

export function getTranslationVariableFromExpression(
  state: TransformState,
  expression: t.Expression
): ScopedVariable | null {
  // Get local name
  const localName = extractComponentNameFromJSXCall(
    expression as t.CallExpression
  );
  if (!localName) {
    return null;
  }

  // Map it back to an original name
  const translationVariable =
    state.importTracker.scopeTracker.getTranslationVariable(localName);

  if (!translationVariable) {
    return null;
  }
  return translationVariable;
}
