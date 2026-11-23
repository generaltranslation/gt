import type { NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import type { MessageTree } from '@generaltranslation/icu';
import {
  templateToMessage,
  DATE_TIME_CONTEXT_OPTIONS,
  NUMBER_CONTEXT_OPTIONS,
  type TemplateBranch,
  type TemplateFragment,
  type TemplateHole,
} from '@generaltranslation/icu/internal';
import {
  hashSource,
  type MessageTreeHashMetadata,
} from 'generaltranslation/id';
import {
  isGTMessageHelperName,
  isGTMessageImportSource,
  type GTMessageHelperName,
} from 'generaltranslation/internal';
import { TRANSLATION_OPTION_KEYS } from '../../utils/constants/gt/constants';
import { buildPrecomputedCall, type Binding } from './precomputeMessage';

type OptionKey = keyof MessageTreeHashMetadata;

// Derive-free mirror of the CLI walker in
// packages/cli/src/react/jsx/utils/stringParsing/extractMessageTrees/templateVariants.ts;
// test-fixtures/message-tree-wire-format.json keeps both on the same hashes.

/** Thrown when a template is not plainly static; the runtime hashes it. */
function nonStatic(): never {
  throw new Error('Non-static tagged template');
}

/**
 * Rewrites a statically analyzable tagged template so the runtime
 * skips hashing: t`...` -> t({ $_hash })`...` and
 * t({ context })`...` -> t({ context, $_hash })`...`, for an imported `t`
 * or `msg` and for the result of `const t = useGT()` / `const t = await getGT()`.
 *
 * Where `precompute` returns true, a `t` template becomes a call that passes
 * its message, built here (see buildPrecomputedCall): t`Hello, ${{ name }}!` ->
 * t({ $_hash, $_tree }, { name }). `msg` templates, and templates whose
 * values the call could evaluate differently, keep the form above.
 * `precompute` is called only for a static `t` template.
 *
 * `onHash` is called with the hash and the tree of each rewritten template,
 * in either form, and whether it is a `msg`, which `m()` renders away from
 * its call site. It returns what the call site passes as its `$_hash`.
 *
 * `onRuntimeTree` is called for each template that is left to the runtime to
 * hash, with the tree it builds there when each value the compiler cannot be
 * sure of is a primitive, or with undefined when nothing says what it
 * builds, as with `derive()`.
 * Returns whether the template was rewritten.
 */
export function injectTaggedTemplateHash(
  path: NodePath<t.TaggedTemplateExpression>,
  onHash?: (hash: string, isMsg: boolean, tree: MessageTree) => string,
  precompute: () => boolean = () => false,
  onRuntimeTree?: (tree: MessageTree | undefined) => void
): boolean {
  const { tag, quasi } = path.node;
  const callee = t.isCallExpression(tag) ? tag.callee : tag;
  const kind = t.isIdentifier(callee)
    ? getMessageTagKind(callee.name, path.scope)
    : undefined;
  if (!kind) return false;
  let hash: string;
  let metadata: MessageTreeHashMetadata;
  let message: StaticMessage;
  try {
    metadata = t.isCallExpression(tag)
      ? parseMessageOptions(tag.arguments)
      : {};
    message = buildStaticMessage(quasi, path.scope);
    hash = hashSource({
      source: message.tree,
      dataFormat: 'MESSAGE_TREE',
      ...metadata,
    });
  } catch {
    // Non-static or invalid (e.g. a reserved `_gt_` name): skip only this
    // template; the runtime hashes it and reports any error.
    onRuntimeTree?.(getLikelyRuntimeTree(path));
    return false;
  }
  const passed = onHash?.(hash, kind === 'msg', message.tree) ?? hash;
  // msg templates are rendered by m() away from their call site.
  if (kind === 'gt' && precompute()) {
    const call = buildPrecomputedCall({
      callee: callee as t.Identifier,
      hash: passed,
      metadata,
      tree: message.tree,
      bindings: message.bindings,
    });
    if (call) {
      path.replaceWith(call);
      return true;
    }
  }
  const hashProperty = t.objectProperty(
    t.identifier(TRANSLATION_OPTION_KEYS.$_hash),
    t.stringLiteral(passed)
  );
  if (t.isCallExpression(tag)) {
    (tag.arguments[0] as t.ObjectExpression).properties.push(hashProperty);
  } else {
    path.node.tag = t.callExpression(tag, [t.objectExpression([hashProperty])]);
  }
  return true;
}

// Set while a template is read as the runtime most likely reads it.
let assumesPrimitives = false;

/**
 * The tree the runtime builds for a template the compiler does not hash,
 * when each value it cannot prove a primitive is one. Undefined when the
 * template has no such reading.
 */
function getLikelyRuntimeTree(
  path: NodePath<t.TaggedTemplateExpression>
): MessageTree | undefined {
  assumesPrimitives = true;
  try {
    return buildStaticMessage(path.node.quasi, path.scope).tree;
  } catch {
    return undefined;
  } finally {
    assumesPrimitives = false;
  }
}

/**
 * `gt` for `t` imported from a GT message source or
 * `const t = [await] useGT/getGT()`, and `msg` for an imported `msg`.
 */
function getMessageTagKind(
  name: string,
  scope: Scope
): 'gt' | 'msg' | undefined {
  const helper = getHelperName(name, scope);
  if (helper === 't') return 'gt';
  if (helper === 'msg') return 'msg';
  const binding = scope.getBinding(name);
  if (
    !binding?.constant ||
    !binding.path.isVariableDeclarator() ||
    !t.isIdentifier(binding.path.node.id)
  ) {
    return;
  }
  let init = binding.path.node.init;
  if (t.isAwaitExpression(init)) init = init.argument;
  if (!t.isCallExpression(init) || !t.isIdentifier(init.callee)) return;
  const hook = getHelperName(init.callee.name, binding.path.scope);
  return hook === 'useGT' || hook === 'getGT' ? 'gt' : undefined;
}

/** Original name of a helper imported from a GT message source. */
function getHelperName(
  name: string,
  scope: Scope
): GTMessageHelperName | undefined {
  const binding = scope.getBinding(name);
  if (
    !binding?.path.isImportSpecifier() ||
    !binding.path.parentPath.isImportDeclaration() ||
    !isGTMessageImportSource(binding.path.parentPath.node.source.value)
  ) {
    return;
  }
  const { imported } = binding.path.node;
  const importedName = t.isIdentifier(imported)
    ? imported.name
    : imported.value;
  return isGTMessageHelperName(importedName) ? importedName : undefined;
}

function parseMessageOptions(
  args: t.CallExpression['arguments']
): MessageTreeHashMetadata {
  const [options] = args;
  if (args.length !== 1 || !t.isObjectExpression(options)) nonStatic();
  const metadata: MessageTreeHashMetadata = {};
  for (const property of options.properties) {
    // Only plain identifier keys; anything else is left to the runtime.
    if (
      !t.isObjectProperty(property) ||
      property.computed ||
      !t.isIdentifier(property.key)
    ) {
      nonStatic();
    }
    const { value } = property;
    switch (property.key.name) {
      case 'context' satisfies OptionKey:
        metadata.context = getStaticText(value);
        break;
      case 'maxChars' satisfies OptionKey: {
        const maxChars = getNumber(value);
        if (maxChars == null || !Number.isInteger(maxChars)) nonStatic();
        metadata.maxChars = maxChars;
        break;
      }
      case 'requiresReview' satisfies OptionKey:
        if (!t.isBooleanLiteral(value)) nonStatic();
        metadata.requiresReview = value.value;
        break;
      default:
        nonStatic();
    }
  }
  return metadata;
}

type StaticMessage = TemplateFragment & {
  tree: MessageTree;
  /** The values the template binds, in the order it evaluates them. */
  bindings: Binding[];
};

/** A static template's tree, with the expression of each of its variables. */
function buildStaticMessage(
  quasi: t.TemplateLiteral,
  scope: Scope
): StaticMessage {
  const bindings: Binding[] = [];
  const fragment = templateFragment(quasi, scope, bindings);
  const built = templateToMessage(fragment.strings, fragment.holes);
  // The builder numbers each value without a name, in tree order.
  for (const [name, binding] of built.values) (binding as Binding).name = name;
  return { ...fragment, tree: built.tree, bindings };
}

function templateFragment(
  quasi: t.TemplateLiteral,
  scope: Scope,
  bindings: Binding[]
): TemplateFragment {
  return {
    strings: quasi.quasis.map(({ value }) => value.cooked ?? nonStatic()),
    holes: quasi.expressions.map((expression) =>
      getHole(expression, scope, bindings)
    ),
  };
}

function getHole(
  hole: t.Expression | t.TSType,
  scope: Scope,
  bindings: Binding[]
): TemplateHole {
  const expression = unwrapTypeScript(hole);
  if (t.isObjectExpression(expression)) {
    const name = getVariableName(expression);
    bindings.push({ name, value: getVariableValue(expression) });
    return { kind: 'argument', name };
  }
  if (
    t.isIdentifier(expression) &&
    getHelperName(expression.name, scope) === 'n'
  ) {
    return { kind: 'pound' };
  }
  const fragment = getFragment(expression, scope, bindings);
  if (fragment) return { kind: 'fragment', ...fragment };
  if (!t.isCallExpression(expression) || !t.isIdentifier(expression.callee)) {
    if (!assumesPrimitives && !isPrimitive(expression, scope, newWalk())) {
      nonStatic();
    }
    const binding: Binding = { value: hole as t.Expression };
    bindings.push(binding);
    return { kind: 'anonymous', value: binding };
  }
  const helper = getHelperName(expression.callee.name, scope);
  const args = expression.arguments;
  switch (helper) {
    case 'plural':
    case 'ordinal':
    case 'select': {
      const [variable, branchesArg] = args;
      if (args.length !== 2 || !t.isObjectExpression(branchesArg)) nonStatic();
      const binding = getHoleVariable(variable, scope, bindings);
      const branches: Record<string, TemplateBranch> = {};
      for (const property of branchesArg.properties) {
        branches[getPropertyKey(property)] = getBranch(
          (property as t.ObjectProperty).value,
          scope,
          bindings
        );
      }
      // ordinal() builds the tree node named after ICU's keyword.
      const kind = helper === 'ordinal' ? 'selectordinal' : helper;
      return { kind, name: binding.name, value: binding, branches };
    }
    case 'num':
    case 'date':
    case 'time': {
      if (args.length < 1 || args.length > 2) nonStatic();
      const binding = getHoleVariable(args[0], scope, bindings);
      // num() builds the tree node named after ICU's keyword.
      const kind = helper === 'num' ? 'number' : helper;
      const options = args[1] && getIntlOptions(args[1], kind, binding);
      return {
        kind,
        name: binding.name,
        value: binding,
        ...(options && { options }),
      } as TemplateHole;
    }
    default: {
      // derive(), other helpers and other calls: the runtime computes the
      // hash, since a call may return an object or a placeholder.
      if (!assumesPrimitives || helper !== undefined) nonStatic();
      const binding: Binding = { value: hole as t.Expression };
      bindings.push(binding);
      return { kind: 'anonymous', value: binding };
    }
  }
}

/**
 * `path` holds only the bindings being resolved, which stops cycles while
 * sibling reads of a binding each check it. That rechecking doubles per level
 * in chains like `const v2 = flag ? v1 : v1`, so past the lookup budget the
 * template is left to the runtime.
 */
type Walk = { path: Set<t.Node>; lookupsLeft: number };

// Real alias chains take a handful of lookups; this stops only pathological ones.
const MAX_BINDING_LOOKUPS = 1000;

function newWalk(): Walk {
  return { path: new Set(), lookupsLeft: MAX_BINDING_LOOKUPS };
}

/** Strips TypeScript-only wrappers (as, satisfies, !, <Type>) and parentheses. */
function unwrapTypeScript(node: t.Node): t.Node {
  while (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isParenthesizedExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

const LOGICAL_ASSIGNMENTS = new Set(['??=', '||=', '&&=']);

/**
 * Whether a value is surely a primitive, which the runtime numbers as an
 * unnamed `_gt_N` variable; `new Date()` counts too, as the runtime reads any
 * Date as unnamed. Anything else is left to the runtime, which hashes the tree
 * it builds: an object is a named `{ name: value }` variable there and a
 * placeholder expands, so guessing would inject a key with no translation.
 * That includes values Babel cannot see into, such as parameters, call
 * results, destructured values and property reads, which may be either.
 */
function isPrimitive(node: t.Node, scope: Scope, walk: Walk): boolean {
  const value = unwrapTypeScript(node);
  if (t.isLiteral(value)) return !t.isRegExpLiteral(value);
  // Every unary, binary and update operator returns a primitive.
  if (
    t.isUnaryExpression(value) ||
    t.isBinaryExpression(value) ||
    t.isUpdateExpression(value)
  ) {
    return true;
  }
  // getBinding, not hasBinding, which also counts globals such as Date.
  if (t.isNewExpression(value)) {
    return (
      t.isIdentifier(value.callee, { name: 'Date' }) &&
      !scope.getBinding('Date')
    );
  }
  if (t.isConditionalExpression(value)) {
    return (
      isPrimitive(value.consequent, scope, walk) &&
      isPrimitive(value.alternate, scope, walk)
    );
  }
  if (t.isLogicalExpression(value)) {
    return (
      isPrimitive(value.left, scope, walk) &&
      isPrimitive(value.right, scope, walk)
    );
  }
  if (t.isSequenceExpression(value)) {
    return isPrimitive(value.expressions.at(-1)!, scope, walk);
  }
  if (t.isAssignmentExpression(value)) {
    // `a ??= b`, `a ||= b` and `a &&= b` are `a` or `b`; `a = b` is `b`; the
    // others, like `a += b`, compute a primitive.
    if (LOGICAL_ASSIGNMENTS.has(value.operator)) {
      return (
        isPrimitive(value.left, scope, walk) &&
        isPrimitive(value.right, scope, walk)
      );
    }
    return value.operator !== '=' || isPrimitive(value.right, scope, walk);
  }
  if (!t.isIdentifier(value)) return false;
  if (value.name === 'undefined') return !scope.getBinding('undefined');
  // An alias of `n` would read as an unnamed value instead of `#`.
  if (getHelperName(value.name, scope) !== undefined) return false;
  return everyAssignedValue(value, scope, walk);
}

/**
 * Whether every value a local `let`/`const`/`var` holds is a primitive: its
 * initializer and each assignment. Parameters, imports, destructured
 * variables and for...of variables are not proven.
 */
function everyAssignedValue(
  node: t.Identifier,
  scope: Scope,
  walk: Walk
): boolean {
  const binding = scope.getBinding(node.name);
  const declarator = binding?.path.node;
  if (
    // A direct eval() can assign any local without Babel seeing it.
    scope.hasGlobal('eval') ||
    !binding ||
    !t.isVariableDeclarator(declarator) ||
    !t.isIdentifier(declarator.id) ||
    // `for (const item of items)` has no initializer but holds each item.
    // for...in is fine: its keys are strings.
    binding.path.parentPath?.parentPath?.isForOfStatement()
  ) {
    return false;
  }
  // A cycle adds no value of its own: each one comes from an assignment
  // checked where the cycle started.
  if (walk.path.has(declarator)) return true;
  if (--walk.lookupsLeft < 0) nonStatic();
  walk.path.add(declarator);
  const proven =
    (!declarator.init ||
      isPrimitive(declarator.init, binding.path.scope, walk)) &&
    binding.constantViolations.every((violation) =>
      violation.isUpdateExpression()
        ? true
        : violation.isAssignmentExpression() &&
          t.isIdentifier(violation.node.left) &&
          isPrimitive(violation.node, violation.scope, walk)
    );
  walk.path.delete(declarator);
  return proven;
}

function getBranch(
  value: t.Node,
  scope: Scope,
  bindings: Binding[]
): TemplateBranch {
  if (t.isStringLiteral(value) || t.isTemplateLiteral(value)) {
    return getStaticText(value);
  }
  return getFragment(value, scope, bindings) ?? nonStatic();
}

/**
 * An inline part`...`; undefined otherwise. Fragments referenced through an
 * identifier are left to the runtime: the object can be mutated before use.
 */
function getFragment(
  node: t.Node,
  scope: Scope,
  bindings: Binding[]
): TemplateFragment | undefined {
  if (
    !t.isTaggedTemplateExpression(node) ||
    !t.isIdentifier(node.tag) ||
    getHelperName(node.tag.name, scope) !== 'part'
  ) {
    return;
  }
  return templateFragment(node.quasi, scope, bindings);
}

/** Name of `{ name }` / `{ name: value }`: an object literal with one key. */
/**
 * The value a helper formats: named, like plural({ count }, ...), or passed
 * directly, like plural(count, ...), which the builder numbers as `_gt_N`.
 */
function getHoleVariable(
  node: t.Node | undefined,
  scope: Scope,
  bindings: Binding[]
): Binding {
  const value = node && unwrapTypeScript(node);
  let binding: Binding;
  if (!t.isExpression(value) || t.isObjectExpression(value)) {
    const name = getVariableName(value);
    binding = { name, value: getVariableValue(value as t.ObjectExpression) };
  } else {
    // An object here is a { name: value } binding at runtime.
    if (!assumesPrimitives && !isPrimitive(value, scope, newWalk())) {
      nonStatic();
    }
    binding = { value: node as t.Expression };
  }
  bindings.push(binding);
  return binding;
}

/** The value of `{ name }` / `{ name: value }`, once getVariableName accepts it. */
function getVariableValue(node: t.ObjectExpression): t.Expression {
  return (node.properties[0] as t.ObjectProperty).value as t.Expression;
}

function getVariableName(node: t.Node | undefined): string {
  if (!t.isObjectExpression(node) || node.properties.length !== 1) {
    nonStatic();
  }
  return getPropertyKey(node.properties[0]);
}

function getPropertyKey(
  property: t.ObjectExpression['properties'][number]
): string {
  if (!t.isObjectProperty(property) || property.computed) nonStatic();
  const { key } = property;
  const name = t.isIdentifier(key)
    ? key.name
    : t.isStringLiteral(key)
      ? key.value
      : t.isNumericLiteral(key)
        ? String(key.value)
        : nonStatic();
  // A literal __proto__ key sets the prototype instead of a property.
  if (name === '__proto__') nonStatic();
  return name;
}

function getStaticText(node: t.Node): string {
  if (t.isStringLiteral(node)) return node.value;
  if (
    t.isTemplateLiteral(node) &&
    node.expressions.length === 0 &&
    node.quasis[0].value.cooked != null
  ) {
    return node.quasis[0].value.cooked;
  }
  nonStatic();
}

function getNumber(node: t.Node): number | undefined {
  if (t.isNumericLiteral(node)) return node.value;
  if (
    t.isUnaryExpression(node) &&
    node.operator === '-' &&
    t.isNumericLiteral(node.argument)
  ) {
    return -node.argument.value;
  }
}

/**
 * Flat Intl options object with literal values. Formatting context is not
 * part of the tree, so it is left out and may be any expression.
 */
function getIntlOptions(
  node: t.Node,
  kind: 'number' | 'date' | 'time',
  binding: Binding
): Record<string, string | number | boolean> {
  if (!t.isObjectExpression(node)) nonStatic();
  const contextKeys: readonly string[] =
    kind === 'number' ? NUMBER_CONTEXT_OPTIONS : DATE_TIME_CONTEXT_OPTIONS;
  const options: Record<string, string | number | boolean> = {};
  for (const property of node.properties) {
    const key = getPropertyKey(property);
    const value = (property as t.ObjectProperty).value;
    if (contextKeys.includes(key)) {
      (binding.context ??= []).push({ key, value: value as t.Expression });
      continue;
    }
    const number = getNumber(value);
    if (number != null) options[key] = number;
    else if (t.isBooleanLiteral(value)) options[key] = value.value;
    else options[key] = getStaticText(value);
  }
  return options;
}
