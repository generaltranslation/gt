import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import {
  isGTFunction,
  isTranslationFunctionCallback,
} from '../../utils/constants/gt/helpers';
import { getCalleeNameFromExpression } from '../../utils/jsx/getCalleeNameFromExpression';
import {
  GT_ALL_FUNCTIONS,
  GT_CALLBACK_FUNCTIONS,
} from '../../utils/constants/gt/constants';
import {
  validateUseGTCallback,
  validateUseMessagesCallback,
  validateUseTranslationsCallback,
} from '../../utils/validation/validateTranslationFunctionCallback';
import { getStringLiteralFromExpression } from '../../utils/jsx/getStringLiteralFromExpression';
import { getStringLiteralFromObjectExpression } from '../../utils/jsx/getStringLiteralFromObjectExpression';
import { registerUseGTCallback } from '../../transform/registration/callbacks/registerUseGTCallback';
import { regsiterUseTranslationsCallback } from '../../transform/registration/callbacks/registerUseTranslationsCallback';
import { registerUseMessagesCallback } from '../../transform/registration/callbacks/registerUseMessagesCallback';
import { VariableType } from '../../state/ScopeTracker';

/**
 * Process call expressions
 * - register content from GT callback functions invocations (useGT_callback, etc.)
 * - register <T> + other component content (via jsxDev, jsx, jsxs invocations)
 * - register msg() function invocations?
 * - generally validate content
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

  // Get the canonical function name
  const canonicalFunctionName = getCanonicalFunctionName(
    state,
    namespaceName,
    functionName
  );

  if (state.settings.filename?.endsWith('page.tsx')) {
    console.log(
      '[GT_PLUGIN] processCallExpression',
      JSON.stringify(callExpr, null, 2)
    );
  }

  // Check if this is a tracked function
  let canonicalName: GT_ALL_FUNCTIONS;
  let identifier: number;
  let type: VariableType;
  if (namespaceName) {
    if (state.importTracker.namespaceImports.has(namespaceName)) {
      canonicalName = functionName as GT_ALL_FUNCTIONS;
      // Invalid identifier number, we aren't tracking namespace imports (eg you will never see GT.gt() GT.t() nor GT.m())
      identifier = -1;
      type = 'generaltranslation';
    } else {
      return;
    }
  } else {
    const variable = state.importTracker.scopeTracker.getVariable(functionName);
    if (!variable) {
      return;
    }
    canonicalName = variable.canonicalName as GT_ALL_FUNCTIONS;
    identifier = variable.identifier;
    type = variable.type;
  }

  // Handle different types of variables
  if (type === 'generaltranslation') {
    handleGeneralTranslationVariable(
      callExpr,
      state,
      canonicalName as GT_ALL_FUNCTIONS,
      identifier
    );
  } else if (type === 'react') {
    handleReactVariable(callExpr, state);
  } else if (type === 'other') {
    // TODO: handle other variables
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
    // Handle translation function callbacks (useGTCallback(), useTranslationsCallback(), useMessagesCallback())
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
  } else if (isGTFunction(canonicalName)) {
    // Handle GT functions (useGT(), useTranslations(), useMessages(), msg())
    // switch (canonicalName) {
    //   case GT_FUNCTIONS.useGT:
    //   case GT_FUNCTIONS.getGT:
    //     handleUseGT(callExpr, state, identifier);
    //     break;
    //   case GT_FUNCTIONS.useTranslations:
    //   case GT_FUNCTIONS.getTranslations:
    //     handleUseTranslations(callExpr, state, identifier);
    //     break;
    //   case GT_FUNCTIONS.useMessages:
    //   case GT_FUNCTIONS.getMessages:
    //     handleUseMessages(callExpr, state, identifier);
    //     break;
    //   case GT_FUNCTIONS.msg:
    //     handleMsg(callExpr, state, identifier);
    //     break;
    //   default:
    //     return;
    // }
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
