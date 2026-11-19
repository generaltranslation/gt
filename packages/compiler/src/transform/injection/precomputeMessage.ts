import * as t from '@babel/types';
import type { MessageTree } from '@generaltranslation/icu';
import type { MessageTreeHashMetadata } from 'generaltranslation/id';
import { TRANSLATION_OPTION_KEYS } from '../../utils/constants/gt/constants';

// Keys the runtime reads a precomputed message by
// (packages/i18n/src/translation-functions/renderMessage.ts, PrecomputedMessage).
const TREE_KEY = '$_tree';
const FORMATS_KEY = '$_formats';

/** A value a template binds at runtime: one variable of its tree. */
export type Binding = {
  /** Set once the tree is built, for a value the builder numbers `_gt_N`. */
  name?: string;
  value: t.Expression;
  /** Formatting context of number(), date() and time(): not part of the tree. */
  context?: { key: string; value: t.Expression }[];
};

/**
 * The call that renders a static template from its precomputed message:
 * t`Hello, ${{ name }}!` becomes
 * `t({ $_hash, $_tree: ['Hello, ', ['name'], '!'] }, { name })`, so the call
 * site builds no tree and hashes nothing. The message is written at the call
 * and nothing of it is declared at module scope: that costs the fewest bytes,
 * and a call can run before its module's body has, as through an import
 * cycle. Undefined when the call could evaluate the template's values
 * differently than the template does (see evaluatesLikeTemplate).
 */
export function buildPrecomputedCall({
  callee,
  hash,
  metadata,
  tree,
  bindings,
}: {
  callee: t.Identifier;
  hash: string;
  metadata: MessageTreeHashMetadata;
  tree: MessageTree;
  bindings: Binding[];
}): t.CallExpression | undefined {
  const variables = toVariables(bindings);
  if (!variables) return undefined;
  const contexts = variables.filter(({ context }) => context?.length);
  const isStaticContext = contexts.every(({ context }) =>
    context!.every(({ value }) => isStaticValue(value))
  );
  // Sorted like the runtime's, so both share Intl formatters.
  const sorted = contexts.map(({ name, context }) => ({
    name,
    context: [...context!].sort((a, b) =>
      a.key < b.key ? -1 : a.key > b.key ? 1 : 0
    ),
  }));
  if (
    !evaluatesLikeTemplate(
      bindings,
      [
        // A repeat that is dropped counts where its first value is
        ...variables.flatMap(({ value, repeats }) => [value, ...repeats]),
        ...sorted.flatMap(({ context }) => context.map(({ value }) => value)),
      ],
      new Set(variables.flatMap(({ repeats }) => repeats))
    )
  ) {
    return undefined;
  }
  const formats = sorted.length
    ? t.objectExpression(
        sorted.map(({ name, context }) =>
          t.objectProperty(
            toKey(name),
            t.objectExpression(
              context.map(({ key, value }) => toProperty(key, value))
            )
          )
        )
      )
    : undefined;

  const message = t.objectExpression([
    t.objectProperty(
      t.identifier(TRANSLATION_OPTION_KEYS.$_hash),
      t.stringLiteral(hash)
    ),
    t.objectProperty(t.identifier(TREE_KEY), t.valueToNode(tree)),
    ...Object.entries(metadata)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) =>
        t.objectProperty(t.identifier(key), t.valueToNode(value))
      ),
  ]);
  if (formats && isStaticContext) {
    message.properties.push(
      t.objectProperty(t.identifier(FORMATS_KEY), formats)
    );
  }

  const args: t.Expression[] = [message];
  if (variables.length) {
    args.push(
      t.objectExpression(
        variables.map(({ name, value }) => toProperty(name, value))
      )
    );
    if (formats && !isStaticContext) args.push(formats);
  }
  return t.callExpression(callee, args);
}

type Variable = Binding & {
  name: string;
  /** The later values of the same name, which the call does not evaluate. */
  repeats: t.Expression[];
};

/**
 * One binding per variable, in evaluation order. The runtime rejects a name
 * bound to two values, so a repeated name is kept once only when each of its
 * values is the same expression and has no formatting context; any other
 * repeat is left to the runtime.
 */
function toVariables(bindings: Binding[]): Variable[] | undefined {
  const variables = new Map<string, Variable>();
  for (const binding of bindings) {
    const { name } = binding;
    if (name === undefined) return undefined;
    const first = variables.get(name);
    if (!first) {
      variables.set(name, { ...binding, name, repeats: [] });
      continue;
    }
    if (
      first.context ||
      binding.context ||
      !t.isNodesEquivalent(first.value, binding.value)
    ) {
      return undefined;
    }
    first.repeats.push(binding.value);
  }
  return [...variables.values()];
}

/**
 * Whether evaluating `emitted` in order cannot be told from the template,
 * which evaluates each value and then its formatting context, hole by hole.
 * The call evaluates the values first and the context after them, and a
 * repeated value once. An expression that changes place relative to another,
 * or is dropped, must then be one that runs no code and writes nothing: a
 * property read can run a getter, and an operator a conversion.
 */
function evaluatesLikeTemplate(
  bindings: Binding[],
  emitted: t.Expression[],
  dropped: ReadonlySet<t.Expression>
): boolean {
  const order = new Map<t.Expression, number>();
  for (const { value, context = [] } of bindings) {
    for (const expression of [value, ...context.map((entry) => entry.value)]) {
      order.set(expression, order.size);
    }
  }
  // A literal is the same wherever it is written
  const evaluated = emitted.filter((expression) => !isLiteral(expression));
  const places = evaluated.map((expression) => order.get(expression)!);
  return evaluated.every((expression, index) => {
    const place = places[index];
    const moved =
      places.slice(0, index).some((earlier) => earlier > place) ||
      places.slice(index + 1).some((later) => later < place);
    return (!moved && !dropped.has(expression)) || isInert(expression);
  });
}

/** A literal or the read of a variable, which runs no code. */
function isInert(node: t.Expression): boolean {
  while (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isParenthesizedExpression(node)
  ) {
    node = node.expression;
  }
  return t.isIdentifier(node) || isLiteral(node);
}

function isLiteral(node: t.Expression): boolean {
  return isStaticValue(node) || t.isNullLiteral(node);
}

function isStaticValue(node: t.Expression): boolean {
  return (
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isBooleanLiteral(node) ||
    (t.isUnaryExpression(node, { operator: '-' }) &&
      t.isNumericLiteral(node.argument))
  );
}

function toProperty(name: string, value: t.Expression): t.ObjectProperty {
  return t.objectProperty(
    toKey(name),
    value,
    false,
    t.isIdentifier(value, { name }) && t.isValidIdentifier(name)
  );
}

function toKey(name: string): t.Identifier | t.StringLiteral {
  return t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name);
}
