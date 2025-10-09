import * as t from '@babel/types';
import { getObjectPropertyFromObjectExpression } from '../../utils/parsing/getObjectPropertyFromObjectExpression';
import { TransformState } from '../../state/types';
import { createErrorLocation } from '../../utils/errors';

/**
 * Inject parameters into a T component
 */
export function injectTComponentParameters(
  callExpr: t.CallExpression,
  state: TransformState
) {
  // Increment counter (in place of registering the component)
  const identifier = state.stringCollector.incrementCounter();

  // Look up translationJsx
  const translationJsx = state.stringCollector.getTranslationJsx(identifier);
  if (!translationJsx) {
    return;
  }

  // Get second arg
  if (callExpr.arguments.length < 2 || !callExpr.arguments[1]) {
    state.logger.logError(
      'T component jsx invocation is missing its second argument. Parameter injection failed.' +
        createErrorLocation(callExpr)
    );
    return;
  }
  if (!t.isObjectExpression(callExpr.arguments[1])) {
    state.logger.logError(
      "T component jsx invocation's second argument is not an object expression. Parameter injection failed." +
        createErrorLocation(callExpr)
    );
    return;
  }

  // If already has hash set then skip
  if (getObjectPropertyFromObjectExpression(callExpr.arguments[1], 'hash')) {
    return;
  }

  // Inject the parameters into the call expression
  callExpr.arguments[1].properties.push(
    t.objectProperty(
      t.identifier('_hash'),
      t.stringLiteral(translationJsx.hash)
    )
  );
}
