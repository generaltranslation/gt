import { isNode, type AnyNode } from './ast.js';

export type StringOptions = {
  $context?: string;
  $maxChars?: number;
  $requiresReview?: boolean;
};

const transparentTypes = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'ParenthesizedExpression',
]);

function unwrap(node: AnyNode): AnyNode {
  let current = node;
  while (transparentTypes.has(current.type) && isNode(current.expression)) {
    current = current.expression;
  }
  return current;
}

/** Evaluates literals, quasi-free template literals and `+` chains of strings. */
export function evaluateConstant(
  input: unknown
): string | number | boolean | undefined {
  if (!isNode(input)) return undefined;
  const node = unwrap(input);
  switch (node.type) {
    case 'Literal': {
      const value = node.value;
      return typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
        ? value
        : undefined;
    }
    case 'TemplateLiteral': {
      const quasis = node.quasis as { value: { cooked?: string | null } }[];
      if ((node.expressions as unknown[]).length) return undefined;
      return quasis[0]?.value.cooked ?? undefined;
    }
    case 'BinaryExpression': {
      if (node.operator !== '+') return undefined;
      const left = evaluateConstant(node.left);
      const right = evaluateConstant(node.right);
      return typeof left === 'string' && typeof right === 'string'
        ? left + right
        : undefined;
    }
    case 'UnaryExpression': {
      const argument = evaluateConstant(node.argument);
      return node.operator === '-' && typeof argument === 'number'
        ? -argument
        : undefined;
    }
    default:
      return undefined;
  }
}

export function evaluateString(input: unknown): string | undefined {
  const value = evaluateConstant(input);
  return typeof value === 'string' ? value : undefined;
}

const optionTypes = {
  $context: 'string',
  $maxChars: 'number',
  $requiresReview: 'boolean',
} as const;

export function evaluateStringOptions(
  input: unknown
): StringOptions | undefined {
  if (!isNode(input)) return undefined;
  const node = unwrap(input);
  if (node.type !== 'ObjectExpression') return undefined;
  const options: Record<string, unknown> = {};
  for (const property of node.properties as AnyNode[]) {
    if (
      property.type !== 'Property' ||
      property.kind !== 'init' ||
      property.method ||
      property.computed
    ) {
      return undefined;
    }
    const key = property.key as AnyNode;
    const name = key.type === 'Identifier' ? key.name : key.value;
    if (typeof name !== 'string' || !Object.hasOwn(optionTypes, name)) {
      return undefined;
    }
    const value = evaluateConstant(property.value);
    if (typeof value !== optionTypes[name as keyof typeof optionTypes]) {
      return undefined;
    }
    options[name] = value;
  }
  return options as StringOptions;
}
