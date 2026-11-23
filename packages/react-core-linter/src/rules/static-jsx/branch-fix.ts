/**
 * Select auto-fix: generates <Select> JSX from ternary/logical-AND expressions.
 *
 * Handles:
 * - Ternaries:    {cond ? "yes" : "no"}        → <Select value={cond} true="yes">no</Select>
 * - Equality:     {x === "a" ? "A" : "other"}  → <Select value={x} a="A">other</Select>
 * - Negation:     {!cond ? "no" : "yes"}        → <Select value={cond} true="yes">no</Select>
 * - Logical AND:  {x && "Active"}               → <Select value={!!x} true="Active">{null}</Select>
 * - Nested:       {a ? "x" : b ? "y" : "z"}    → <Select value={a} true="x"><Select ...>...</Select></Select>
 */

import { TSESTree } from '@typescript-eslint/utils';
import type { SourceCode } from '@typescript-eslint/utils/ts-eslint';
import {
  staticStringValue,
  isBranchableConditional,
  isBranchableLogicalAnd,
} from '../../utils/expression-utils.js';
import { SELECT_COMPONENT_VALUE_PROPERTY } from '../../utils/branching-utils.js';

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
        // Neither is a branch prop: `other` is the children, `value` the selector.
        if (
          propName !== 'other' &&
          propName !== SELECT_COMPONENT_VALUE_PROPERTY &&
          VALID_JSX_PROP_NAME.test(propName)
        ) {
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
 * String values become "value", JSX/Select become {<element/>}.
 */
export function formatAsPropValue(
  expr: TSESTree.Expression,
  branchTag: string,
  sourceCode: SourceCode
): string {
  const str = staticStringValue(expr);
  if (str !== null) {
    // A JSX attribute string cannot escape a quote, and decodes entities.
    if (str.includes('"') || /&[#\w]+;/.test(str))
      return `{${JSON.stringify(str)}}`;
    return `"${str}"`;
  }
  if (isBranchableConditional(expr))
    return `{${generateBranch(expr, branchTag, sourceCode)}}`;
  if (isBranchableLogicalAnd(expr))
    return `{${generateLogicalAnd(expr, branchTag, sourceCode)}}`;
  return `{${sourceCode.getText(expr)}}`;
}

// Text with no markup, entity or brace, and no whitespace JSX would trim or
// collapse: only spaces, and only inside.
const RAW_JSX_TEXT = /^[^\s{}<>&]( *[^\s{}<>&])*$/;

/**
 * Formats an expression as JSX children text.
 * A string becomes raw text when JSX reads that text back as the same
 * string, JSX passes through, and anything else, null included, is {expr}.
 */
export function formatAsChildren(
  expr: TSESTree.Expression,
  branchTag: string,
  sourceCode: SourceCode
): string {
  const str = staticStringValue(expr);
  if (str !== null)
    return RAW_JSX_TEXT.test(str) ? str : `{${JSON.stringify(str)}}`;
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
 * Generates <Select value={expr} propName=value>children</Select> source text
 * from a ConditionalExpression. When chained ternaries share the same branch
 * variable, collapses them into a single Select with multiple props:
 *   status === "a" ? "A" : status === "b" ? "B" : "other"
 *   → <Select value={status} a="A" b="B">other</Select>
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

  // Collect props by walking chained ternaries that share the same branchExpr
  const props: { name: string; value: string }[] = [
    {
      name: propName,
      value: formatAsPropValue(consequent, branchTag, sourceCode),
    },
  ];
  let tail: TSESTree.Expression = alternate;

  while (
    tail.type === TSESTree.AST_NODE_TYPES.ConditionalExpression &&
    isBranchableConditional(tail)
  ) {
    const innerInfo = extractBranchInfo(tail.test, sourceCode);
    if (innerInfo.branchExpr !== branchExpr) break;
    const innerConsequent = innerInfo.swap ? tail.alternate : tail.consequent;
    const innerAlternate = innerInfo.swap ? tail.consequent : tail.alternate;
    props.push({
      name: innerInfo.propName,
      value: formatAsPropValue(innerConsequent, branchTag, sourceCode),
    });
    tail = innerAlternate;
  }

  const propsStr = props.map((p) => `${p.name}=${p.value}`).join(' ');
  const children = formatAsChildren(tail, branchTag, sourceCode);
  return `<${branchTag} value={${branchExpr}} ${propsStr}>${children}</${branchTag}>`;
}

/**
 * Generates <Select value={!!expr} true=value>{null}</Select> source text
 * from a LogicalExpression (&&): a falsy value renders nothing.
 */
export function generateLogicalAnd(
  expr: TSESTree.LogicalExpression,
  branchTag: string,
  sourceCode: SourceCode
): string {
  const leftText = sourceCode.getText(expr.left);
  const propValue = formatAsPropValue(expr.right, branchTag, sourceCode);
  return `<${branchTag} value={!!${leftText}} true=${propValue}>{null}</${branchTag}>`;
}
