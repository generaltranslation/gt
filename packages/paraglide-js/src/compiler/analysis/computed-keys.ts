import { unwrapExpression, type ESTree, type Node } from './ast.js';
import { expressionsOf, type Scope } from './scope.js';

/** A text a computed key can have; when `dynamic`, each `*` in it stands for unknown text. */
export type Key = { text: string; dynamic: boolean };

/** What a part of a key evaluates to. `+` adds numbers and joins texts; of an unknown value, it may do either. */
type Operand =
  | { type: 'text'; text: string; dynamic: boolean }
  | { type: 'number'; value: number }
  | { type: 'unknown' };

const MAX_ALTERNATIVES = 16;
const MAX_DEPTH = 32;
const UNKNOWN: Operand[] = [{ type: 'unknown' }];

/**
 * `"a"` → a; `` `err_${code}` `` → err_*; `cond ? "a" : "b"` → a, b;
 * `const k = "a"; k` → a; `"step_" + (1 + 2)` → step_3; anything else → *.
 */
export function keyAlternatives(expression: Node, scope: Scope): Key[] {
  return uniqueByText(operandsOf(expression, scope, 0).map(toKey));
}

function operandsOf(expression: Node, scope: Scope, depth: number): Operand[] {
  if (depth > MAX_DEPTH) return UNKNOWN;

  const operandsOfPart = (part: Node) => operandsOf(part, scope, depth + 1);
  const node = unwrapExpression(expression);

  switch (node.type) {
    case 'Literal':
      return literalOperand(node.value);

    case 'TemplateLiteral':
      return templateOperands(node, operandsOfPart);

    case 'BinaryExpression':
      if (node.operator !== '+') return UNKNOWN;
      return combine(
        operandsOfPart(node.left as Node),
        operandsOfPart(node.right),
        sum
      );

    case 'ConditionalExpression':
      return union(
        operandsOfPart(node.consequent),
        operandsOfPart(node.alternate)
      );

    case 'LogicalExpression':
      return union(operandsOfPart(node.left), operandsOfPart(node.right));

    case 'Identifier':
      return identifierOperands(node, scope, depth);

    default:
      return UNKNOWN;
  }
}

function literalOperand(value: unknown): Operand[] {
  if (typeof value === 'string') return [staticText(value)];
  if (typeof value === 'number') return [{ type: 'number', value }];

  return UNKNOWN;
}

/** A template is a text, whatever its parts are: `` `step_${index + 1}` `` → step_*. */
function templateOperands(
  template: ESTree.TemplateLiteral,
  operandsOfPart: (part: Node) => Operand[]
): Operand[] {
  const textAt = (index: number) => [
    staticText(template.quasis[index]?.value.cooked ?? ''),
  ];

  let operands = textAt(0);

  template.expressions.forEach((part, index) => {
    operands = combine(operands, operandsOfPart(part), join);
    operands = combine(operands, textAt(index + 1), join);
  });

  return operands;
}

function identifierOperands(
  identifier: Node,
  scope: Scope,
  depth: number
): Operand[] {
  const held = expressionsOf(scope.bindingAt(identifier));
  if (held.length === 0) return UNKNOWN;

  let operands: Operand[] = [];

  for (const { node, scope: heldScope, path } of held) {
    const isDestructured = path.length > 0;
    if (isDestructured) return UNKNOWN;

    operands = union(operands, operandsOf(node, heldScope, depth + 1));
  }

  return operands;
}

/**
 * `1 + 2` → 3; `"step_" + index` → step_*; `index + 1` → *, not *1: an
 * unknown `index` may be a number.
 */
function sum(left: Operand, right: Operand): Operand {
  if (left.type === 'number' && right.type === 'number') {
    return { type: 'number', value: left.value + right.value };
  }

  const joinsTexts = left.type === 'text' || right.type === 'text';

  return joinsTexts ? join(left, right) : { type: 'unknown' };
}

function join(left: Operand, right: Operand): Operand {
  const text = (textOf(left) + textOf(right)).replace(/\*+/g, '*');

  return { type: 'text', text, dynamic: isDynamic(left) || isDynamic(right) };
}

function combine(
  left: Operand[],
  right: Operand[],
  operation: (a: Operand, b: Operand) => Operand
): Operand[] {
  const operands = left.flatMap((a) => right.map((b) => operation(a, b)));

  return operands.length > MAX_ALTERNATIVES ? UNKNOWN : unique(operands);
}

function union(left: Operand[], right: Operand[]): Operand[] {
  const operands = unique([...left, ...right]);

  return operands.length > MAX_ALTERNATIVES ? UNKNOWN : operands;
}

function unique(operands: Operand[]): Operand[] {
  const byIdentity = new Map<string, Operand>();

  for (const operand of operands) {
    const identity = `${operand.type}\0${isDynamic(operand)}\0${textOf(operand)}`;
    if (!byIdentity.has(identity)) byIdentity.set(identity, operand);
  }

  return [...byIdentity.values()];
}

function staticText(text: string): Operand {
  return { type: 'text', text, dynamic: false };
}

function textOf(operand: Operand): string {
  switch (operand.type) {
    case 'text':
      return operand.text;
    case 'number':
      return String(operand.value);
    case 'unknown':
      return '*';
  }
}

function isDynamic(operand: Operand): boolean {
  if (operand.type === 'text') return operand.dynamic;

  return operand.type === 'unknown';
}

function toKey(operand: Operand): Key {
  return { text: textOf(operand), dynamic: isDynamic(operand) };
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
