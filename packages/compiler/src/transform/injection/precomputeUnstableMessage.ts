import * as t from '@babel/types';
import type { MessageTree } from '@generaltranslation/icu';
import type { MessageTreeHashMetadata } from 'generaltranslation/id';
import { USEGT_CALLBACK_OPTIONS } from '../../utils/constants/gt/constants';
import { isSideEffectFree } from './inline-translations/isSideEffectFree';

// Keys the runtime reads a precomputed message by
// (packages/i18n/src/unstable/renderMessage.ts, PrecomputedMessage).
const TREE_KEY = '$_tree';
const FORMATS_KEY = '$_formats';
const LOCALE_KEY = '$_locale';
const INLINE_KEY = 'inline';

/** A value a template binds at runtime: one variable of its tree. */
export type Binding = {
  /** Set once the tree is built, for a value the builder numbers `_gt_N`. */
  name?: string;
  value: t.Expression;
  /** Formatting context of number(), date() and time(): not part of the tree. */
  context?: { key: string; value: t.Expression }[];
};

/** Declares a message at module scope and returns the identifier that reads it. */
export type HoistMessage = (message: t.ObjectExpression) => t.Identifier;

/**
 * The call that renders a static template from its precomputed message:
 * t`Hello, ${{ name }}!` becomes `t(_gt, { name })`, where `_gt` is the
 * hoisted `{ $_hash, $_tree, ...options }`, so the call site builds no tree
 * and hashes nothing. A message that is text keeps nothing between renders,
 * so it is written at its call, t({ $_hash, $_tree: 'Save' }), which costs
 * fewer bytes than a declaration. Undefined when the call could evaluate the
 * template's values differently than the template does.
 */
export function buildPrecomputedCall({
  callee,
  hash,
  metadata,
  tree,
  bindings,
  inline,
  locale,
  hoist,
}: {
  callee: t.Identifier;
  hash: string;
  metadata: MessageTreeHashMetadata;
  tree: MessageTree;
  bindings: Binding[];
  /** Translations embedded for the call site. */
  inline?: t.Expression;
  /** The locale of a tree that source replacement wrote. */
  locale?: string;
  hoist: HoistMessage;
}): t.CallExpression | undefined {
  const variables = toVariables(bindings);
  if (!variables) return undefined;
  const contexts = variables.filter(({ context }) => context?.length);
  const isStaticContext = contexts.every(({ context }) =>
    context!.every(({ value }) => isStaticValue(value))
  );
  // A context that is read at runtime moves behind every value, so neither
  // may have a side effect the other could see.
  if (
    !isStaticContext &&
    ![
      ...variables.map(({ value }) => value),
      ...contexts.flatMap(({ context }) => context!.map(({ value }) => value)),
    ].every(isFree)
  ) {
    return undefined;
  }
  const formats = contexts.length
    ? t.objectExpression(
        contexts.map(({ name, context }) =>
          t.objectProperty(
            toKey(name),
            t.objectExpression(
              // Sorted like the runtime's, so both share Intl formatters.
              [...context!]
                .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
                .map(({ key, value }) => toProperty(key, value))
            )
          )
        )
      )
    : undefined;

  const message = t.objectExpression([
    t.objectProperty(
      t.identifier(USEGT_CALLBACK_OPTIONS.$_hash),
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
  if (inline) {
    message.properties.push(t.objectProperty(t.identifier(INLINE_KEY), inline));
  }
  if (locale !== undefined) {
    message.properties.push(
      t.objectProperty(t.identifier(LOCALE_KEY), t.stringLiteral(locale))
    );
  }

  const args: t.Expression[] = [
    typeof tree === 'string' ? message : hoist(message),
  ];
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

type Variable = Binding & { name: string };

/**
 * One binding per variable, in evaluation order. The runtime rejects a name
 * bound to two values, so a repeated name is kept once only when each of its
 * values is the same expression, has no side effect and no formatting
 * context; any other repeat is left to the runtime.
 */
function toVariables(bindings: Binding[]): Variable[] | undefined {
  const variables = new Map<string, Variable>();
  for (const binding of bindings) {
    const { name } = binding;
    if (name === undefined) return undefined;
    const first = variables.get(name);
    if (!first) {
      variables.set(name, { ...binding, name });
      continue;
    }
    if (
      first.context ||
      binding.context ||
      !t.isNodesEquivalent(first.value, binding.value) ||
      !isSideEffectFree(first.value, {
        isPureCall: () => false,
        sameIdentity: true,
      })
    ) {
      return undefined;
    }
  }
  return [...variables.values()];
}

const isFree = (node: t.Expression) =>
  isSideEffectFree(node, { isPureCall: () => false });

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
