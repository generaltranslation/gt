import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { getTrackedVariable } from '../getTrackedVariable';
import { getCalleeNameFromExpressionWrapper } from '../../utils/parsing/getCalleeNameFromExpressionWrapper';
import { isGTFunctionWithCallbacks } from '../../utils/constants/gt/helpers';
import { GT_FUNCTIONS_WITH_CALLBACKS } from '../../utils/constants/gt/constants';
import { extractIdentifiersFromLVal } from '../../utils/parsing/extractIdentifiersFromLVal';
import { trackOverridingVariable } from '../tracking/trackOverridingVariable';
import { createErrorLocation } from '../../utils/errors';

/**
 * inject parameters into invocation of translation function
 * - useGT(messages=[{hash, message, id, context}])
 */
export function injectCallbackDeclaratorFunctionParameters(
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
  const { canonicalName, type } = getTrackedVariable(
    state.scopeTracker,
    namespaceName,
    functionName
  );
  if (!canonicalName) {
    return;
  }

  // Extract identifiers from the LVal
  const identifiers = extractIdentifiersFromLVal(varDeclarator.id);

  // Validate the type
  if (
    type !== 'generaltranslation' ||
    !isGTFunctionWithCallbacks(canonicalName)
  ) {
    // Track as an overriding variable
    for (const identifier of identifiers) {
      trackOverridingVariable(identifier, state.scopeTracker);
    }
    return;
  }

  // There can only be one callback defined for const gt = useGT()
  if (identifiers.length !== 1) {
    throw new Error(
      `[GT_PLUGIN] Multiple identifiers found for GT function with callbacks: ${canonicalName}` +
        createErrorLocation(varDeclarator.id)
    );
  }
  const identifier = identifiers[0];

  // Inject the parameters into the call expression
  const expression = getFunctionInvocation(varDeclarator);
  if (expression.arguments.length > 0) {
    // Found existing arguments, skip injection
    return;
  }

  // Look up identifier
  const id = state.scopeTracker.getVariable(identifier)?.identifier;
  if (!id) {
    throw new Error(
      `[GT_PLUGIN] No translation callback variable found for ${identifier}` +
        createErrorLocation(varDeclarator.id)
    );
  }
  // Inject into the callees
  switch (canonicalName) {
    case GT_FUNCTIONS_WITH_CALLBACKS.useGT:
    case GT_FUNCTIONS_WITH_CALLBACKS.getGT:
      injectUseGTParameters(expression, state, id);
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
  id: number
) {
  // Get the corresponding callback injection data
  const translationContent = state.stringCollector.getTranslationContent(id);
  if (!translationContent) {
    return;
  }

  // Inject the parameters into the call expression
  expression.arguments = [
    t.arrayExpression(
      translationContent.map((content) =>
        t.objectExpression([
          t.objectProperty(t.identifier('hash'), t.stringLiteral(content.hash)),
          t.objectProperty(
            t.identifier('message'),
            t.stringLiteral(content.message)
          ),
          ...(content.id
            ? [
                t.objectProperty(
                  t.identifier('id'),
                  t.stringLiteral(content.id)
                ),
              ]
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
      )
    ),
  ];
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
