import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  getObjectPropertyFromObjectExpression,
  objectPropertyMatchesName,
} from '../../utils/parsing/getObjectPropertyFromObjectExpression';
import { TransformState } from '../../state/types';
import { createErrorLocation } from '../../utils/errors';
import { injectInlineTranslationsProp } from './inline-translations/injectInlineTranslations';
import {
  type JsxReplacementTarget,
  replaceJsxSource,
} from './inline-translations/replaceJsxSource';
import { precomputeJsx } from './precompute-jsx/precomputeJsx';

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
  const props = callExpr.arguments[1];
  const { hash } = translationJsx;
  // On exit, once translation calls in the children have taken their hashes in source order
  const precomputeOnExit = () => {
    if (!state.settings.precomputeJsx || !runtimeHash) return;
    state.precomputedJsxOnExit ??= new Map();
    state.precomputedJsxOnExit.set(callExpr, () =>
      precompute(callExprPath, translationJsx.children, runtimeHash, state)
    );
  };
  if (runtimeHash && !getObjectPropertyFromObjectExpression(props, 'inline')) {
    const target = getReplacementTarget(callExpr, runtimeHash, state);
    if (target !== undefined) {
      // On exit, once translation calls in the children have taken their hashes in source order
      state.sourceReplacementsOnExit ??= new Map();
      state.sourceReplacementsOnExit.set(callExpr, () => {
        if (
          replaceSource(
            callExprPath,
            translationJsx.children,
            runtimeHash,
            target,
            state
          )
        ) {
          return;
        }
        injectInlineTranslationsProp(props, runtimeHash, state);
        injectHash(props, hash);
        precomputeOnExit();
      });
      return;
    }
    injectInlineTranslationsProp(props, runtimeHash, state);
  }
  injectHash(props, hash);
  precomputeOnExit();
}

function injectHash(props: t.ObjectExpression, hash: string): void {
  // If already has hash set then skip
  if (getObjectPropertyFromObjectExpression(props, '_hash')) {
    return;
  }

  // Inject the parameters into the call expression
  props.properties.push(
    t.objectProperty(t.identifier('_hash'), t.stringLiteral(hash))
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

/** What a per-locale build replaces a <T> with, if it replaces <T>. */
function getReplacementTarget(
  callExpr: t.CallExpression,
  hash: string,
  state: TransformState
): JsxReplacementTarget | undefined {
  const { sourceReplacement, inlineTranslationsTable } = state.settings;
  if (!sourceReplacement?.jsx) return undefined;
  // An enclosing <T> renders this one as part of its own content
  if (
    [...(state.openTranslationCalls ?? [])].some((open) => open !== callExpr)
  ) {
    return undefined;
  }
  if (sourceReplacement.locale === undefined) return 'source';
  const translation =
    inlineTranslationsTable?.[sourceReplacement.locale]?.[hash];
  return translation === undefined ? undefined : { translation };
}

/**
 * Swaps the <T> call for the JSX it renders in the build's locale. Returns
 * whether it did.
 */
function replaceSource(
  callExprPath: NodePath<t.CallExpression>,
  sourceChildren: unknown,
  hash: string,
  target: JsxReplacementTarget,
  state: TransformState
): boolean {
  const reason = replaceJsxSource(callExprPath, sourceChildren, target, state);
  if (reason === undefined) {
    state.statistics.sourceReplacementsCount += 1;
    return true;
  }
  state.statistics.sourceReplacementFallbacksCount += 1;
  state.logger.logDebug(
    (target === 'source'
      ? `Kept <T> ${hash} as a component: ${reason}`
      : `Kept the source of <T> ${hash}, with its embedded translation: ${reason}`) +
      createErrorLocation(callExprPath.node).replace(
        '{filename}',
        state.settings.filename ?? ''
      )
  );
  return false;
}

/** Turns the <T> call into a precomputed component, where its children allow it. */
function precompute(
  callExprPath: NodePath<t.CallExpression>,
  sourceChildren: unknown,
  hash: string,
  state: TransformState
): void {
  const reason = precomputeJsx(callExprPath, sourceChildren, hash, state);
  if (reason === undefined) return;
  state.logger.logDebug(
    `Left <T> ${hash} as a component: ${reason}` +
      createErrorLocation(callExprPath.node).replace(
        '{filename}',
        state.settings.filename ?? ''
      )
  );
}
