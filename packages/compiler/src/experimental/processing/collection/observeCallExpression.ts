import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { Content } from '@generaltranslation/format/types';
import type { TransformState } from '../../../state/types';
import { getTrackedVariable } from '../../../transform/getTrackedVariable';
import { getCalleeNameFromJsxExpressionParam } from '../../../transform/jsx-children/utils/getCalleeNameFromJsxExpressionParam';
import {
  GT_CALLBACK_FUNCTIONS,
  GT_OTHER_FUNCTIONS,
} from '../../../utils/constants/gt/constants';
import { isTranslationComponent } from '../../../utils/constants/gt/helpers';
import { isReactFunction } from '../../../utils/constants/react/helpers';
import { getCalleeNameFromExpression } from '../../../utils/parsing/getCalleeNameFromExpression';
import { createErrorLocation } from '../../../utils/errors';
import { validateChildrenPropertyFromObjectExpression } from '../../../utils/validation/validateChildrenFromObjectExpression';
import type { LocaleTwinCollector } from '../../state/LocaleTwinCollector';
import { findTextSites } from '../../transform/findTextSites';

/** What the regular collection had recorded before it visited a node. */
export type CollectionSnapshot = {
  counter: number;
  runtimeOnly: number;
  errors: number;
};

export function takeCollectionSnapshot(
  state: TransformState
): CollectionSnapshot {
  return {
    counter: state.stringCollector.getCounter(),
    runtimeOnly: state.stringCollector.getRuntimeOnlyContent().length,
    errors: state.errorTracker.getErrors().length,
  };
}

/**
 * Records the entry of a call expression the regular collection pass just
 * visited, from what it registered: `<T>` (`jsx(T, props)`), `gt()` from
 * useGT/getGT, `t()` and `msg()`. Follows the dispatch of the regular
 * `processing/collection/processCallExpression.ts` (keep in sync):
 * - a registration with a hash is an attributed entry (with its text sites
 *   for `<T>`), unless the call spreads its arguments;
 * - a call it reserved no hash for (derive content or `$context`) is hashed
 *   at runtime;
 * - a call it rejected with errors records nothing.
 */
export function observeCallExpression(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState,
  collector: LocaleTwinCollector,
  before: CollectionSnapshot
): void {
  const callExpr = callExprPath.node;
  const { namespaceName, functionName } = getCalleeNameFromExpression(callExpr);
  if (!functionName) return;
  const { canonicalName, identifier, type } = getTrackedVariable(
    state.scopeTracker,
    namespaceName,
    functionName
  );
  if (!canonicalName) return;

  const collected = state.stringCollector;
  const counter = collected.getCounter();
  if (
    type === 'generaltranslation' &&
    (canonicalName === GT_CALLBACK_FUNCTIONS.useGT_callback ||
      canonicalName === GT_CALLBACK_FUNCTIONS.getGT_callback)
  ) {
    // A gt() call takes a counter slot, with a hash unless it is derived
    if (counter === before.counter) return;
    if (hasSpreadArgument(callExpr)) {
      collector.addUnattributed({
        api: 'gt',
        reason: 'spread',
        node: callExpr,
      });
      return;
    }
    const hash = collected.getTranslationHash(counter)?.hash;
    if (!hash) {
      collector.addRuntimeHashed({
        api: 'gt',
        reason: 'derive',
        node: callExpr,
      });
      return;
    }
    const content = collected
      .getTranslationContent(identifier!)
      ?.filter((item) => item.hash === hash)
      .pop();
    if (content) {
      collector.add({
        api: 'gt',
        hash,
        source: content.message,
        node: callExpr,
      });
    }
  } else if (type === 'react' && isReactFunction(canonicalName)) {
    // A <T> takes a counter slot, with an empty hash when derived
    if (
      counter === before.counter ||
      !isTranslationComponentCall(callExpr, state)
    ) {
      return;
    }
    const jsx = collected.getTranslationJsx(counter);
    if (!jsx) return;
    if (!jsx.hash) {
      collector.addRuntimeHashed({
        api: 'T',
        reason: 'derive',
        node: callExpr,
      });
      return;
    }
    if (jsx.children === undefined) return;
    const childrenPath = getChildrenPath(callExprPath);
    collector.add({
      api: 'T',
      hash: jsx.hash,
      source: jsx.children as Content,
      node: callExpr,
      textSites: childrenPath ? findTextSites(childrenPath, state) : [],
    });
  } else if (
    type === 'generaltranslation' &&
    (canonicalName === GT_OTHER_FUNCTIONS.msg ||
      canonicalName === GT_OTHER_FUNCTIONS.t)
  ) {
    const api = canonicalName === GT_OTHER_FUNCTIONS.t ? 't' : 'msg';
    const runtimeOnly = collected.getRuntimeOnlyContent();
    if (
      runtimeOnly.length > before.runtimeOnly &&
      hasSpreadArgument(callExpr)
    ) {
      collector.addUnattributed({ api, reason: 'spread', node: callExpr });
    } else if (runtimeOnly.length > before.runtimeOnly) {
      const { hash, message } = runtimeOnly[runtimeOnly.length - 1];
      collector.add({ api, hash, source: message, node: callExpr });
    } else if (state.errorTracker.getErrors().length === before.errors) {
      // Registered nothing without an error: derive content or $context
      collector.addRuntimeHashed({ api, reason: 'derive', node: callExpr });
    }
  }
}

/**
 * Whether a string call spreads its arguments (`msg('Hi', ...options)`): the
 * compiler cannot inject `$_hash` into them, so stripping its message would
 * leave the runtime nothing to look up.
 */
function hasSpreadArgument(callExpr: t.CallExpression): boolean {
  return callExpr.arguments.some((arg) => t.isSpreadElement(arg));
}

/** Whether a `jsx(Component, props)` call renders a GT translation component. */
function isTranslationComponentCall(
  callExpr: t.CallExpression,
  state: TransformState
): boolean {
  const firstArg = callExpr.arguments[0];
  if (!t.isExpression(firstArg)) return false;
  const { namespaceName, functionName } =
    getCalleeNameFromJsxExpressionParam(firstArg);
  if (!functionName) return false;
  const { canonicalName, type } = getTrackedVariable(
    state.scopeTracker,
    namespaceName,
    functionName
  );
  return (
    !!canonicalName &&
    type === 'generaltranslation' &&
    isTranslationComponent(canonicalName)
  );
}

/**
 * Rejects a unary child of a `<T>` other than `-` or `+` on a number, which
 * the regular compiler records as the number although it renders something
 * else (`{void 0}` renders nothing, `{!0}` true): the locale twins render the
 * recorded children, so the twin would show text the source never showed.
 * Runs before the regular collection visits the call, with its error format.
 */
export function checkUnaryChildren(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
): void {
  const callExpr = callExprPath.node;
  const { namespaceName, functionName } = getCalleeNameFromExpression(callExpr);
  if (!functionName) return;
  const { canonicalName, type } = getTrackedVariable(
    state.scopeTracker,
    namespaceName,
    functionName
  );
  if (
    !canonicalName ||
    type !== 'react' ||
    !isReactFunction(canonicalName) ||
    !isTranslationComponentCall(callExpr, state)
  ) {
    return;
  }
  const childrenPath = getChildrenPath(callExprPath);
  if (!childrenPath) return;
  for (const { container, key } of findTextSites(childrenPath, state)) {
    const node = (container as Record<string | number, t.Node>)[key];
    if (
      t.isUnaryExpression(node) &&
      node.operator !== '-' &&
      node.operator !== '+'
    ) {
      state.errorTracker.addError(
        `Failed to construct JsxChild! Unary expression operator must be - or +` +
          createErrorLocation(node)
      );
    }
  }
}

/** The `children` of a `jsx(T, props)` call. */
function getChildrenPath(
  callExprPath: NodePath<t.CallExpression>
): NodePath<t.Expression> | undefined {
  const argsPath = callExprPath.get('arguments')[1];
  return argsPath?.isObjectExpression()
    ? validateChildrenPropertyFromObjectExpression(argsPath).value
    : undefined;
}
