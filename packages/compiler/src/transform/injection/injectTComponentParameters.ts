import * as t from '@babel/types';
import { getObjectPropertyFromObjectExpression } from '../../utils/parsing/getObjectPropertyFromObjectExpression';
import { TransformState } from '../../state/types';
import { createErrorLocation } from '../../utils/errors';
import { injectInlineTranslationsProp } from './inline-translations/injectInlineTranslations';

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

  // Skip when collection produced no hash (derive context or <Derive>
  // children) — the runtime computes the hash per resolved variant, and an
  // injected empty hash would break the lookup
  if (!translationJsx.hash) {
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

  // Embed translations for the configured locales
  const runtimeHash = getRuntimeHash(
    callExpr.arguments[1],
    translationJsx.hash
  );
  if (
    runtimeHash &&
    !getObjectPropertyFromObjectExpression(callExpr.arguments[1], 'inline')
  ) {
    injectInlineTranslationsProp(callExpr.arguments[1], runtimeHash, state);
  }

  // If already has hash set then skip
  if (getObjectPropertyFromObjectExpression(callExpr.arguments[1], '_hash')) {
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

/**
 * The hash the runtime looks up ($_hash, then _hash, then the computed hash),
 * or undefined when it can't be known at build time.
 */
function getRuntimeHash(
  props: t.ObjectExpression,
  computedHash: string
): string | undefined {
  if (getObjectPropertyFromObjectExpression(props, '$_hash')) return undefined;
  const hashProp = getObjectPropertyFromObjectExpression(props, '_hash');
  if (!hashProp) return computedHash;
  return t.isObjectProperty(hashProp) && t.isStringLiteral(hashProp.value)
    ? hashProp.value.value
    : undefined;
}
