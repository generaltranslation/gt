import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import {
  isTranslationComponent,
  isTranslationFunctionCallback,
} from '../../utils/constants/gt/helpers';
import { getCalleeNameFromExpression } from '../../utils/parsing/getCalleeNameFromExpression';
import {
  GT_ALL_FUNCTIONS,
  GT_CALLBACK_FUNCTIONS,
  GT_OTHER_FUNCTIONS,
} from '../../utils/constants/gt/constants';
import {
  validateUseGTCallback,
  validateUseMessagesCallback,
  validateUseTranslationsCallback,
} from '../../utils/validation/validateTranslationFunctionCallback';
import { registerUseGTCallback } from '../../transform/registration/callbacks/registerUseGTCallback';
import { regsiterUseTranslationsCallback } from '../../transform/registration/callbacks/registerUseTranslationsCallback';
import { registerUseMessagesCallback } from '../../transform/registration/callbacks/registerUseMessagesCallback';
import { getTrackedVariable } from '../../transform/getTrackedVariable';
import { isReactFunction } from '../../utils/constants/react/helpers';
import { validateTranslationComponentArgs } from '../../transform/validation/validateTranslationComponentArgs';
import { hashSource } from 'generaltranslation/id';
import { registerTranslationComponent } from '../../transform/registration/registerTranslationComponent';
import { getCalleeNameFromJsxExpressionParam } from '../../transform/jsx-children/utils/getCalleeNameFromJsxExpressionParam';
import { createErrorLocation } from '../../utils/errors';

/**
 * Process call expressions
 * - register content from GT callback functions invocations (useGT_callback, etc.)
 * - register <T> + other component content (via jsxDev, jsx, jsxs invocations)
 * - register msg() function invocations?
 * - generally validate content
 */
export function processCallExpression(
  state: TransformState
): VisitNode<t.Node, t.CallExpression> {
  return (path) => {
    // Get the call expression
    const callExpr = path.node;

    // Get function name from callee
    const { namespaceName, functionName } =
      getCalleeNameFromExpression(callExpr);
    if (!functionName) {
      return;
    }

    // Get the canonical function name
    const { canonicalName, identifier, type } = getTrackedVariable(
      state.scopeTracker,
      namespaceName,
      functionName
    );
    if (!canonicalName) {
      return;
    }

    // Handle each respective case
    if (
      type === 'generaltranslation' &&
      isTranslationFunctionCallback(canonicalName)
    ) {
      // Handle translation function callbacks (useGT_callback, etc.)
      handleTranslationCallbackInvocation(
        callExpr,
        state,
        canonicalName,
        identifier!
      );
    } else if (type === 'react' && isReactFunction(canonicalName)) {
      // Handle react variables (jsxDEV, etc.)
      handleReactInvocation(callExpr, state);
    } else if (
      type === 'generaltranslation' &&
      canonicalName === GT_OTHER_FUNCTIONS.msg
    ) {
      // TODO: Handle msg() function
      // handleMsgFunction(callExpr, state);
    }
  };
}

/* =============================== */
/* Handlers */
/* =============================== */

/**
 * Handle general translation variables
 * useGTCallback(), useTranslationsCallback(), useMessagesCallback(), etc.
 */
function handleTranslationCallbackInvocation(
  callExpr: t.CallExpression,
  state: TransformState,
  canonicalName: GT_ALL_FUNCTIONS,
  identifier: number
) {
  // Handle translation function callbacks ()
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
  registerUseGTCallback(
    identifier,
    state,
    useGTCallbackParams.content!,
    useGTCallbackParams.context,
    useGTCallbackParams.id,
    useGTCallbackParams.hash
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
  regsiterUseTranslationsCallback(identifier, state);
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
  registerUseMessagesCallback(identifier, state);
}

/**
 * Handle react function invocations
 * jsxDEV, jsx, jsxs, ...
 *
 * We want to check these because they wrap <T> and other components
 */
function handleReactInvocation(
  callExpr: t.CallExpression,
  state: TransformState
) {
  // Check if it contains a GT component (first argument)
  if (callExpr.arguments.length === 0) {
    state.errorTracker.addError(
      'React invocation must have at least one argument' +
        createErrorLocation(callExpr)
    );
    return;
  }
  const firstArg = callExpr.arguments[0];
  if (!t.isExpression(firstArg)) {
    state.errorTracker.addError(
      'React invocation first argument must be an expression' +
        createErrorLocation(callExpr)
    );
    return;
  }

  // Get function name from callee
  const { namespaceName, functionName } =
    getCalleeNameFromJsxExpressionParam(firstArg);
  if (!functionName) {
    state.errorTracker.addError(
      'React invocation first argument must be a function' +
        createErrorLocation(callExpr)
    );
    return;
  }
  // Get the canonical function name
  const { canonicalName, type } = getTrackedVariable(
    state.scopeTracker,
    namespaceName,
    functionName
  );
  if (!canonicalName) {
    return;
  }

  // Filter out non-GT components
  if (type !== 'generaltranslation' || !isTranslationComponent(canonicalName)) {
    return;
  }

  // Validate the arguments
  const { errors, _hash, id, context, children } =
    validateTranslationComponentArgs(callExpr, canonicalName, state);

  if (errors.length > 0) {
    state.errorTracker.addErrors(errors);
    return;
  }

  // Calculate hash
  const hash =
    _hash ||
    hashSource({
      source: children!,
      ...(context && { context }),
      ...(id && { id }),
      dataFormat: 'JSX',
    });

  // Track the component (increment counter, initialize aggregator, set hash)
  registerTranslationComponent(state, hash);
}
