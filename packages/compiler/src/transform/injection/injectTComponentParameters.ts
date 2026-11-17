import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  getObjectPropertyFromObjectExpression,
  objectPropertyMatchesName,
} from '../../utils/parsing/getObjectPropertyFromObjectExpression';
import { TransformState } from '../../state/types';
import { createErrorLocation } from '../../utils/errors';
import { injectInlineTranslationsProp } from './inline-translations/injectInlineTranslations';
import { replaceJsxSource } from './inline-translations/replaceJsxSource';

/**
 * Inject parameters into a T component
 */
export function injectTComponentParameters(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
) {
  const callExpr = callExprPath.node;
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
    if (
      replaceSource(callExprPath, translationJsx.children, runtimeHash, state)
    ) {
      return;
    }
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
  const hashProps = props.properties.filter((prop) =>
    objectPropertyMatchesName(prop, '_hash')
  );
  if (hashProps.length === 0) return computedHash;
  const [hashProp] = hashProps;
  return hashProps.length === 1 &&
    t.isObjectProperty(hashProp) &&
    t.isStringLiteral(hashProp.value)
    ? hashProp.value.value
    : undefined;
}

/**
 * In a per-locale build that replaces source content, swaps the <T> call for
 * the JSX its translation renders. Returns whether it did.
 */
function replaceSource(
  callExprPath: NodePath<t.CallExpression>,
  sourceChildren: unknown,
  hash: string,
  state: TransformState
): boolean {
  const { sourceReplacement, inlineTranslationsTable } = state.settings;
  if (!sourceReplacement?.jsx) return false;
  const translation =
    inlineTranslationsTable?.[sourceReplacement.locale]?.[hash];
  if (translation === undefined) return false;
  const reason = replaceJsxSource(
    callExprPath,
    sourceChildren,
    translation,
    state
  );
  if (reason === undefined) {
    state.statistics.sourceReplacementsCount += 1;
    return true;
  }
  state.statistics.sourceReplacementFallbacksCount += 1;
  state.logger.logDebug(
    `Kept the source of <T> ${hash}, with its embedded translation: ${reason}` +
      createErrorLocation(callExprPath.node).replace(
        '{filename}',
        state.settings.filename ?? ''
      )
  );
  return false;
}
