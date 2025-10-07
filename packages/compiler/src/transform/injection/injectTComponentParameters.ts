import * as t from '@babel/types';
import { getObjectPropertyFromObjectExpression } from '../../utils/parsing/getObjectPropertyFromObjectExpression';
import { TransformState } from '../../state/types';

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
  console.log(`[GT_PLUGIN] inject <T> hash`, identifier);

  // Get second arg
  if (callExpr.arguments.length < 2 || !callExpr.arguments[1]) {
    throw new Error(
      `[GT_PLUGIN] T component jsx invocation is missing its second argument`
    );
  }
  if (!t.isObjectExpression(callExpr.arguments[1])) {
    throw new Error(
      `[GT_PLUGIN] T component jsx invocation's second argument is not an object expression`
    );
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
