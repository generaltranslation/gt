import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { getTrackedVariable } from '../getTrackedVariable';
import { getCalleeNameFromExpressionWrapper } from '../../utils/parsing/getCalleeNameFromExpressionWrapper';
import { isGTFunctionWithCallbacks } from '../../utils/constants/gt/helpers';
import { GT_FUNCTIONS_WITH_CALLBACKS } from '../../utils/constants/gt/constants';
import { extractIdentifiersFromLVal } from '../../utils/parsing/extractIdentifiersFromLVal';
import { trackOverridingVariable } from '../tracking/trackOverridingVariable';
import { createErrorLocation } from '../../utils/errors';
import type { TranslationContent } from '../../state/StringCollector';

/**
 * inject parameters into invocation of translation function
 * - useGT(messages=[{hash, message, id, context, maxChars}])
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
    state.logger.logError(
      `Multiple identifiers found for GT function with callbacks: ${canonicalName}. Parameter injection failed.` +
        createErrorLocation(varDeclarator.id)
    );
    return;
  }
  const identifier = identifiers[0];

  // Inject the parameters into the call expression
  const expression = getFunctionInvocation(varDeclarator);
  if (!expression) {
    state.logger.logError(
      `No valid function invocation found for ${functionName}. Parameter injection failed.` +
        createErrorLocation(varDeclarator.id)
    );
    return;
  }
  if (expression.arguments.length > 0) {
    // Found existing arguments, skip injection
    return;
  }

  // Look up identifier
  const id = state.scopeTracker.getVariable(identifier)?.identifier;
  if (!id) {
    state.logger.logError(
      `No translation callback variable found for ${identifier}. Parameter injection failed.` +
        createErrorLocation(varDeclarator.id)
    );
    return;
  }
  // Inject into the callees
  switch (canonicalName) {
    case GT_FUNCTIONS_WITH_CALLBACKS.useGT:
    case GT_FUNCTIONS_WITH_CALLBACKS.getGT:
      injectUseGTParameters(expression, state, id);
      break;
    case GT_FUNCTIONS_WITH_CALLBACKS.useMessages:
    case GT_FUNCTIONS_WITH_CALLBACKS.getMessages:
      injectUseMessagesParameters(expression, state);
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
  expression.arguments = [buildMessagesArrayExpression(translationContent)];
}

/**
 * Inject the registered msg() calls into useMessages/getMessages so server
 * async boundaries can preload translations before m() renders them.
 */
function injectUseMessagesParameters(
  expression: t.CallExpression,
  state: TransformState
) {
  const translationContent = state.stringCollector.getRuntimeOnlyContent('msg');
  if (!translationContent.length) {
    return;
  }

  expression.arguments = [buildMessagesArrayExpression(translationContent)];
}

function buildMessagesArrayExpression(content: TranslationContent[]) {
  return t.arrayExpression(
    content.map((entry) =>
      t.objectExpression([
        t.objectProperty(
          t.identifier('message'),
          t.stringLiteral(entry.message)
        ),
        t.objectProperty(t.identifier('$_hash'), t.stringLiteral(entry.hash)),
        ...(entry.id
          ? [t.objectProperty(t.identifier('$id'), t.stringLiteral(entry.id))]
          : []),
        ...(entry.context
          ? [
              t.objectProperty(
                t.identifier('$context'),
                t.stringLiteral(entry.context)
              ),
            ]
          : []),
        ...(entry.maxChars != null
          ? [
              t.objectProperty(
                t.identifier('$maxChars'),
                t.numericLiteral(entry.maxChars)
              ),
            ]
          : []),
      ])
    )
  );
}

/**
 * Get the function invocation from the variable declarator
 * @param varDeclarator - The variable declarator
 */
function getFunctionInvocation(
  varDeclarator: t.VariableDeclarator
): t.CallExpression | undefined {
  const expression = varDeclarator.init;
  if (!expression) {
    // failed
    return;
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
}
