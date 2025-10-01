import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { getCalleeExprFunctionName } from '../../transform/transform';
import { isTranslationFunctionCallback } from '../../utils/constants/helpers';
import { isJsxFunction } from '../../utils/constants/helpers';
import { extractComponentNameFromJSXCall } from '../../transform/jsxUtils';
import { extractPropFromJSXCall } from '../../transform/jsxUtils';
import { isTranslationComponent } from '../../utils/constants/helpers';
import { isVariableComponent } from '../../utils/constants/helpers';
import { isBranchComponent } from '../../utils/constants/helpers';
import { checkCallExprForViolations } from '../../transform/transform';
import { trackTranslationCallback } from '../../transform/variableTracking/trackTranslationCallback';
import { getCalleeNameFromExpression } from '../../utils/jsx/getCalleeNameFromExpression';
import {
  GT_ALL_FUNCTIONS,
  GT_CALLBACK_FUNCTIONS,
} from '../../utils/constants/constants';
import {
  validateTranslationFunctionCallback,
  validateUseGTCallback,
  validateUseMessagesCallback,
  validateUseTranslationsCallback,
} from '../../utils/validation/validateTranslationFunctionCallback';
import { getStringLiteralFromExpression } from '../../utils/jsx/getStringLiteralFromExpression';
import { getObjectPropertyFromObjectExpression } from '../../utils/jsx/getObjectPropertyFromObjectExpression';
import { getStringLiteralFromObjectExpression } from '../../utils/jsx/getStringLiteralFromObjectExpression';
import { trackUseGTCallback } from '../../transform/variableTracking/callbacks/trackUseGTCallback';
import { trackUseTranslationsCallback } from '../../transform/variableTracking/callbacks/trackUseTranslationsCallback';
import { trackUseMessagesCallback } from '../../transform/variableTracking/callbacks/trackUseMessagesCallback';

/**
 * Process call expressions
 * - detect gt() invocations
 * - check for violations
 * - register strings, hashes
 */
export function processCallExpression(
  path: NodePath<t.CallExpression>,
  state: TransformState
) {
  // Get the call expression
  const callExpr = path.node;

  // Get function name from callee
  const { namespaceName, functionName } = getCalleeNameFromExpression(callExpr);
  if (!functionName) {
    return;
  }

  // Check if this is a tracked function
  const variable = state.importTracker.scopeTracker.getVariable(functionName);
  if (!variable) {
    return;
  }
  const { canonicalName, identifier, type } = variable;

  // Handle different types of variables
  if (type === 'generaltranslation') {
    if (state.settings.filename?.endsWith('page.tsx')) {
      console.log(
        '[GT-PLUGIN] Processing function invocation: ',
        canonicalName
      );
    }
    handleGeneralTranslationVariable(
      callExpr,
      state,
      canonicalName as GT_ALL_FUNCTIONS,
      identifier
    );
  } else if (type === 'react') {
    handleReactVariable(callExpr, state);
  }

  /*
  if (variable && variable.type !== 'other') {
    // Register the useGT/getGT as aggregators on the string collector
    const originalName = variable.canonicalName;
    const identifier = variable.identifier;

    // Detect t() calls (translation function callbacks)
    if (isTranslationFunctionCallback(originalName)) {
      if (callExpr.arguments && callExpr.arguments.length > 0) {
        const firstArg = callExpr.arguments[0];
        if (t.isArgumentPlaceholder(firstArg)) {
          return;
        }

        // Check for violations
        checkCallExprForViolations(firstArg, functionName, state);

        // Track the t() function call
        trackTranslationCallback(callExpr, firstArg, identifier, state);
      }
    } else if (isJsxFunction(originalName)) {
      // For JSX function, process their children

      // Get the name of the component
      const componentName = extractComponentNameFromJSXCall(callExpr);
      if (!componentName) {
        return;
      }

      // Map it back to an original name
      const translationVariable =
        state.importTracker.scopeTracker.getTranslationVariable(componentName);
      if (!translationVariable) {
        return;
      }
      const originalName = translationVariable.canonicalName;
      const identifier = translationVariable.identifier;

      if (isTranslationComponent(originalName)) {
        // Get children
        const children = extractPropFromJSXCall(callExpr, 'children');
        if (!children) {
          return;
        }

        // Get id & context
        const id = extractPropFromJSXCall(callExpr, 'id');
        const context = extractPropFromJSXCall(callExpr, 'context');

        // TODO: Check for violations

        // Calculate hash
        // TODO: add id & context to options
        // const { hash } = hashExpression(children, undefined);
        // if (!hash) {
        //   return false;
        // }

        // TODO: add to string collector
        // TODO: add to string collector for the t() function
      } else if (isVariableComponent(originalName)) {
      } else if (isBranchComponent(originalName)) {
      } else {
        return;
      }
    }
  }

  return; // This is collection pass - no transformations yet
  */
}

/* =============================== */
/* Handlers */
/* =============================== */

/**
 * Handle general translation variables
 */
function handleGeneralTranslationVariable(
  callExpr: t.CallExpression,
  state: TransformState,
  canonicalName: GT_ALL_FUNCTIONS,
  identifier: number
) {
  if (isTranslationFunctionCallback(canonicalName)) {
    switch (canonicalName) {
      case GT_CALLBACK_FUNCTIONS.useGT_callback:
      case GT_CALLBACK_FUNCTIONS.getGT_callback:
        handleUseGTCallback(callExpr, state, identifier);
        break;
      case GT_CALLBACK_FUNCTIONS.useTranslations_callback:
      case GT_CALLBACK_FUNCTIONS.getTranslations_callback:
        handleUseTranslationsCallback(callExpr, state, identifier);
        break;
      case GT_CALLBACK_FUNCTIONS.useMessages_callback:
      case GT_CALLBACK_FUNCTIONS.getMessages_callback:
        handleUseMessagesCallback(callExpr, state, identifier);
        break;
      default:
        return;
    }
  } else if (is(canonicalName)) {
    switch (
      canonicalName
      // case GT_FUNCTIONS
    ) {
    }
  }
}

/**
 * Handle useGT_callback / getGT_callback
 */
function handleUseGTCallback(
  callExpr: t.CallExpression,
  state: TransformState,
  identifier: number
) {
  // Check for violations
  const useGTCallbackParams = validateUseGTCallback(callExpr);
  state.errorTracker.addErrors(useGTCallbackParams.errors);
  if (useGTCallbackParams.errors.length > 0) {
    return;
  }

  // Track the function call
  trackUseGTCallback(
    identifier,
    state,
    useGTCallbackParams.content!,
    useGTCallbackParams.context,
    useGTCallbackParams.id
  );
}

/**
 * Handle useTranslations_callback / getTranslations_callback
 */
function handleUseTranslationsCallback(
  callExpr: t.CallExpression,
  state: TransformState,
  identifier: number
) {
  // Check for violations
  const useTranslationsCallbackParams =
    validateUseTranslationsCallback(callExpr);
  state.errorTracker.addErrors(useTranslationsCallbackParams.errors);
  if (useTranslationsCallbackParams.errors.length > 0) {
    return;
  }

  // Track the function call
  trackUseTranslationsCallback(identifier, state);
}

/**
 * Handle useMessages_callback / getMessages_callback
 */
function handleUseMessagesCallback(
  callExpr: t.CallExpression,
  state: TransformState,
  identifier: number
) {
  // Validate parameters
  const useMessagesCallbackParams = validateUseMessagesCallback(callExpr);

  // Check for violations
  state.errorTracker.addErrors(useMessagesCallbackParams.errors);
  if (useMessagesCallbackParams.errors.length > 0) {
    return;
  }

  // Track the function call
  trackUseMessagesCallback(identifier, state);
}

/**
 * Handle react variables
 */
function handleReactVariable(
  callExpr: t.CallExpression,
  state: TransformState
) {}

function getParamsFromUseGTCallback(callExpr: t.CallExpression): {
  content: string;
  context?: string;
  id?: string;
} {
  // Get content
  const content = getStringLiteralFromExpression(
    callExpr.arguments[0] as t.Expression
  );
  if (!content) {
    throw new Error(
      'Validation check failed - content is not a string literal'
    );
  }

  // Get second argument
  const secondArg =
    callExpr.arguments.length > 1 ? callExpr.arguments[1] : undefined;
  if (!secondArg || !t.isObjectExpression(secondArg)) {
    return { content };
  }

  // Get context and id
  const context = getStringLiteralFromObjectExpression(secondArg, '$context');
  const id = getStringLiteralFromObjectExpression(secondArg, '$id');

  return { content, context, id };
}
