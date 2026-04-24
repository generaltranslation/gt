import { NodePath, VisitNode } from '@babel/traverse';
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
} from '../../transform/validation/validateTranslationFunctionCallback';
import { registerUseGTCallback } from '../../transform/registration/callbacks/registerUseGTCallback';
import { regsiterUseTranslationsCallback } from '../../transform/registration/callbacks/registerUseTranslationsCallback';
import { registerUseMessagesCallback } from '../../transform/registration/callbacks/registerUseMessagesCallback';
import { getTrackedVariable } from '../../transform/getTrackedVariable';
import { isReactFunction } from '../../utils/constants/react/helpers';
import { validateTranslationComponentArgs } from '../../transform/validation/validateTranslationComponentArgs';
import { registerTranslationComponent } from '../../transform/registration/registerTranslationComponent';
import { getCalleeNameFromJsxExpressionParam } from '../../transform/jsx-children/utils/getCalleeNameFromJsxExpressionParam';
import { createErrorLocation } from '../../utils/errors';
import hashSource from '../../utils/calculateHash';
import type { DataFormat } from 'generaltranslation/types';

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
    const callExprPath = path;
    const callExpr = callExprPath.node;

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
        callExprPath,
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
      handleStandaloneTranslation(callExprPath, state);
    } else if (
      type === 'generaltranslation' &&
      canonicalName === GT_OTHER_FUNCTIONS.t
    ) {
      handleStandaloneTranslation(callExprPath, state);
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
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState,
  canonicalName: GT_ALL_FUNCTIONS,
  identifier: number
) {
  // Handle translation function callbacks ()
  switch (canonicalName) {
    case GT_CALLBACK_FUNCTIONS.useGT_callback:
    case GT_CALLBACK_FUNCTIONS.getGT_callback:
      handleUseGTCallback(callExprPath, state, identifier);
      break;
    case GT_CALLBACK_FUNCTIONS.useTranslations_callback:
    case GT_CALLBACK_FUNCTIONS.getTranslations_callback:
      handleUseTranslationsCallback(callExprPath, state, identifier);
      break;
    case GT_CALLBACK_FUNCTIONS.useMessages_callback:
    case GT_CALLBACK_FUNCTIONS.getMessages_callback:
      handleUseMessagesCallback(callExprPath, state, identifier);
      break;
    default:
      return;
  }
}

/**
 * Handle useGT_callback / getGT_callback
 */
function handleUseGTCallback(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState,
  identifier: number
) {
  // Check for violations
  const { hasDerive, errors, variants, hash, id, format, maxChars } =
    validateUseGTCallback(callExprPath, state);
  state.errorTracker.addErrors(errors);
  if (
    errors.length > 0 ||
    variants === undefined ||
    variants.length !== 1 ||
    // TODO: remove this once we add derivation
    hasDerive
  ) {
    return;
  }

  // Track the function call
  registerUseGTCallback({
    identifier,
    state,
    content: variants[0].content,
    context: variants[0].context,
    id,
    maxChars,
    // When context contains derive(), skip hash calculation (CLI handles resolution)
    hash: hasDerive ? '' : hash,
    format,
  });
}

/**
 * Handle useTranslations_callback / getTranslations_callback
 */
function handleUseTranslationsCallback(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState,
  identifier: number
) {
  // Check for violations
  const useTranslationsCallbackParams =
    validateUseTranslationsCallback(callExprPath);
  state.errorTracker.addErrors(useTranslationsCallbackParams.errors);
  if (useTranslationsCallbackParams.errors.length > 0) {
    return;
  }

  // Track the function call
  regsiterUseTranslationsCallback({
    identifier,
    state,
  });
}

/**
 * Handle useMessages_callback / getMessages_callback
 */
function handleUseMessagesCallback(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState,
  identifier: number
) {
  // Validate parameters
  const useMessagesCallbackParams = validateUseMessagesCallback(callExprPath);

  // Check for violations
  state.errorTracker.addErrors(useMessagesCallbackParams.errors);
  if (useMessagesCallbackParams.errors.length > 0) {
    return;
  }

  // Track the function call
  registerUseMessagesCallback({
    identifier,
    state,
  });
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
  const {
    errors,
    hash: hashArg,
    id,
    context,
    children,
    maxChars,
    hasDeriveContext,
  } = validateTranslationComponentArgs(callExpr, canonicalName, state);

  if (errors.length > 0) {
    state.errorTracker.addErrors(errors);
    return;
  }

  // Calculate hash (skip when context contains derive — CLI handles resolution)
  const hash = hasDeriveContext
    ? ''
    : hashArg ||
      hashSource({
        source: children!,
        ...(context && { context }),
        ...(id && { id }),
        ...(maxChars != null && { maxChars }),
        dataFormat: 'JSX',
      });

  // Debug: record hash → children mapping
  // Note: children may be undefined when autoderive filters all dynamic-content
  // errors (the early return in _constructJsxChildren means value is never set).
  // This is intentional — the compiler signals CLI resolution via hash=''.
  if (state.debugManifest) {
    state.debugManifest.set(hash, children ?? null);
  }

  // Track the component (increment counter, initialize aggregator, set hash)
  registerTranslationComponent(state, hash, { children, id, context });
}

/**
 * Handle standalone translation functions: t() and msg()
 * Same argument structure as useGT_callback (message string + options object).
 * Pushes to runtimeOnlyEntries — bypasses the counter system so injection is unaffected.
 */
function handleStandaloneTranslation(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
) {
  // Reuse the same validation as useGT_callback (identical argument structure)
  const {
    hasDerive,
    errors,
    variants,
    hash: hashArg,
    id,
    format,
    maxChars,
  } = validateUseGTCallback(callExprPath, state);
  if (
    errors.length > 0 ||
    variants === undefined ||
    variants.length !== 1 ||
    // TODO: remove this once we add derivation
    hasDerive
  ) {
    return;
  }

  // Calculate hash
  const hash =
    hashArg ??
    hashSource({
      source: variants[0].content,
      ...(id && { id }),
      ...(variants[0].context && { context: variants[0].context }),
      ...(maxChars != null && { maxChars }),
      dataFormat: (format || 'ICU') as DataFormat,
    });

  // Push to runtime-only entries (no counter, no injection pass involvement)
  state.stringCollector.pushRuntimeOnlyContent({
    message: variants[0].content,
    hash,
    id,
    context: variants[0].context,
    maxChars,
    format,
  });
}
