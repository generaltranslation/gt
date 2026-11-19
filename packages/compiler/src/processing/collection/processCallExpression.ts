import { NodePath, VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { isTranslationComponent } from '../../utils/constants/gt/helpers';
import { getCalleeNameFromExpression } from '../../utils/parsing/getCalleeNameFromExpression';
import { getTrackedVariable } from '../../transform/getTrackedVariable';
import { isReactFunction } from '../../utils/constants/react/helpers';
import { validateTranslationComponentArgs } from '../../transform/validation/validateTranslationComponentArgs';
import { registerTranslationComponent } from '../../transform/registration/registerTranslationComponent';
import { getCalleeNameFromJsxExpressionParam } from '../../transform/jsx-children/utils/getCalleeNameFromJsxExpressionParam';
import { createErrorLocation } from '../../utils/errors';
import hashSource from '../../utils/calculateHash';

/**
 * Process call expressions
 * - register <T> + other component content (via jsxDev, jsx, jsxs invocations)
 * - generally validate content
 */
export function processCallExpression(
  state: TransformState
): VisitNode<t.Node, t.CallExpression> {
  return (callExprPath) => {
    // Get the call expression
    const callExpr = callExprPath.node;

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

    if (type === 'react' && isReactFunction(canonicalName)) {
      // Handle react variables (jsxDEV, etc.)
      handleReactInvocation(callExprPath, state);
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
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
) {
  const callExpr = callExprPath.node;
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
  const {
    errors,
    _hash,
    id,
    context,
    children,
    maxChars,
    requiresReview,
    hasDeriveContext,
    hasDeriveChildren,
  } = validateTranslationComponentArgs(callExprPath, canonicalName, state);

  if (errors.length > 0) {
    state.errorTracker.addErrors(errors);
    return;
  }

  // Calculate hash (skip when context contains derive or children contain a
  // <Derive> element — one hash per resolved variant, so the runtime computes
  // it; the CLI handles variant resolution)
  const hash =
    hasDeriveContext || hasDeriveChildren
      ? ''
      : _hash ||
        hashSource({
          source: children!,
          ...(context && { context }),
          ...(maxChars != null && { maxChars }),
          ...(requiresReview === true && { requiresReview: true }),
          dataFormat: 'JSX',
        });

  // Debug: record hash → children mapping
  // Note: children may be undefined when autoderive filters all dynamic-content
  // errors (the early return in constructJsxChildren means value is never set).
  // This is intentional — the compiler signals CLI resolution via hash=''.
  if (state.debugManifest) {
    state.debugManifest.set(hash, children ?? null);
  }

  // Track the component (increment counter, initialize aggregator, set hash)
  registerTranslationComponent(state, hash, {
    children,
    id,
    context,
    requiresReview,
  });
}
