import {
  GTProp,
  HTML_CONTENT_PROPS,
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
  VariableType as GTVariableType,
} from 'generaltranslation/types';
import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { validateIdentifier } from './validation/validateIdentifier';
import { validateTemplateLiteral } from './validation/validateTemplateLiteral';
import { validateChildrenElement } from './validation/validateChildrenElement';
import { getCalleeNameFromJsxExpressionParam } from './utils/getCalleeNameFromJsxExpressionParam';
import { getTrackedVariable } from '../getTrackedVariable';
import { isReactComponent } from '../../utils/constants/react/helpers';
import { REACT_COMPONENTS } from '../../utils/constants/react/constants';
import { validateChildrenFromArgs } from './validation/validateChildrenFromArgs';
import { IdObject } from './utils/id';
import { VariableType } from '../../state/ScopeTracker';
import {
  defaultVariableNames,
  getVariableName,
  isBranchComponent,
  isGTComponent,
  isVariableComponent,
  minifyCanonicalName,
} from '../../utils/constants/gt/helpers';
import { validateStringLiteralPropertyFromArg } from './validation/validateStringLiteralPropertyFromArg';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';
import { getBranchComponentParameters } from './utils/getBranchComponentParameters';
import { validateNameFieldForVarComponent } from './validation/validateNameFieldForVarComponent';
import { validateUnaryExpression } from './validation/validateUnaryExpression';

/**
 * Given the children of a <T> component, constructs a JsxChildren object
 * Takes an Expression
 *
 * ONLY does JsxChildren construction + validation, no further processing on any children
 *
 * On invalid children, quit immediately
 */
export function _constructJsxChildren(
  children: t.Expression | undefined,
  state: TransformState,
  id: IdObject = new IdObject()
): { errors: string[]; value?: JsxChildren } {
  const errors: string[] = [];

  // Skip if no children
  if (!children) {
    return { errors, value: children };
  }

  // Edge case: true booleanLiteral
  if (t.isBooleanLiteral(children) && children.value) {
    return { errors, value: children.value as unknown as JsxChildren };
  }

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
      const validation = constructJsxChild(child, state, id);
      errors.push(...validation.errors);
      if (errors.length > 0) {
        return { errors };
      }
      // Skip if no value
      if (validation.value === undefined) continue;
      (value as JsxChild[]).push(validation.value!);
    }
  } else {
    // Handle single child
    const validation = constructJsxChild(children, state, id);
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
  state: TransformState,
  id: IdObject
): { errors: string[]; value?: JsxChild } {
  const errors: string[] = [];
  let value: JsxChild | undefined;

  if (t.isCallExpression(child)) {
    // Construct JsxElement
    const validation = constructJsxElement(child, state, id);
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
    value = undefined;
  } else if (t.isNullLiteral(child)) {
    value = undefined;
  } else if (t.isUnaryExpression(child)) {
    const validation = validateUnaryExpression(child);
    errors.push(...validation.errors);
    if (errors.length > 0) {
      return { errors };
    }
    value = validation.value;
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
  state: TransformState,
  id: IdObject
): { errors: string[]; value?: JsxElement | Variable } {
  const errors: string[] = [];

  // Increment id
  id.increment();

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
  const { canonicalName, type } = getTrackedVariable(
    state.importTracker,
    namespaceName,
    functionName
  );

  // Handle variable components
  if (
    canonicalName &&
    type === 'generaltranslation' &&
    isVariableComponent(canonicalName)
  ) {
    const variableValidation = constructVariable(
      canonicalName,
      callExpr.arguments,
      id
    );
    errors.push(...variableValidation.errors);
    if (variableValidation.errors.length > 0) {
      return { errors };
    }
    const variable: Variable = variableValidation.value!;
    return { errors, value: variable };
  }

  // Set the component name
  let componentName: string;
  const idNumber: number = id.get();
  if (canonicalName && type === 'generaltranslation') {
    // Handle GT components: <Var>, <Num>, <Currency>, etc.

    // Check that this is a gt component
    if (!isGTComponent(canonicalName)) {
      errors.push(
        `Failed to construct JsxElement! ${canonicalName} is not a valid GT component`
      );
      return { errors };
    }
    // Get the name of the component
    componentName = canonicalName;
  } else if (canonicalName && type === 'react') {
    // Handle fragment + special react components
    if (!isReactComponent(canonicalName)) {
      errors.push(
        `Failed to construct JsxElement! ${canonicalName} is not a valid React component`
      );
      return { errors };
    }

    // Get the name of the componet
    componentName =
      canonicalName === REACT_COMPONENTS.Fragment
        ? `C${id.get()}`
        : functionName;
  } else {
    // Handle all other components: div, etc.
    componentName = functionName;
  }

  // Get children from args
  const childrenValidation = validateChildrenFromArgs(callExpr.arguments);
  if (childrenValidation.errors.length > 0) {
    errors.push(...childrenValidation.errors);
    return { errors };
  }

  // Construct JsxChildren
  const jsxChildrenValidation = _constructJsxChildren(
    childrenValidation.value,
    state,
    id
  );
  errors.push(...jsxChildrenValidation.errors);
  if (jsxChildrenValidation.errors.length > 0) {
    return { errors };
  }
  const children: JsxChildren | undefined = jsxChildrenValidation.value;

  // Construct GT Tag
  const tagValidation = constructGTProp(
    callExpr.arguments,
    id,
    state,
    canonicalName,
    type
  );
  errors.push(...tagValidation.errors);
  if (tagValidation.errors.length > 0) {
    return { errors };
  }
  const tag: GTProp | undefined = tagValidation.value;

  // Return result
  const value: JsxElement = {
    t: componentName,
    i: idNumber,
    ...(tag !== undefined && { d: tag }),
    ...(children !== undefined && { c: children }),
  };
  return { errors, value };
}

/**
 * Given a canonical name, constructs a GTProp
 */
function constructGTProp(
  args: (t.ArgumentPlaceholder | t.SpreadElement | t.Expression)[],
  id: IdObject,
  state: TransformState,
  canonicalName?: string,
  type?: VariableType
): { errors: string[]; value?: GTProp } {
  const errors: string[] = [];
  const value: GTProp = {};

  // Validate Parameters
  if (args.length < 2) {
    errors.push('Failed to construct GTProp! Missing parameters');
    return { errors };
  }
  const parameters = args[1];
  if (!t.isObjectExpression(parameters)) {
    errors.push(
      'Failed to construct GTProp! Parameter field must be an object expression'
    );
    return { errors };
  }

  // For Branch and Plural, get the properties
  if (
    canonicalName &&
    type === 'generaltranslation' &&
    isBranchComponent(canonicalName)
  ) {
    // Get the branching parameters
    const branchingParameters = getBranchComponentParameters(
      parameters,
      canonicalName
    );

    // Add branch component branches
    const branches = {} as Record<string, JsxChildren>;

    // Add branch component branches
    for (const [name, parameter] of branchingParameters) {
      // Special exceptions for branches:
      if (t.isNullLiteral(parameter)) {
        branches[name] = null as unknown as JsxChildren;
        continue;
      } else if (t.isBooleanLiteral(parameter)) {
        branches[name] = parameter.value as unknown as JsxChildren;
        continue;
      }

      // Otherwise, construct the JsxChildren
      const validation = _constructJsxChildren(parameter, state, id.copy());
      errors.push(...validation.errors);
      if (validation.errors.length > 0) {
        return { errors };
      }
      if (validation.value === undefined) continue;
      branches[name] = validation.value;
    }

    if (Object.keys(branches).length > 0) {
      value['b'] = branches;
      value['t'] = canonicalName === GT_COMPONENT_TYPES.Branch ? 'b' : 'p';
    }
  } else {
    // Get the html content props
    Object.entries(HTML_CONTENT_PROPS).forEach(([prop, name]) => {
      const validation = validateStringLiteralPropertyFromArg(parameters, name);
      if (validation.errors.length > 0) {
        errors.push(...validation.errors);
        return { errors };
      }
      if (validation.value === undefined) return;
      value[prop as keyof typeof HTML_CONTENT_PROPS] = validation.value;
    });
  }

  // Return result
  return { errors, value: Object.keys(value).length > 0 ? value : undefined };
}

/**
 * Construct Variable
 */
function constructVariable(
  canonicalName: GT_COMPONENT_TYPES,
  args: (t.ArgumentPlaceholder | t.SpreadElement | t.Expression)[],
  id: IdObject
): { errors: string[]; value?: Variable } {
  const errors: string[] = [];
  // Validate Parameters
  if (args.length < 2) {
    errors.push('Failed to construct GTProp! Missing parameters');
    return { errors };
  }
  const parameters = args[1];
  if (!t.isObjectExpression(parameters)) {
    errors.push(
      'Failed to construct GTProp! Parameter field must be an object expression'
    );
    return { errors };
  }

  // Validate Parameters
  const nameValidation = validateNameFieldForVarComponent(parameters);
  errors.push(...nameValidation.errors);
  if (nameValidation.errors.length > 0) {
    return { errors };
  }
  const name = nameValidation.value;

  // Check for name field
  const value: Variable = {
    i: id.get(),
    k: getVariableName(
      canonicalName as keyof typeof defaultVariableNames,
      id.get(),
      name
    ),
    v: minifyCanonicalName(canonicalName) as GTVariableType,
  };

  return { errors, value };
}
