import { VisitNode } from '@babel/traverse';
import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { GT_OTHER_FUNCTIONS } from '../../utils/constants/gt/constants';
import { getCalleeNameFromExpression } from '../../utils/jsx/getCalleeNameFromExpression';
import { getTrackedVariable } from '../../transform/getTrackedVariable';
import { isTranslationComponent } from '../../utils/constants/gt/helpers';
import { isReactFunction } from '../../utils/constants/react/helpers';
import { getCalleeNameFromJsxExpressionParam } from '../../transform/jsx-children/utils/getCalleeNameFromJsxExpressionParam';
import { injectTComponentParameters } from '../../transform/injection/injectTComponentParameters';
import { createErrorLocation } from '../../utils/errors';
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
    if (type === 'react' && isReactFunction(canonicalName)) {
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
