/**
 * ICU auto-fix: converts dynamic concat/template expressions into ICU-formatted strings.
 *
 * Handles:
 * - Concatenation:      gt("Hello " + name)                → gt("Hello {var0}", { var0: name })
 * - Template literals:  gt(`Hello ${name}!`)                → gt("Hello {var0}!", { var0: name })
 * - Ternaries:          gt("Hi " + (c ? "A" : "B"))        → gt("Hi {var0, select, true {A} other {B}}", { var0: c })
 * - Equality select:    gt("" + (x === "a" ? "A" : "B"))   → gt("{var0, select, a {A} other {B}}", { var0: x })
 * - Chained ternaries:  gt("" + (x === "a" ? "A" : x === "b" ? "B" : "C"))
 *                       → gt("{var0, select, a {A} b {B} other {C}}", { var0: x })
 */

import { TSESTree } from '@typescript-eslint/utils';
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint';
import { staticStringValue } from '../../utils/expression-utils.js';
import type { RuleContext } from '@typescript-eslint/utils/ts-eslint';
import { isDeriveFunction } from '../../utils/isGTFunction.js';
import type { GTLibrary } from '../../utils/constants.js';

export type SelectBranch = { key: string; value: string };

export type FlatPart =
  | { kind: 'static'; value: string }
  | { kind: 'derive'; node: TSESTree.CallExpression }
  | { kind: 'dynamic'; node: TSESTree.Expression }
  | {
      kind: 'select';
      variable: string;
      branches: SelectBranch[];
      other: string;
    };

type ClassifyContext = {
  context: Readonly<RuleContext<string, readonly unknown[]>>;
  libs: readonly GTLibrary[];
  sourceCode: SourceCode;
};

// Determines what kind of ICU part a single expression becomes.
function classifyExpression(
  expr: TSESTree.Expression,
  ctx: ClassifyContext
): FlatPart {
  const str = staticStringValue(expr);
  if (str !== null) {
    return { kind: 'static', value: str };
  }

  if (
    expr.type === TSESTree.AST_NODE_TYPES.CallExpression &&
    isDeriveFunction({ context: ctx.context, node: expr, libs: ctx.libs })
  ) {
    return { kind: 'derive', node: expr };
  }

  if (expr.type === TSESTree.AST_NODE_TYPES.ConditionalExpression) {
    const select = tryBuildSelect(expr, ctx.sourceCode);
    if (select) return select;
  }

  return { kind: 'dynamic', node: expr };
}

type SelectInfo = {
  variable: string;
  key: string;
};

// Extracts the select variable and key from a ternary test.
// For equality (x === "val"), returns { variable: "x", key: "val" }.
// For boolean (cond), returns { variable: "cond", key: "true" }.
function extractSelectInfo(
  test: TSESTree.Expression,
  sourceCode: SourceCode
): SelectInfo {
  if (
    test.type === TSESTree.AST_NODE_TYPES.BinaryExpression &&
    (test.operator === '===' || test.operator === '==')
  ) {
    const sides: [TSESTree.Expression, TSESTree.Expression][] = [
      [test.left, test.right],
      [test.right, test.left],
    ];
    for (const [variable, literal] of sides) {
      if (
        literal.type === TSESTree.AST_NODE_TYPES.Literal &&
        typeof literal.value === 'string'
      ) {
        return {
          variable: sourceCode.getText(variable),
          key: literal.value,
        };
      }
    }
  }

  return {
    variable: sourceCode.getText(test),
    key: 'true',
  };
}

// Attempts to build a select FlatPart from a ternary expression.
// Walks chained ternaries that share the same variable, collapsing them
// into a single select with multiple branches.
// Returns null if any branch has non-static content.
function tryBuildSelect(
  expr: TSESTree.ConditionalExpression,
  sourceCode: SourceCode
): FlatPart | null {
  const firstInfo = extractSelectInfo(expr.test, sourceCode);
  const firstConsStr = staticStringValue(expr.consequent);
  if (firstConsStr === null) return null;

  const branches: SelectBranch[] = [
    { key: firstInfo.key, value: firstConsStr },
  ];
  let tail: TSESTree.Expression = expr.alternate;

  // Walk chained ternaries as long as they test the same variable
  while (tail.type === TSESTree.AST_NODE_TYPES.ConditionalExpression) {
    const innerInfo = extractSelectInfo(tail.test, sourceCode);
    if (innerInfo.variable !== firstInfo.variable) break;
    const innerConsStr = staticStringValue(tail.consequent);
    if (innerConsStr === null) break;
    branches.push({ key: innerInfo.key, value: innerConsStr });
    tail = tail.alternate;
  }

  const otherStr = staticStringValue(tail);
  if (otherStr === null) return null;

  return {
    kind: 'select',
    variable: firstInfo.variable,
    branches,
    other: otherStr,
  };
}

// Flattens a nested binary "+" tree into a left-to-right array of typed parts.
export function flattenConcat(
  expr: TSESTree.Expression,
  ctx: ClassifyContext
): FlatPart[] {
  if (
    expr.type === TSESTree.AST_NODE_TYPES.BinaryExpression &&
    expr.operator === '+'
  ) {
    return [
      ...flattenConcat(expr.left, ctx),
      ...flattenConcat(expr.right, ctx),
    ];
  }
  return [classifyExpression(expr, ctx)];
}

// Converts a template literal into the same FlatPart[] format as flattenConcat.
export function flattenTemplateLiteral(
  expr: TSESTree.TemplateLiteral,
  ctx: ClassifyContext
): FlatPart[] {
  const parts: FlatPart[] = [];
  for (let i = 0; i < expr.quasis.length; i++) {
    const quasi = expr.quasis[i];
    const text = quasi.value.cooked ?? quasi.value.raw;
    if (text) {
      parts.push({ kind: 'static', value: text });
    }
    if (i < expr.expressions.length) {
      parts.push(
        classifyExpression(expr.expressions[i] as TSESTree.Expression, ctx)
      );
    }
  }
  return parts;
}

// Returns true if the parts contain dynamic/select content and no derive() calls.
// derive() mixed with dynamic is too complex for auto-fix; we skip those.
export function isFixable(parts: FlatPart[]): boolean {
  let hasDynamic = false;
  for (const part of parts) {
    if (part.kind === 'derive') return false;
    if (part.kind === 'dynamic' || part.kind === 'select') hasDynamic = true;
  }
  return hasDynamic;
}

// Builds an ICU string and options object from classified parts.
// Variables are named var0, var1, ... incrementing left-to-right.
export function generateICUReplacement(
  parts: FlatPart[],
  sourceCode: SourceCode
): { icuString: string; options: { key: string; value: string }[] } {
  let icuString = '';
  const options: { key: string; value: string }[] = [];
  let varCounter = 0;

  for (const part of parts) {
    switch (part.kind) {
      case 'static':
        icuString += part.value;
        break;
      case 'dynamic': {
        const varName = `var${varCounter++}`;
        icuString += `{${varName}}`;
        options.push({ key: varName, value: sourceCode.getText(part.node) });
        break;
      }
      case 'select': {
        const varName = `var${varCounter++}`;
        const branchStr = part.branches
          .map((b) => `${b.key} {${b.value}}`)
          .join(' ');
        icuString += `{${varName}, select, ${branchStr} other {${part.other}}}`;
        options.push({ key: varName, value: part.variable });
        break;
      }
      case 'derive':
        break;
    }
  }

  return { icuString, options };
}
