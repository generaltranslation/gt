import type { ResolutionNode } from '../../nodes/types';
import { isChoiceNode } from '../../nodes/guards';
import * as t from '@babel/types';
import { isDeriveInvocation } from './isDeriveInvocation';
import { NodePath } from '@babel/traverse';
import { StringPart } from '../../nodes/types';

type Metadata = {
  hasDynamic: boolean;
  hasDerive: boolean;
  hasStatic: boolean;
};

/**
 * Extracts a string and variables from expression
 * @param expr - The expression to extract from
 * @param derive - Perform derivation
 *
 * Sequential 'static' parts are concatenated.
 *
 * When derive is true, parts will only be composed of dynamic and static parts
 *
 * TODO: add derivation
 */
export function extractString(
  path: NodePath<t.Expression>,
  derive: false
): { value?: StringPart[]; errors: string[]; metadata: Metadata };
export function extractString(
  path: NodePath<t.Expression>,
  derive: true
): {
  value?: ResolutionNode<StringPart>[];
  errors: string[];
  metadata: Metadata;
};
export function extractString(
  path: NodePath<t.Expression>,
  derive?: boolean
): {
  value?: ResolutionNode<StringPart>[];
  errors: string[];
  metadata: Metadata;
};
export function extractString(
  path: NodePath<t.Expression>,
  derive: boolean = false
): {
  value?: ResolutionNode<StringPart>[];
  errors: string[];
  metadata: Metadata;
} {
  const expr = path.node;

  // gt("Hello")
  if (t.isStringLiteral(expr)) {
    return {
      errors: [],
      value: [createStaticPart(expr.value)],
      metadata: { hasDynamic: false, hasDerive: false, hasStatic: true },
    };
  }

  // gt(123)
  if (t.isNumericLiteral(expr)) {
    return {
      errors: [],
      value: [createStaticPart(String(expr.value))],
      metadata: { hasDynamic: false, hasDerive: false, hasStatic: true },
    };
  }

  // gt(true)
  if (t.isBooleanLiteral(expr)) {
    return {
      errors: [],
      value: [createStaticPart(String(expr.value))],
      metadata: { hasDynamic: false, hasDerive: false, hasStatic: true },
    };
  }

  // gt(null)
  if (t.isNullLiteral(expr)) {
    return {
      errors: [],
      value: [createStaticPart('null')],
      metadata: { hasDynamic: false, hasDerive: false, hasStatic: true },
    };
  }

  // gt("Hello" + "World")
  if (t.isBinaryExpression(expr) && expr.operator === '+') {
    const left = extractString(
      path.get('left') as NodePath<t.Expression>,
      derive
    );
    if (left.errors.length || left.value == null) return left;
    const right = extractString(
      path.get('right') as NodePath<t.Expression>,
      derive
    );
    if (right.errors.length || right.value == null) return right;
    const result: ResolutionNode<StringPart>[] = [];
    addParts(result, left.value);
    addParts(result, right.value);
    return {
      errors: [],
      value: result,
      metadata: {
        hasDynamic: left.metadata.hasDynamic || right.metadata.hasDynamic,
        hasDerive: left.metadata.hasDerive || right.metadata.hasDerive,
        hasStatic: left.metadata.hasStatic || right.metadata.hasStatic,
      },
    };
  }

  // gt(`Hello ${"World"}`)
  if (t.isTemplateLiteral(expr)) {
    const result: ResolutionNode<StringPart>[] = [];
    const metadata: Metadata = {
      hasDynamic: false,
      hasDerive: false,
      hasStatic: false,
    };
    for (let i = 0; i < expr.quasis.length; i++) {
      // Extract cooked string
      const cooked = expr.quasis[i].value.cooked;
      if (cooked == null) {
        return {
          errors: ['Template literal contains an invalid escape sequence'],
          metadata,
        };
      }

      // Add to current part or create new part
      if (cooked != null) metadata.hasStatic = true;
      addPart(result, createStaticPart(cooked));

      // Parse expression
      if (i < expr.expressions.length) {
        const resolved = extractString(
          path.get('expressions')[i] as NodePath<t.Expression>,
          derive
        );
        if (resolved.errors.length || resolved.value == null) return resolved;
        metadata.hasDynamic =
          metadata.hasDynamic || resolved.metadata.hasDynamic;
        metadata.hasDerive = metadata.hasDerive || resolved.metadata.hasDerive;
        metadata.hasStatic = metadata.hasStatic || resolved.metadata.hasStatic;

        addParts(result, resolved.value);
      }
    }

    return {
      errors: [],
      value: result,
      metadata,
    };
  }

  // gt(derive("Hello"))
  const scope = path.scope;
  if (isDeriveInvocation(expr, scope)) {
    if (derive) {
      // TODO: add derive-logic here
    }
    return {
      errors: [],
      value: [createDerivePart(expr)],
      metadata: { hasDynamic: false, hasDerive: true, hasStatic: false },
    };
  }

  // Fall back to dynamic
  return {
    errors: [],
    value: [createDynamicPart(expr)],
    metadata: { hasDynamic: true, hasDerive: false, hasStatic: false },
  };
}

// ===== Helper Functions ===== //

/**
 * Creates a static part
 * @param value - The value of the static part
 * @returns A static part
 */
function createStaticPart(value: string): StringPart {
  return { type: 'static', content: value };
}

/**
 * Creates a dynamic part
 * @param node - The node of the dynamic part
 * @returns A dynamic part
 */
function createDynamicPart(node: t.Expression): StringPart {
  return { type: 'dynamic', content: node };
}

/**
 * Creates a derive part
 * @param node - The node of the derive part
 * @returns A derive part
 */
function createDerivePart(node: t.Expression): StringPart {
  return { type: 'derive', content: node };
}

/**
 * Checks if a part is a static part
 * @param part - The part to check
 * @returns Whether the part is a static part
 */
function isStaticPart(
  part: ResolutionNode<StringPart>
): part is { type: 'static'; content: string } {
  return part != null && !isChoiceNode(part) && part.type === 'static';
}

/**
 * Adds a part to the result
 * @param result - The result to add the part to
 * @param part - The part to add
 */
function addPart(
  result: ResolutionNode<StringPart>[],
  part: ResolutionNode<StringPart>
) {
  const current = result[result.length - 1];
  if (isStaticPart(current) && isStaticPart(part)) {
    current.content += part.content;
  } else {
    result.push(part);
  }
}

/**
 * Adds parts to the result
 * @param result - The result to add the parts to
 * @param parts - The parts to add
 */
function addParts(
  result: ResolutionNode<StringPart>[],
  parts: ResolutionNode<StringPart>[]
) {
  for (const part of parts) {
    addPart(result, part);
  }
}
