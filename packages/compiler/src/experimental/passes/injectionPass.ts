import type {
  NodePath,
  TraverseOptions,
  VisitNodeFunction,
} from '@babel/traverse';
import * as t from '@babel/types';
import { injectionPass as regularInjectionPass } from '../../passes/injectionPass';
import type { TransformState } from '../../state/types';
import type { LocaleTwinCollector } from '../state/LocaleTwinCollector';

/**
 * Injection pass with locale twins: the regular injection pass, and the
 * `message` of every prefetch item it injects into a `useGT()` / `getGT()`
 * call goes to the module's {@link LocaleTwinCollector}, so stripping can
 * blank it with the `gt()` text.
 */
export function injectionPass(
  state: TransformState,
  collector: LocaleTwinCollector
): TraverseOptions {
  const regular = regularInjectionPass(state);
  const processVariableDeclarator =
    regular.VariableDeclarator as VisitNodeFunction<
      t.Node,
      t.VariableDeclarator
    >;
  return {
    ...regular,
    VariableDeclarator(path: NodePath<t.VariableDeclarator>, pluginState) {
      const invocation = getFunctionInvocation(path.node);
      const injectable = invocation?.arguments.length === 0;
      processVariableDeclarator.call(this, path, pluginState);
      if (injectable && invocation) {
        recordPrefetchMessages(invocation, collector);
      }
    },
  };
}

/**
 * The call the regular pass injects into: `useGT()` or `await getGT()`
 * (`transform/injection/injectCallbackDeclaratorFunctionParameters.ts`).
 */
function getFunctionInvocation(
  varDeclarator: t.VariableDeclarator
): t.CallExpression | undefined {
  const expression = varDeclarator.init;
  if (t.isCallExpression(expression)) return expression;
  if (
    t.isAwaitExpression(expression) &&
    t.isCallExpression(expression.argument)
  ) {
    return expression.argument;
  }
  return undefined;
}

/** Records the `message` of each injected `{ $_hash, message, ... }` item. */
function recordPrefetchMessages(
  invocation: t.CallExpression,
  collector: LocaleTwinCollector
): void {
  const [items] = invocation.arguments;
  if (!t.isArrayExpression(items)) return;
  for (const item of items.elements) {
    if (!t.isObjectExpression(item)) continue;
    const hash = getProperty(item, '$_hash');
    const message = getProperty(item, 'message');
    if (hash && t.isStringLiteral(hash.value) && message) {
      collector.recordPrefetchMessage(hash.value.value, message);
    }
  }
}

function getProperty(
  object: t.ObjectExpression,
  name: string
): t.ObjectProperty | undefined {
  return object.properties.find(
    (property): property is t.ObjectProperty =>
      t.isObjectProperty(property) && t.isIdentifier(property.key, { name })
  );
}
