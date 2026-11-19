import * as t from '@babel/types';
import {
  getObjectPropertyFromObjectExpression,
  objectPropertyMatchesName,
} from '../../utils/parsing/getObjectPropertyFromObjectExpression';
import { TransformState } from '../../state/types';
import { createErrorLocation } from '../../utils/errors';
import {
  keepUnsplit,
  recordChunkHash,
} from '../chunk-translations/chunkTranslationsModule';

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

  if (state.settings.chunkTranslations) {
    recordTHash(callExpr.arguments[1], translationJsx.hash, state);
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
 * Records the hash the runtime looks a <T> up by ($_hash, then _hash, then
 * the computed hash) for a build with chunk translations. A spread or computed
 * key could carry another, so then the translation stays unsplit.
 */
function recordTHash(
  props: t.ObjectExpression,
  computedHash: string,
  state: TransformState
): void {
  if (getObjectPropertyFromObjectExpression(props, '$_hash')) return;
  if (
    props.properties.some(
      (prop) =>
        t.isSpreadElement(prop) ||
        (prop.computed && !t.isStringLiteral(prop.key))
    )
  ) {
    keepUnsplit(computedHash, state);
    return;
  }
  const hashProps = props.properties.filter((prop) =>
    objectPropertyMatchesName(prop, '_hash')
  );
  if (hashProps.length === 0) {
    recordChunkHash(computedHash, state);
    return;
  }
  const [hashProp] = hashProps;
  if (
    hashProps.length === 1 &&
    t.isObjectProperty(hashProp) &&
    t.isStringLiteral(hashProp.value)
  ) {
    recordChunkHash(hashProp.value.value, state);
  }
}
