import { TransformState } from '../../state/types';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';
import * as t from '@babel/types';
import { getObjectPropertyFromObjectExpression } from '../../utils/parsing/getObjectPropertyFromObjectExpression';
import { validateExpressionIsStringLiteral } from '../../utils/validation/validateExpressionIsStringLiteral';
import { JsxChildren } from 'generaltranslation/types';
import { constructJsxChildren } from '../jsx-children';
import { validateChildrenPropertyFromObjectExpression } from '../../utils/validation/validateChildrenFromObjectExpression';
/**
 * Given a translation component, validate the arguments
 */
export function validateTranslationComponentArgs(
  callExpr: t.CallExpression,
  canonicalName: string,
  state: TransformState
): {
  errors: string[];
  _hash?: string;
  id?: string;
  context?: string;
  children?: JsxChildren;
} {
  // Check that there are at least 2 arguments (identifier, args)
  if (callExpr.arguments.length < 2) {
    const errors = [
      'Translation component must have at least 2 arguments (identifier, args)',
    ];
    return { errors };
  }

  // Get the component args
  const args = callExpr.arguments[1];
  if (!t.isObjectExpression(args)) {
    const errors = [
      'Translation component must have an object expression as the second argument',
    ];
    return { errors };
  }

  // Map to appropriate validation function
  switch (canonicalName) {
    case GT_COMPONENT_TYPES.T:
      return validateTComponentArgs(args, state);
    default:
      const errors = [
        `Invalid translation component: ${canonicalName}. You likely passed a non-translation component to validateTranslationComponentArgs`,
      ];
      return { errors };
  }
}

/* =============================== */
/* Helper Functions */
/* =============================== */

function validateTComponentArgs(
  args: t.ObjectExpression,
  state: TransformState
): {
  errors: string[];
  _hash?: string;
  id?: string;
  context?: string;
  children?: JsxChildren;
} {
  const errors: string[] = [];

  // Validate id
  const idValidation = validateStringProperty(args, 'id');
  errors.push(...idValidation.errors);
  const id = idValidation.value;

  // Validate context
  const contextValidation = validateStringProperty(args, 'context');
  errors.push(...contextValidation.errors);
  const context = contextValidation.value;

  // Validate hash
  const hashValidation = validateStringProperty(args, '_hash');
  errors.push(...hashValidation.errors);
  const _hash = hashValidation.value;

  // Validate children
  const childrenValidation = validateChildrenProperty(args, state);
  errors.push(...childrenValidation.errors);
  const children = childrenValidation.value;

  return { errors, id, context, _hash, children };
}

/**
 * Validate that the children property is a string literal
 */
export function validateChildrenProperty(
  args: t.ObjectExpression,
  state: TransformState
): {
  errors: string[];
  value?: JsxChildren;
} {
  const errors: string[] = [];

  // Get the children property
  const childrenValidation = validateChildrenPropertyFromObjectExpression(args);
  if (childrenValidation.errors.length > 0) {
    errors.push(...childrenValidation.errors);
    return { errors };
  }
  const children = childrenValidation.value;
  if (children === undefined) {
    errors.push(`The <${GT_COMPONENT_TYPES.T}> component must have children`);
    return { errors };
  }

  // TODO: remove
  // recordInputs(children, state);

  // Validate that the children property is a string literal
  const validation = constructJsxChildren(children, state);
  errors.push(...validation.errors);
  const value = validation.value;

  return { errors, value };
}

/**
 * Will validate and retrieve property from object expression and also try prefixing with a $
 *
 */
function validateStringProperty(
  args: t.ObjectExpression,
  name: string
): {
  errors: string[];
  value?: string;
} {
  const errors: string[] = [];

  // Get the property
  const property =
    getObjectPropertyFromObjectExpression(args, name) ||
    getObjectPropertyFromObjectExpression(args, '$' + name);
  if (!property) {
    return { errors };
  }

  // Validate property
  const validation = validateObjectPropertyIsStringLiteral(property, name);
  errors.push(...validation.errors);
  const value = validation.value;

  return { errors, value };
}

/**
 * Validate that an object property is a string literal
 */
function validateObjectPropertyIsStringLiteral(
  arg: t.SpreadElement | t.ObjectMethod | t.ObjectProperty,
  name: string
): {
  errors: string[];
  value?: string;
} {
  const errors: string[] = [];

  // Validate the property is a string literal from an expression
  if (
    !t.isObjectProperty(arg) ||
    !t.isExpression(arg.value) ||
    !validateExpressionIsStringLiteral(arg.value)
  ) {
    errors.push(
      `The <${GT_COMPONENT_TYPES.T}> component must have a string literal in its ${name} field`
    );
    return { errors };
  }

  // Get the string literal
  const value = getStringLiteralFromExpression(arg.value);
  return { errors, value };
}

/**
 * Given an expression, return the string literal (throws an error if not a string literal)
 */
function getStringLiteralFromExpression(
  expr: t.Expression
): string | undefined {
  if (t.isStringLiteral(expr)) {
    return expr.value;
  }
  if (t.isTemplateLiteral(expr)) {
    if (expr.expressions.length === 0) {
      return expr.quasis[0]?.value.cooked || '';
    }
  }
}

// TODO: remove
function recordInputs(children: any, state: TransformState) {
  // console.log(`[GT_PLUGIN] Recording inputs`);
  const output = {
    children,
    state: {
      stringCollector: state.stringCollector.serialize(),
      scopeTracker: state.scopeTracker.serialize(),
    },
  };
  const stringifiedOutput = JSON.stringify(output, null, 2);

  const fs = require('fs');
  const path = require('path');

  const outputDir = path.dirname(state.settings.filename || '');
  const filePath = path.join(outputDir, 'state.json');

  if (!fs.existsSync(filePath)) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }
  // console.log('[GT_PLUGIN] Writing to', filePath);
  fs.writeFileSync(filePath, stringifiedOutput);
}
