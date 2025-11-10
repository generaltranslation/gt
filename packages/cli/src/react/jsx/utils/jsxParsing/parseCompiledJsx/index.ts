import * as t from '@babel/types';
import { JsxTree, MultiplicationNode } from '../types.js';
import { NodePath } from '@babel/traverse';
import { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { isStaticExpression } from '../../../evaluateJsx.js';
import generateModule from '@babel/generator';
import { isCreateElement } from './utils/isCreateElement.js';
import { warnFailedToConstructJsxTreeSync } from '../../../../../console/index.js';
import { getTypeName } from './utils/createElement/getTypeName.js';
import { getChildren } from './utils/createElement/getChildren.js';

// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

type Options = {
  errors: string[];
  warnings: Set<string>;
  file: string;
  unwrappedExpressions: string[];
  visited: Set<string>;
  parsingOptions: ParsingConfigOptions;
  importedFunctionsMap: Map<string, string>;
  importAliases: Record<string, string>;
};
/**
 * Given an expression of a compiled JSX tree, constructs a JsxTree or MultiplicationNode
 */
export function parseCompiledExpression({
  expression,
  options,
}: {
  expression: NodePath<t.Expression>;
  options: Options;
}): JsxTree | MultiplicationNode {
  // === Handle static cases === //
  if (expression.isNullLiteral()) {
    // If it's null, return null
    return null;
  } else if (expression.isBooleanLiteral() || expression.isStringLiteral()) {
    // If it's a boolean or string literal, return the value
    return expression.node.value;
  } else if (expression.isNumericLiteral()) {
    // If it's a numeric literal, return the value as a string
    return expression.node.value.toString();
  } else if (expression.isUnaryExpression()) {
    // If it's a unary expression, return the expression
    const staticAnalysis = isStaticExpression(expression.node, true);
    if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
      return staticAnalysis.value;
    }
    return generate(expression.node).code;
  } else if (expression.isTemplateLiteral()) {
    // We've already checked that it's static, and and added a warning if it's not, this check is just for fallback behavior
    if (
      !isStaticExpression(expression.node, true).isStatic ||
      expression.node.quasis[0].value.cooked === undefined
    ) {
      return generate(expression.node).code;
    }
    return expression.node.quasis[0].value.cooked;
  }
  // === handle jsx === //
  if (expression.isCallExpression()) {
    return handleCallExpression({
      callExpression: expression,
      options,
    });
  }

  let value: JsxChildren | undefined;
  if (t.isArrayExpression(expression)) {
    // Handle ArrayExpression
    value = [];

    for (const child of expression.elements) {
      // Validate child
      if (!validateChildrenElement(child)) {
        errors.push(
          generateDynamicContentErrorMessage() +
            (child && createErrorLocation(child))
        );
        return { errors };
      }

      // Special children edge cases: nullLiteral, booleanLiteral
      if (t.isBooleanLiteral(child) || t.isNullLiteral(child)) {
        continue;
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
    const validation = constructJsxChild(expression, state, id);
    errors.push(...validation.errors);
    if (errors.length > 0) {
      return { errors };
    }
    value = validation.value;
  }

  return { errors, value };
}

/**
 * Given a CallExpression, construct tree
 */
function handleCallExpression({
  callExpression,
  options,
}: {
  callExpression: NodePath<t.CallExpression>;
  options: Options;
}): JsxTree | MultiplicationNode {
  // First figure out if we are dealing with a react create element call
  if (isCreateElement(callExpression)) {
    const typeName = getTypeName(callExpression, options);
    if (typeName === null) {
      return null;
    }
    const children = getChildren(callExpression);
    if (children === undefined) {
      return null;
    }
    return {
      nodeType: 'element',
      typeName,
      props: {
        children: parseCompiledExpression({ callExpression, options }),
      },
    };
  }
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
    value = child.value as unknown as JsxChild;
  } else if (t.isNullLiteral(child)) {
    value = null as unknown as JsxChild;
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
      generateDynamicContentErrorMessage() + createErrorLocation(child)
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

  // Validate that this is a jsx call
  const jsxValidation = validateJsxCall(callExpr, state);
  errors.push(...jsxValidation);
  if (jsxValidation.length > 0) {
    return { errors };
  }

  // Increment id
  id.increment();

  // Get first argument
  if (callExpr.arguments.length === 0) {
    return { errors };
  }
  const firstArg = callExpr.arguments[0];
  if (!t.isExpression(firstArg)) {
    errors.push(
      `Failed to construct JsxElement! First argument must be an expression` +
        createErrorLocation(callExpr.arguments[0])
    );
    return { errors };
  }

  // Resolve canonical name
  const { namespaceName, functionName } =
    getCalleeNameFromJsxExpressionParam(firstArg);
  if (!functionName) {
    errors.push(
      `Failed to construct JsxElement! First argument must be a valid function` +
        createErrorLocation(callExpr.arguments[0])
    );
    return { errors };
  }

  // Get the canonical function name
  const { canonicalName, type } = getTrackedVariable(
    state.scopeTracker,
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
        `Failed to construct JsxElement! ${canonicalName} is not a valid GT component` +
          createErrorLocation(callExpr.arguments[0])
      );
      return { errors };
    }
    // Get the name of the component
    componentName = canonicalName;
  } else if (canonicalName && type === 'react') {
    // Handle fragment + special react components
    if (!isReactComponent(canonicalName)) {
      errors.push(
        `Failed to construct JsxElement! ${canonicalName} is not a valid React component` +
          createErrorLocation(callExpr.arguments[0])
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
  const jsxChildrenValidation = constructJsxChildrenForJsxElement(
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
 * Construct JsxChildren for a JsxElement
 * This is slightly different from _constructJsxChildren in how it handles nullLiteral and booleanLiteral
 */
function constructJsxChildrenForJsxElement(
  children: t.Expression | undefined,
  state: TransformState,
  id: IdObject
): { errors: string[]; value?: JsxChildren } {
  const errors: string[] = [];

  // Special children edge cases: nullLiteral, booleanLiteral
  if (t.isNullLiteral(children)) {
    return { errors, value: undefined as unknown as JsxChildren };
  }
  if (t.isBooleanLiteral(children)) {
    return {
      errors,
      value: (children.value || undefined) as unknown as JsxChildren,
    };
  }

  // Construct JsxChildren
  return parseCompiledExpression({ expression: children, state, id });
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
    errors.push(
      'Failed to construct GTProp! Missing parameters' +
        createErrorLocation(args[0])
    );
    return { errors };
  }
  const parameters = args[1];
  if (!t.isObjectExpression(parameters)) {
    errors.push(
      'Failed to construct GTProp! Parameter field must be an object expression' +
        createErrorLocation(args[1])
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
      const validation = parseCompiledExpression({
        expression: parameter,
        state,
        id: id.copy(),
      });
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
    errors.push(
      'Failed to construct GTProp! Missing parameters' +
        createErrorLocation(args[0])
    );
    return { errors };
  }
  const parameters = args[1];
  if (!t.isObjectExpression(parameters)) {
    errors.push(
      'Failed to construct GTProp! Parameter field must be an object expression' +
        createErrorLocation(args[1])
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
function createErrorLocation(callExpression: NodePath<t.CallExpression>) {
  throw new Error('Function not implemented.');
}
