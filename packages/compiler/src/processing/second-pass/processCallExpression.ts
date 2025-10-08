import { VisitNode } from '@babel/traverse';
import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import {
  GT_ALL_FUNCTIONS,
  GT_CALLBACK_FUNCTIONS,
  GT_OTHER_FUNCTIONS,
} from '../../utils/constants/gt/constants';
import { getCalleeNameFromExpression } from '../../utils/parsing/getCalleeNameFromExpression';
import { getTrackedVariable } from '../../transform/getTrackedVariable';
import {
  isTranslationComponent,
  isTranslationFunctionCallback,
} from '../../utils/constants/gt/helpers';
import { isReactFunction } from '../../utils/constants/react/helpers';
import { getCalleeNameFromJsxExpressionParam } from '../../transform/jsx-children/utils/getCalleeNameFromJsxExpressionParam';
import { injectTComponentParameters } from '../../transform/injection/injectTComponentParameters';
import { createErrorLocation } from '../../utils/errors';
import { injectUseGTCallbackParameters } from '../../transform/injection/callbacks/injectUseGTCallbackParameters';
import { injectUseTranslationsCallbackParameters } from '../../transform/injection/callbacks/injectUseTranslationsCallbackParameters';
import { injectUseMessagesCallbackParameters } from '../../transform/injection/callbacks/injectUseMessagesCallbackParameters';
/**
 * Process call expression:
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
    const { canonicalName, type } = getTrackedVariable(
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
      handleTranslationCallbackInvocation(callExpr, state, canonicalName);
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
  canonicalName: GT_ALL_FUNCTIONS
) {
  // Handle translation function callbacks ()
  switch (canonicalName) {
    case GT_CALLBACK_FUNCTIONS.useGT_callback:
    case GT_CALLBACK_FUNCTIONS.getGT_callback:
      injectUseGTCallbackParameters(callExpr, state);
      break;
    case GT_CALLBACK_FUNCTIONS.useTranslations_callback:
    case GT_CALLBACK_FUNCTIONS.getTranslations_callback:
      injectUseTranslationsCallbackParameters(callExpr, state);
      break;
    case GT_CALLBACK_FUNCTIONS.useMessages_callback:
    case GT_CALLBACK_FUNCTIONS.getMessages_callback:
      injectUseMessagesCallbackParameters(callExpr, state);
      break;
    default:
      return;
  }
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

  // Track the component (increment counter, initialize aggregator, set hash)
  injectTComponentParameters(callExpr, state);
}
