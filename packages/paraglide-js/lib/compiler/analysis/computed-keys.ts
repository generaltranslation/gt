import { unwrapExpression, type ESTree, type Node } from './ast.js';
import { expressionsOf, type Scope } from './scope.js';

/** A text a computed key can have; when `dynamic`, each `*` in it stands for unknown text. */
export type Key = { text: string; dynamic: boolean };

const MAX_ALTERNATIVES = 16;
const MAX_DEPTH = 32;
const ANY_KEY: Key[] = [{ text: '*', dynamic: true }];

/**
 * `"a"` → a; `` `err_${code}` `` → err_*; `cond ? "a" : "b"` → a, b;
 * `const k = "a"; k` → a; anything else → *.
 */
export function keyAlternatives(
  expression: Node,
  scope: Scope,
  depth = 0
): Key[] {
  if (depth > MAX_DEPTH) return ANY_KEY;

  const alternativesOf = (part: Node) =>
    keyAlternatives(part, scope, depth + 1);
  const node = unwrapExpression(expression);

  switch (node.type) {
    case 'Literal': {
      const isText =
        typeof node.value === 'string' || typeof node.value === 'number';
      return isText ? [staticKey(String(node.value))] : ANY_KEY;
    }

    case 'TemplateLiteral':
      return templateAlternatives(node, alternativesOf);

    case 'BinaryExpression':
      if (node.operator !== '+') return ANY_KEY;
      return concatenate(
        alternativesOf(node.left as Node),
        alternativesOf(node.right)
      );

    case 'ConditionalExpression':
      return union(
        alternativesOf(node.consequent),
        alternativesOf(node.alternate)
      );

    case 'LogicalExpression':
      return union(alternativesOf(node.left), alternativesOf(node.right));

    case 'Identifier':
      return identifierAlternatives(node, scope, depth);

    default:
      return ANY_KEY;
  }
}

function templateAlternatives(
  template: ESTree.TemplateLiteral,
  alternativesOf: (part: Node) => Key[]
): Key[] {
  const textAt = (index: number) => [
    staticKey(template.quasis[index]?.value.cooked ?? ''),
  ];

  let keys = textAt(0);

  template.expressions.forEach((part, index) => {
    keys = concatenate(keys, alternativesOf(part));
    keys = concatenate(keys, textAt(index + 1));
  });

  return keys;
}

function identifierAlternatives(
  identifier: Node,
  scope: Scope,
  depth: number
): Key[] {
  const held = expressionsOf(scope.bindingAt(identifier));
  if (held.length === 0) return ANY_KEY;

  let keys: Key[] = [];

  for (const { node, scope: heldScope, path } of held) {
    const isDestructured = path.length > 0;
    if (isDestructured) return ANY_KEY;

    keys = union(keys, keyAlternatives(node, heldScope, depth + 1));
  }

  return keys;
}

function staticKey(text: string): Key {
  return { text, dynamic: false };
}

function concatenate(left: Key[], right: Key[]): Key[] {
  const keys: Key[] = [];

  for (const a of left) {
    for (const b of right) {
      const text = (a.text + b.text).replace(/\*+/g, '*');
      keys.push({ text, dynamic: a.dynamic || b.dynamic });
    }
  }

  return keys.length > MAX_ALTERNATIVES ? ANY_KEY : uniqueByText(keys);
}

function union(left: Key[], right: Key[]): Key[] {
  const keys = uniqueByText([...left, ...right]);

  return keys.length > MAX_ALTERNATIVES ? ANY_KEY : keys;
}

/** A static key wins over a dynamic one with the same text. */
function uniqueByText(keys: Key[]): Key[] {
  const byText = new Map<string, Key>();

  for (const key of keys) {
    const existing = byText.get(key.text);
    const replaces = !existing || (existing.dynamic && !key.dynamic);

    if (replaces) byText.set(key.text, key);
  }

  return [...byText.values()];
}
