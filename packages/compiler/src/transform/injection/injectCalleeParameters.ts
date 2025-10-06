import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { getTrackedVariable } from '../getTrackedVariable';
import { getCalleeNameFromExpressionWrapper } from '../../utils/getCalleeNameFromExpressionWrapper';
import { isGTFunctionWithCallbacks } from '../../utils/constants/gt/helpers';
import { GT_FUNCTIONS_WITH_CALLBACKS } from '../../utils/constants/gt/constants';

/**
 * inject parameters into invocation of translation function
 * - useGT(messages=[{hash, message, id, context}])
 */
export function injectCalleeParameters(
  varDeclarator: t.VariableDeclarator,
  state: TransformState
): void {
  // Ignore non-LVal assignments
  if (!t.isLVal(varDeclarator.id)) {
    return;
  }

  // Get function name from callee
  const { namespaceName, functionName } = getCalleeNameFromExpressionWrapper(
    varDeclarator.init
  );
  if (!functionName) {
    return;
  }

  // Get the canonical function name
  const { canonicalName, type, identifier } = getTrackedVariable(
    state.importTracker,
    namespaceName,
    functionName
  );
  if (!canonicalName) {
    return;
  }

  // Validate the type
  if (
    type !== 'generaltranslation' ||
    !isGTFunctionWithCallbacks(canonicalName) ||
    identifier === undefined
  ) {
    return;
  }

  // Inject the parameters into the call expression
  const expression = getFunctionInvocation(varDeclarator);
  if (expression.arguments.length > 0) {
    // Found existing arguments, skip injection
    return;
  }

  // Inject into the callees
  switch (canonicalName) {
    case GT_FUNCTIONS_WITH_CALLBACKS.useGT:
    case GT_FUNCTIONS_WITH_CALLBACKS.getGT:
      injectUseGTParameters(expression, state, identifier);
      break;
    default:
      return;
  }
}

/**
 * Inject the parameters into the useGT/getGT call
 * @param arguments - The arguments
 * @param state - The state
 * @param identifier - The identifier
 * @param translationContent - The translation content
 */
function injectUseGTParameters(
  expression: t.CallExpression,
  state: TransformState,
  identifier: number
) {
  // Get the corresponding callback injection data
  const translationContent =
    state.stringCollector.getTranslationContent(identifier);
  if (!translationContent) {
    throw new Error(
      `[GT_PLUGIN] No translation content found for useGT/getGT call with identifier: ${identifier}`
    );
  }

  // Inject the parameters into the call expression
  expression.arguments = translationContent.map((content) =>
    t.objectExpression([
      t.objectProperty(t.identifier('hash'), t.stringLiteral(content.hash)),
      t.objectProperty(
        t.identifier('message'),
        t.stringLiteral(content.message)
      ),
      ...(content.id
        ? [t.objectProperty(t.identifier('id'), t.stringLiteral(content.id))]
        : []),
      ...(content.context
        ? [
            t.objectProperty(
              t.identifier('context'),
              t.stringLiteral(content.context)
            ),
          ]
        : []),
    ])
  );
}

/**
 * Get the function invocation from the variable declarator
 * @param varDeclarator - The variable declarator
 */
function getFunctionInvocation(
  varDeclarator: t.VariableDeclarator
): t.CallExpression {
  const expression = varDeclarator.init;
  if (!expression) {
    throw new Error(
      `[GT_PLUGIN] Expected expression, but no expression was found`
    );
  }
  if (t.isCallExpression(expression)) {
    return expression;
  }
  if (
    t.isAwaitExpression(expression) &&
    t.isCallExpression(expression.argument)
  ) {
    return expression.argument;
  }
  throw new Error(
    `[GT_PLUGIN] Expected call expression, got: ${expression.type}`
  );
}
