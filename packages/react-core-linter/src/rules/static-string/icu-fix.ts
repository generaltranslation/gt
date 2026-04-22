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

/** ICU select keys must be simple identifier-like tokens (no whitespace or braces). */
const VALID_ICU_SELECT_KEY = /^\S+$/;

/**
 * Escapes ICU special characters in literal text using ICU apostrophe-quoting.
 * `'` → `''`, `{` → `'{'`, `}` → `'}'`
 */
function escapeICUText(str: string): string {
  return str.replace(/'/g, "''").replace(/\{/g, "'{").replace(/\}/g, "}'");
}

export type SelectBranch = { key: string; value: string };

/** Recursive type: the "other" of a select can itself be a nested select. */
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

/**
 * Determines what kind of ICU part a single expression becomes.
 */
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

/**
 * Extracts the select variable and key from a ternary test.
 * For equality (x === "val"), returns { variable: "x", key: "val" }.
 * For boolean (cond), returns { variable: "cond", key: "true" }.
 * Rejects keys with whitespace (invalid in ICU select syntax).
 */
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
        typeof literal.value === 'string' &&
        VALID_ICU_SELECT_KEY.test(literal.value)
      ) {
        return {
          variable: sourceCode.getText(variable),
          key: literal.value,
        };
      }
    }
  }

  // Non-equality tests (e.g. count > 5, fn(), a ?? b) fall through here.
  // The select uses key "true", so at runtime the "other" branch matches
  // most values. This is intentional — it preserves the ternary semantics.
  return {
    variable: sourceCode.getText(test),
    key: 'true',
  };
}

/**
 * Attempts to build a select FlatPart from a ternary expression.
 * Walks chained ternaries that share the same variable, collapsing them
 * into a single select with multiple branches.
 * When the chain breaks (different variable), recursively builds a nested select.
 * @returns null if any consequent is non-static.
 */
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

  while (tail.type === TSESTree.AST_NODE_TYPES.ConditionalExpression) {
    const innerInfo = extractSelectInfo(tail.test, sourceCode);
    if (innerInfo.variable !== firstInfo.variable) break;
    const innerConsStr = staticStringValue(tail.consequent);
    if (innerConsStr === null) break;
    branches.push({ key: innerInfo.key, value: innerConsStr });
    tail = tail.alternate;
  }

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

/**
 * Flattens a nested binary "+" tree into a left-to-right array of typed parts.
 */
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

/**
 * Checks whether a binary "+" tree contains a derive()/declareStatic() call.
 */
function concatContainsDerive(
  expr: TSESTree.Expression,
  ctx: ClassifyContext
): boolean {
  if (
    expr.type === TSESTree.AST_NODE_TYPES.CallExpression &&
    isDeriveFunction({ context: ctx.context, node: expr, libs: ctx.libs })
  ) {
    return true;
  }
  if (
    expr.type === TSESTree.AST_NODE_TYPES.BinaryExpression &&
    expr.operator === '+'
  ) {
    return (
      concatContainsDerive(expr.left, ctx) ||
      concatContainsDerive(expr.right, ctx)
    );
  }
  return false;
}

/**
 * Converts a template literal into the same FlatPart[] format as flattenConcat.
 * Template expressions that contain "+" with derive() are recursively flattened
 * so that `Hello ${name + derive(x) + last}` produces the same parts as
 * "Hello " + name + derive(x) + last.
 * Pure dynamic concat like `${first + last}` stays as a single variable.
 */
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
      const exprNode = expr.expressions[i] as TSESTree.Expression;
      if (
        exprNode.type === TSESTree.AST_NODE_TYPES.BinaryExpression &&
        exprNode.operator === '+' &&
        concatContainsDerive(exprNode, ctx)
      ) {
        parts.push(...flattenConcat(exprNode, ctx));
      } else {
        parts.push(classifyExpression(exprNode, ctx));
      }
    }
  }
  return parts;
}

/**
 * Returns true if the parts contain dynamic/select content that can be auto-fixed.
 */
export function isFixable(parts: FlatPart[]): boolean {
  let hasDynamic = false;
  for (const part of parts) {
    if (part.kind === 'dynamic' || part.kind === 'select') hasDynamic = true;
  }
  return hasDynamic;
}

/**
 * Returns true if any part is a derive() call.
 */
export function hasDerive(parts: FlatPart[]): boolean {
  return parts.some((p) => p.kind === 'derive');
}

type ICUResult = {
  icuString: string;
  options: { key: string; value: string }[];
};

type VarState = {
  counter: number;
  options: { key: string; value: string }[];
  seen: Map<string, string>;
  reserved: Set<string>;
};

/**
 * Resolves a variable name for a given source text value.
 * Reuses an existing name if the same source text was already assigned.
 * Skips names that collide with reserved (pre-existing) option keys.
 */
function resolveVarName(sourceText: string, state: VarState): string {
  const existing = state.seen.get(sourceText);
  if (existing) return existing;
  let varName = `var${state.counter++}`;
  while (state.reserved.has(varName)) {
    varName = `var${state.counter++}`;
  }
  state.seen.set(sourceText, varName);
  state.options.push({ key: varName, value: sourceText });
  return varName;
}

/**
 * Renders a SelectNode (potentially nested) into an ICU select string,
 * appending variables to the shared state with incrementing varN names.
 * Reuses variable names when the same source text appears multiple times.
 */
function renderSelect(node: SelectNode, state: VarState): string {
  const varName = resolveVarName(node.variable, state);

  const branchStr = node.branches
    .map((b) => `${b.key} {${escapeICUText(b.value)}}`)
    .join(' ');

  let otherContent: string;
  if (typeof node.other === 'string') {
    otherContent = escapeICUText(node.other);
  } else {
    otherContent = `{${renderSelect(node.other, state)}}`;
  }

  return `${varName}, select, ${branchStr} other {${otherContent}}`;
}

/**
 * Builds an ICU string and options object from classified parts.
 * Variables are named var0, var1, ... incrementing left-to-right.
 * Reuses variable names when the same expression appears multiple times.
 * Skips names in `reservedKeys` to avoid colliding with existing option keys.
 */
export function generateICUReplacement(
  parts: FlatPart[],
  sourceCode: SourceCode,
  reservedKeys: Set<string> = new Set()
): ICUResult {
  let icuString = '';
  const state: VarState = {
    counter: 0,
    options: [],
    seen: new Map(),
    reserved: reservedKeys,
  };

  for (const part of parts) {
    switch (part.kind) {
      case 'static':
        icuString += escapeICUText(part.value);
        break;
      case 'dynamic': {
        const sourceText = sourceCode.getText(part.node);
        const varName = resolveVarName(sourceText, state);
        icuString += `{${varName}}`;
        break;
      }
      case 'select': {
        icuString += `{${renderSelect(part, state)}}`;
        break;
      }
      case 'derive':
        break;
    }
  }

  return { icuString, options: state.options };
}

/**
 * Escapes characters that are special inside template literals.
 */
function escapeTemplateLiteral(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

/**
 * Builds a template literal string with ICU placeholders for dynamic parts
 * and ${} interpolations for derive() calls.
 * e.g. `{var0}${derive(blah)}{var1}` from parts [dynamic, derive, dynamic]
 */
export function generateTemplateLiteralReplacement(
  parts: FlatPart[],
  sourceCode: SourceCode,
  reservedKeys: Set<string> = new Set()
): ICUResult & { templateString: string } {
  let templateString = '`';
  const state: VarState = {
    counter: 0,
    options: [],
    seen: new Map(),
    reserved: reservedKeys,
  };

  for (const part of parts) {
    switch (part.kind) {
      case 'static':
        templateString += escapeTemplateLiteral(escapeICUText(part.value));
        break;
      case 'dynamic': {
        const sourceText = sourceCode.getText(part.node);
        const varName = resolveVarName(sourceText, state);
        templateString += `{${varName}}`;
        break;
      }
      case 'select': {
        templateString += `{${renderSelect(part, state)}}`;
        break;
      }
      case 'derive':
        templateString += `\${${sourceCode.getText(part.node)}}`;
        break;
    }
  }

  templateString += '`';

  return {
    icuString: '',
    options: state.options,
    templateString,
  };
}
