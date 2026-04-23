import { ResolutionNode, isChoiceNode } from '../../nodes';
import * as t from '@babel/types';
import { isDeriveInvocation } from '../../utils/parsing/isDeriveInvocation';
import { NodePath } from '@babel/traverse';

/**
 * Extraction units
 */
type Part =
  | { type: 'static'; content: string }
  | { type: 'derive'; content: t.Expression }
  | { type: 'dynamic'; content: t.Expression };

/**
 * Extracts a string and variables from expression
 * @param expr - The expression to extract from
 * @param scope - The scope to use for the extraction
 * @param derive - Whether to perform derivation
 *
 * When derive is true, parts will only be composed of dynamic and static parts
 */
export function extractString(
  // expr: t.Expression,
  path: NodePath<t.Expression>,
  derive: boolean = false
): { value?: ResolutionNode<Part>[]; errors: string[] } {
  const expr = path.node;

  // gt("Hello")
  if (t.isStringLiteral(expr)) {
    return { errors: [], value: [createStaticPart(expr.value)] };
  }

  // gt(123)
  if (t.isNumericLiteral(expr)) {
    return { errors: [], value: [createStaticPart(String(expr.value))] };
  }

  // gt(true)
  if (t.isBooleanLiteral(expr)) {
    return { errors: [], value: [createStaticPart(String(expr.value))] };
  }

  // gt(null)
  if (t.isNullLiteral(expr)) {
    return { errors: [], value: [createStaticPart('null')] };
  }

  // gt("Hello" + "World")
  if (t.isBinaryExpression(expr) && expr.operator === '+') {
    const left = extractString(path.get('left') as NodePath<t.Expression>);
    if (left.errors.length || left.value == null) return left;
    const right = extractString(path.get('right') as NodePath<t.Expression>);
    if (right.errors.length || right.value == null) return right;
    const result: ResolutionNode<Part>[] = [];
    addParts(result, left.value);
    addParts(result, right.value);
    return { errors: [], value: result };
  }

  // gt(`Hello ${"World"}`)
  if (t.isTemplateLiteral(expr)) {
    const result: ResolutionNode<Part>[] = [];
    for (let i = 0; i < expr.quasis.length; i++) {
      // Extract cooked string
      const cooked = expr.quasis[i].value.cooked;
      if (cooked == null) {
        return {
          errors: ['Template literal contains an invalid escape sequence'],
        };
      }

      // Add to current part or create new part
      addPart(result, createStaticPart(cooked));

      // Parse expression
      if (i < expr.expressions.length) {
        const resolved = extractString(
          path.get('expressions')[i] as NodePath<t.Expression>,
          derive
        );
        if (resolved.errors.length || resolved.value == null) return resolved;

        addParts(result, resolved.value);
      }
    }

    return { errors: [], value: result };
  }

  // gt(derive("Hello"))
  const scope = path.scope;
  if (isDeriveInvocation(expr, scope)) {
    return { errors: [], value: [createDerivePart(expr)] };
  }

  // Fall back to dynamic
  return { errors: [], value: [createDynamicPart(expr)] };
}

// ===== Helper Functions ===== //

/**
 * Creates a static part
 * @param value - The value of the static part
 * @returns A static part
 */
function createStaticPart(value: string): Part {
  return { type: 'static', content: value };
}

/**
 * Creates a dynamic part
 * @param node - The node of the dynamic part
 * @returns A dynamic part
 */
function createDynamicPart(node: t.Expression): Part {
  return { type: 'dynamic', content: node };
}

/**
 * Creates a derive part
 * @param node - The node of the derive part
 * @returns A derive part
 */
function createDerivePart(node: t.Expression): Part {
  return { type: 'derive', content: node };
}

/**
 * Adds a part to the result
 * @param result - The result to add the part to
 * @param part - The part to add
 */
function addPart(result: ResolutionNode<Part>[], part: ResolutionNode<Part>) {
  const current = result[result.length - 1];
  if (
    current == null ||
    isChoiceNode(current) ||
    current.type !== 'static' ||
    isChoiceNode(part)
  ) {
    result.push(part);
  } else {
    current.content += part.content;
  }
}

/**
 * Adds parts to the result
 * @param result - The result to add the parts to
 * @param parts - The parts to add
 */
function addParts(
  result: ResolutionNode<Part>[],
  parts: ResolutionNode<Part>[]
) {
  for (const part of parts) {
    addPart(result, part);
  }
}
