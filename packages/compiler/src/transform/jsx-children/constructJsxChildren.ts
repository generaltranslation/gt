import { JsxChild, JsxChildren, JsxElement } from 'generaltranslation/types';
import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { validateIdentifier } from './validation/validateIdentifier';
import { validateTemplateLiteral } from './validation/validateTemplateLiteral';
import { validateChildrenElement } from './validation/validateChildrenElement';
import { getCalleeNameFromJsxExpressionParam } from './utils/getCalleeNameFromJsxExpressionParam';
import { getCanonicalFunctionName } from '../getCanonicalFunctionName';

/**
 * Given the children of a <T> component, constructs a JsxChildren object
 * Takes an Expression
 *
 * ONLY does JsxChildren construction + validation, no further processing on any children
 *
 * On invalid children, quit immediately
 */
export function _constructJsxChildren(
  children: t.Expression,
  state: TransformState
): { errors: string[]; value?: JsxChildren } {
  const errors: string[] = [];

  let value: JsxChildren | undefined;
  if (t.isArrayExpression(children)) {
    // Handle ArrayExpression
    value = [];

    for (const child of children.elements) {
      // Validate child
      if (!validateChildrenElement(child)) {
        errors.push(
          `Failed to construct JsxChildren! Child must be an expression`
        );
        return { errors };
      }

      // Construct JsxChild
      const validation = constructJsxChild(child, state);
      errors.push(...validation.errors);
      if (errors.length > 0) {
        return { errors };
      }
      // Skip if no value
      if (validation.value === undefined) break;
      (value as JsxChild[]).push(validation.value!);
    }
  } else {
    // Handle single child
    const validation = constructJsxChild(children, state);
    errors.push(...validation.errors);
    if (errors.length > 0) {
      return { errors };
    }
    value = validation.value;
  }

  return { errors, value };
}

/**
 * Given an Expression, constructs a JsxChild
 * @returns { errors: string[]; value?: JsxChild }
 */
function constructJsxChild(
  child: Exclude<t.Expression, t.ArrayExpression>,
  state: TransformState
): { errors: string[]; value?: JsxChild } {
  const errors: string[] = [];
  let value: JsxChild | undefined;

  if (t.isCallExpression(child)) {
    // Construct JsxElement
    const validation = constructJsxElement(child, state);
    errors.push(...validation.errors);
    if (errors.length > 0) {
      return { errors };
    }
    value = validation.value;
  } else if (t.isStringLiteral(child)) {
    value = child.value;
  } else if (t.isTemplateLiteral(child)) {
    const validation = validateTemplateLiteral(child);
    errors.push(...validation.errors);
    if (errors.length > 0) {
      return { errors };
    }
    value = validation.value;
  } else if (t.isNumericLiteral(child)) {
    value = child.value.toString();
  } else if (t.isBooleanLiteral(child)) {
    value = child.value.toString();
  } else if (t.isNullLiteral(child)) {
    value = undefined;
  } else if (t.isIdentifier(child)) {
    // <T>{name}</T> or <T>{undefined}</T>
    const validation = validateIdentifier(child, state);
    errors.push(...validation.errors);
    if (errors.length > 0) {
      return { errors };
    }
    value = validation.value;
  } else {
    // Other cases fail
    errors.push(
      `Failed to construct JsxChild! Child must be a valid JSX child`
    );
    return { errors };
  }

  return { errors, value };
}

/**
 * Given a CallExpression, constructs a JsxChild
 * Handles: Jsx(T, ...children)
 */
function constructJsxElement(
  callExpr: t.CallExpression,
  state: TransformState
): { errors: string[]; value?: JsxElement } {
  const errors: string[] = [];
  let value: JsxElement | undefined;

  // Get first argument
  if (callExpr.arguments.length === 0) {
    return { errors };
  }
  const firstArg = callExpr.arguments[0];
  if (!t.isExpression(firstArg)) {
    errors.push(
      `Failed to construct JsxElement! First argument must be an expression`
    );
    return { errors };
  }

  // Resolve canonical name
  const { namespaceName, functionName } =
    getCalleeNameFromJsxExpressionParam(firstArg);
  if (!functionName) {
    errors.push(
      `Failed to construct JsxElement! First argument must be a valid function`
    );
    return { errors };
  }

  // Get the canonical function name
  const { canonicalName, type } = getCanonicalFunctionName(
    state.importTracker,
    namespaceName,
    functionName
  );

  // Handle GT components: <Var>, <Num>, <Currency>, etc.
  if (canonicalName && type === 'generaltranslation') {
  } else {
    // Handle normal components: <div>, <Fragment>, etc.
  }

  return { errors, value };
}
