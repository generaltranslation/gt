import type { NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import {
  buildMessageTree,
  type MessageTreeBranch,
  type MessageTreeFragment,
  type MessageTreeHole,
} from '@generaltranslation/icu';
import {
  hashMessageTree,
  type MessageTreeHashMetadata,
} from 'generaltranslation/id';
import { isUnstableGTImportSource } from 'generaltranslation/internal';

// Derive-free mirror of the CLI walker in
// packages/cli/src/react/jsx/utils/stringParsing/extractMessageTrees/index.ts;
// test-fixtures/icu-tree-wire-format.json keeps both on the same hashes.

/** Thrown when a template is not plainly static; the runtime hashes it. */
function nonStatic(): never {
  throw new Error('Non-static unstable tagged template');
}

/**
 * Rewrites a statically analyzable unstable tagged template so the runtime
 * skips hashing: gt`...` -> gt({ $_hash })`...` and
 * gt({ context })`...` -> gt({ context, $_hash })`...`, for an imported `t`
 * and for the result of `const gt = useGT()` / `const gt = await getGT()`.
 * Returns whether the template was rewritten.
 */
export function injectUnstableTaggedTemplateHash(
  path: NodePath<t.TaggedTemplateExpression>
): boolean {
  const { tag, quasi } = path.node;
  const callee = t.isCallExpression(tag) ? tag.callee : tag;
  if (!t.isIdentifier(callee) || !isUnstableGT(callee.name, path.scope)) {
    return false;
  }
  let hash: string;
  try {
    const metadata = t.isCallExpression(tag)
      ? parseMessageOptions(tag.arguments)
      : {};
    const { strings, holes } = templateFragment(quasi, path.scope);
    hash = hashMessageTree(buildMessageTree(strings, holes).tree, metadata);
  } catch {
    // Non-static or invalid (e.g. a reserved `_gt_` name): skip only this
    // template; the runtime hashes it and reports any error.
    return false;
  }
  const hashProperty = t.objectProperty(
    t.identifier('$_hash'),
    t.stringLiteral(hash)
  );
  if (t.isCallExpression(tag)) {
    (tag.arguments[0] as t.ObjectExpression).properties.push(hashProperty);
  } else {
    path.node.tag = t.callExpression(tag, [t.objectExpression([hashProperty])]);
  }
  return true;
}

/** `t` imported from an unstable source, or `const gt = [await] useGT/getGT()`. */
function isUnstableGT(name: string, scope: Scope): boolean {
  if (getHelperName(name, scope) === 't') return true;
  const binding = scope.getBinding(name);
  if (
    !binding?.constant ||
    !binding.path.isVariableDeclarator() ||
    !t.isIdentifier(binding.path.node.id)
  ) {
    return false;
  }
  let init = binding.path.node.init;
  if (t.isAwaitExpression(init)) init = init.argument;
  if (!t.isCallExpression(init) || !t.isIdentifier(init.callee)) return false;
  const hook = getHelperName(init.callee.name, binding.path.scope);
  return hook === 'useGT' || hook === 'getGT';
}

/** Original name of an import from an unstable source. */
function getHelperName(name: string, scope: Scope): string | undefined {
  const binding = scope.getBinding(name);
  if (
    !binding?.path.isImportSpecifier() ||
    !binding.path.parentPath.isImportDeclaration() ||
    !isUnstableGTImportSource(binding.path.parentPath.node.source.value)
  ) {
    return;
  }
  const { imported } = binding.path.node;
  return t.isIdentifier(imported) ? imported.name : imported.value;
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
      case 'context':
        metadata.context = getStaticText(value);
        break;
      case 'maxChars': {
        const maxChars = getNumber(value);
        if (maxChars == null || !Number.isInteger(maxChars)) nonStatic();
        metadata.maxChars = maxChars;
        break;
      }
      case 'requiresReview':
        if (!t.isBooleanLiteral(value)) nonStatic();
        metadata.requiresReview = value.value;
        break;
      case 'locale':
        // Picks the render locale only; never part of the hash.
        break;
      default:
        nonStatic();
    }
  }
  return metadata;
}

function templateFragment(
  quasi: t.TemplateLiteral,
  scope: Scope
): MessageTreeFragment {
  return {
    strings: quasi.quasis.map(({ value }) => value.cooked ?? nonStatic()),
    holes: quasi.expressions.map((expression) => getHole(expression, scope)),
  };
}

function getHole(hole: t.Expression | t.TSType, scope: Scope): MessageTreeHole {
  const expression = unwrapTypeScript(hole);
  if (t.isObjectExpression(expression)) {
    return { kind: 'argument', name: getVariableName(expression) };
  }
  if (
    t.isIdentifier(expression) &&
    getHelperName(expression.name, scope) === 'n'
  ) {
    return { kind: 'pound' };
  }
  const fragment = getFragment(expression, scope);
  if (fragment) return { kind: 'fragment', ...fragment };
  if (!t.isCallExpression(expression) || !t.isIdentifier(expression.callee)) {
    if (!isPrimitive(expression, scope, newWalk())) nonStatic();
    return { kind: 'anonymous' };
  }
  const helper = getHelperName(expression.callee.name, scope);
  const args = expression.arguments;
  switch (helper) {
    case 'plural':
    case 'selectordinal':
    case 'select': {
      const [variable, branchesArg] = args;
      if (args.length !== 2 || !t.isObjectExpression(branchesArg)) nonStatic();
      const holeVariable = getHoleVariable(variable, scope);
      const branches: Record<string, MessageTreeBranch> = {};
      for (const property of branchesArg.properties) {
        branches[getPropertyKey(property)] = getBranch(
          (property as t.ObjectProperty).value,
          scope
        );
      }
      return { kind: helper, ...holeVariable, branches };
    }
    case 'number':
    case 'date': {
      if (args.length < 1 || args.length > 2) nonStatic();
      const holeVariable = getHoleVariable(args[0], scope);
      const options = args[1] && getIntlOptions(args[1]);
      return {
        kind: helper,
        ...holeVariable,
        ...(options && { options }),
      } as MessageTreeHole;
    }
    default:
      // derive(), other helpers and other calls: the runtime computes the
      // hash, since a call may return an object or a placeholder.
      nonStatic();
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
    // `a += b` and the like compute a primitive; `a = b` is `b`.
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
 * variables and loop variables are not proven.
 */
function everyAssignedValue(
  node: t.Identifier,
  scope: Scope,
  walk: Walk
): boolean {
  const binding = scope.getBinding(node.name);
  const declarator = binding?.path.node;
  if (
    !binding ||
    !t.isVariableDeclarator(declarator) ||
    !t.isIdentifier(declarator.id)
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

function getBranch(value: t.Node, scope: Scope): MessageTreeBranch {
  if (t.isStringLiteral(value) || t.isTemplateLiteral(value)) {
    return getStaticText(value);
  }
  return getFragment(value, scope) ?? nonStatic();
}

/**
 * An inline part`...`; undefined otherwise. Fragments referenced through an
 * identifier are left to the runtime: the object can be mutated before use.
 */
function getFragment(
  node: t.Node,
  scope: Scope
): MessageTreeFragment | undefined {
  if (
    !t.isTaggedTemplateExpression(node) ||
    !t.isIdentifier(node.tag) ||
    getHelperName(node.tag.name, scope) !== 'part'
  ) {
    return;
  }
  return templateFragment(node.quasi, scope);
}

/** Name of `{ name }` / `{ name: value }`: an object literal with one key. */
/**
 * The value a helper formats: named, like plural({ count }, ...), or passed
 * directly, like plural(count, ...), which the builder numbers as `_gt_N`.
 */
function getHoleVariable(
  node: t.Node | undefined,
  scope: Scope
): { name?: string } {
  const value = node && unwrapTypeScript(node);
  if (!t.isExpression(value) || t.isObjectExpression(value)) {
    return { name: getVariableName(value) };
  }
  // An object here is a { name: value } binding at runtime.
  if (!isPrimitive(value, scope, newWalk())) nonStatic();
  return {};
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

/** Flat Intl options object with literal values. */
function getIntlOptions(
  node: t.Node
): Record<string, string | number | boolean> {
  if (!t.isObjectExpression(node)) nonStatic();
  const options: Record<string, string | number | boolean> = {};
  for (const property of node.properties) {
    const key = getPropertyKey(property);
    const value = (property as t.ObjectProperty).value;
    const number = getNumber(value);
    if (number != null) options[key] = number;
    else if (t.isBooleanLiteral(value)) options[key] = value.value;
    else options[key] = getStaticText(value);
  }
  return options;
}
