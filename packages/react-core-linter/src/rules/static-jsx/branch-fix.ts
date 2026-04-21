/**
 * Branch auto-fix: generates <Branch> JSX from ternary/logical-AND expressions.
 *
 * Handles:
 * - Ternaries:    {cond ? "yes" : "no"}        → <Branch branch={cond} true="yes">no</Branch>
 * - Equality:     {x === "a" ? "A" : "other"}  → <Branch branch={x} a="A">other</Branch>
 * - Negation:     {!cond ? "no" : "yes"}        → <Branch branch={cond} true="yes">no</Branch>
 * - Logical AND:  {x && "Active"}               → <Branch branch={!!x} true="Active" />
 * - Nested:       {a ? "x" : b ? "y" : "z"}    → <Branch branch={a} true="x"><Branch ...>...</Branch></Branch>
 */

import { TSESTree } from '@typescript-eslint/utils';
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint';
import {
  staticStringValue,
  isBranchableConditional,
  isBranchableLogicalAnd,
} from '../../utils/expression-utils.js';

const VALID_JSX_PROP_NAME = /^[a-zA-Z_$][a-zA-Z0-9_$-]*$/;

export type BranchInfo = {
  branchExpr: string;
  propName: string;
  swap: boolean;
};

/**
 * Extracts the branch variable and prop name from a ternary test expression.
 * For equality comparisons, uses the comparison value as the prop name.
 * For negation, flips the swap flag so consequent/alternate are swapped.
 */
export function extractBranchInfo(
  test: TSESTree.Expression,
  sourceCode: SourceCode
): BranchInfo {
  // !cond → unwrap negation, swap branches
  if (
    test.type === TSESTree.AST_NODE_TYPES.UnaryExpression &&
    test.operator === '!'
  ) {
    const inner = extractBranchInfo(test.argument, sourceCode);
    return { ...inner, swap: !inner.swap };
  }

  // x === "val" / "val" === x / x !== "val" / "val" !== x
  if (
    test.type === TSESTree.AST_NODE_TYPES.BinaryExpression &&
    (test.operator === '===' ||
      test.operator === '==' ||
      test.operator === '!==' ||
      test.operator === '!=')
  ) {
    const swap = test.operator === '!==' || test.operator === '!=';
    const sides: [TSESTree.Expression, TSESTree.Expression][] = [
      [test.left, test.right],
      [test.right, test.left],
    ];
    for (const [variable, literal] of sides) {
      if (
        literal.type === TSESTree.AST_NODE_TYPES.Literal &&
        literal.value != null
      ) {
        const propName = String(literal.value);
        if (VALID_JSX_PROP_NAME.test(propName)) {
          return {
            branchExpr: sourceCode.getText(variable),
            propName,
            swap,
          };
        }
      }
    }
  }

  return {
    branchExpr: sourceCode.getText(test),
    propName: 'true',
    swap: false,
  };
}

/**
 * Formats an expression as a JSX prop value string.
 * String values become "value", JSX/Branch become {<element/>}.
 */
export function formatAsPropValue(
  expr: TSESTree.Expression,
  branchTag: string,
  sourceCode: SourceCode
): string {
  const str = staticStringValue(expr);
  if (str !== null) return `"${str}"`;
  if (isBranchableConditional(expr))
    return `{${generateBranch(expr, branchTag, sourceCode)}}`;
  if (isBranchableLogicalAnd(expr))
    return `{${generateLogicalAnd(expr, branchTag, sourceCode)}}`;
  return `{${sourceCode.getText(expr)}}`;
}

/**
 * Formats an expression as JSX children text.
 * Strings become raw text, null returns null (self-closing tag),
 * JSX passes through, and dynamic expressions become {expr}.
 */
export function formatAsChildren(
  expr: TSESTree.Expression,
  branchTag: string,
  sourceCode: SourceCode
): string | null {
  if (expr.type === TSESTree.AST_NODE_TYPES.Literal && expr.value === null)
    return null;
  const str = staticStringValue(expr);
  if (str !== null) return str;
  if (
    expr.type === TSESTree.AST_NODE_TYPES.JSXElement ||
    expr.type === TSESTree.AST_NODE_TYPES.JSXFragment
  )
    return sourceCode.getText(expr);
  if (isBranchableConditional(expr))
    return generateBranch(expr, branchTag, sourceCode);
  if (isBranchableLogicalAnd(expr))
    return generateLogicalAnd(expr, branchTag, sourceCode);
  return `{${sourceCode.getText(expr)}}`;
}

/**
 * Generates <Branch branch={expr} propName=value>children</Branch> source text
 * from a ConditionalExpression. Recursively handles nested ternaries.
 */
export function generateBranch(
  expr: TSESTree.ConditionalExpression,
  branchTag: string,
  sourceCode: SourceCode
): string {
  const { branchExpr, propName, swap } = extractBranchInfo(
    expr.test,
    sourceCode
  );
  const consequent = swap ? expr.alternate : expr.consequent;
  const alternate = swap ? expr.consequent : expr.alternate;
  const propValue = formatAsPropValue(consequent, branchTag, sourceCode);
  const children = formatAsChildren(alternate, branchTag, sourceCode);
  if (children === null)
    return `<${branchTag} branch={${branchExpr}} ${propName}=${propValue} />`;
  return `<${branchTag} branch={${branchExpr}} ${propName}=${propValue}>${children}</${branchTag}>`;
}

/**
 * Generates <Branch branch={!!expr} true=value /> source text
 * from a LogicalExpression (&&).
 */
export function generateLogicalAnd(
  expr: TSESTree.LogicalExpression,
  branchTag: string,
  sourceCode: SourceCode
): string {
  const leftText = sourceCode.getText(expr.left);
  const propValue = formatAsPropValue(expr.right, branchTag, sourceCode);
  return `<${branchTag} branch={!!${leftText}} true=${propValue} />`;
}
