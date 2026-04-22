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
 * - Nested selects:     gt("" + (x === "a" ? "A" : y === "b" ? "B" : "C"))
 *                       → gt("{var0, select, a {A} other {{var1, select, b {B} other {C}}}}", { var0: x, var1: y })
 */

import { TSESTree } from '@typescript-eslint/utils';
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint';
import { staticStringValue } from '../../utils/expression-utils.js';
import type { RuleContext } from '@typescript-eslint/utils/ts-eslint';
import { isDeriveFunction } from '../../utils/isGTFunction.js';
import type { GTLibrary } from '../../utils/constants.js';

export type SelectBranch = { key: string; value: string };

// Recursive type: the "other" of a select can itself be a nested select.
export type SelectNode = {
  variable: string;
  branches: SelectBranch[];
  other: string | SelectNode;
};

export type FlatPart =
  | { kind: 'static'; value: string }
  | { kind: 'derive'; node: TSESTree.CallExpression }
  | { kind: 'dynamic'; node: TSESTree.Expression }
  | ({ kind: 'select' } & SelectNode);

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
// When the chain breaks (different variable), recursively builds a nested select.
// Returns null if any consequent is non-static.
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

  // Resolve the "other" value: static string, or recurse into a nested select
  let other: string | SelectNode;
  const otherStr = staticStringValue(tail);
  if (otherStr !== null) {
    other = otherStr;
  } else if (tail.type === TSESTree.AST_NODE_TYPES.ConditionalExpression) {
    const nested = tryBuildSelect(tail, sourceCode);
    if (nested === null || nested.kind !== 'select') return null;
    other = {
      variable: nested.variable,
      branches: nested.branches,
      other: nested.other,
    };
  } else {
    return null;
  }

  return {
    kind: 'select',
    variable: firstInfo.variable,
    branches,
    other,
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

type ICUResult = {
  icuString: string;
  options: { key: string; value: string }[];
};

// Renders a SelectNode (potentially nested) into an ICU select string,
// appending variables to the shared options array with incrementing varN names.
function renderSelect(
  node: SelectNode,
  options: { key: string; value: string }[],
  counter: { value: number }
): string {
  const varName = `var${counter.value++}`;
  options.push({ key: varName, value: node.variable });

  const branchStr = node.branches.map((b) => `${b.key} {${b.value}}`).join(' ');

  let otherContent: string;
  if (typeof node.other === 'string') {
    otherContent = node.other;
  } else {
    otherContent = `{${renderSelect(node.other, options, counter)}}`;
  }

  return `${varName}, select, ${branchStr} other {${otherContent}}`;
}

// Builds an ICU string and options object from classified parts.
// Variables are named var0, var1, ... incrementing left-to-right.
export function generateICUReplacement(
  parts: FlatPart[],
  sourceCode: SourceCode
): ICUResult {
  let icuString = '';
  const options: { key: string; value: string }[] = [];
  const counter = { value: 0 };

  for (const part of parts) {
    switch (part.kind) {
      case 'static':
        icuString += part.value;
        break;
      case 'dynamic': {
        const varName = `var${counter.value++}`;
        icuString += `{${varName}}`;
        options.push({ key: varName, value: sourceCode.getText(part.node) });
        break;
      }
      case 'select': {
        icuString += `{${renderSelect(part, options, counter)}}`;
        break;
      }
      case 'derive':
        break;
    }
  }

  return { icuString, options };
}
