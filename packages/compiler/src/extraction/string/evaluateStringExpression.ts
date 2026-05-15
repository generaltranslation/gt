import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { isDeriveInvocation } from '../../utils/parsing/isDeriveInvocation';
import type {
  ExtractionDiagnostic,
  ExtractionResult,
  StringExpressionNode,
} from '../types';

export type EvaluateStringExpressionOptions = {
  evaluateConditionals?: boolean;
  unwrapExpressions?: boolean;
};

export const INVALID_TEMPLATE_ESCAPE_ERROR =
  'Template literal contains an invalid escape sequence';

const INVALID_TEMPLATE_ESCAPE_DIAGNOSTIC: ExtractionDiagnostic = {
  level: 'error',
  code: 'invalid-template-escape',
  message: INVALID_TEMPLATE_ESCAPE_ERROR,
};

const INVALID_EXPRESSION_DIAGNOSTIC: ExtractionDiagnostic = {
  level: 'error',
  code: 'invalid-expression',
  message: 'Expression is not a valid expression',
};

export function evaluateStringExpression(
  exprPath: NodePath<t.Expression>,
  options: EvaluateStringExpressionOptions = {}
): ExtractionResult<StringExpressionNode> {
  const diagnostics: ExtractionDiagnostic[] = [];
  const value = evaluateExpression(exprPath, diagnostics, {
    evaluateConditionals: options.evaluateConditionals ?? true,
    unwrapExpressions: options.unwrapExpressions ?? true,
  });
  return {
    value,
    diagnostics,
    dependencies: [],
  };
}

function evaluateExpression(
  exprPath: NodePath<t.Expression>,
  diagnostics: ExtractionDiagnostic[],
  options: Required<EvaluateStringExpressionOptions>
): StringExpressionNode | null {
  const unwrapped = options.unwrapExpressions
    ? unwrapExpressionPath(exprPath)
    : exprPath;
  const expr = unwrapped.node;

  if (t.isStringLiteral(expr)) {
    return { type: 'static', value: expr.value };
  }

  if (t.isNumericLiteral(expr)) {
    return { type: 'static', value: String(expr.value) };
  }

  if (t.isBooleanLiteral(expr)) {
    return { type: 'static', value: String(expr.value) };
  }

  if (t.isNullLiteral(expr)) {
    return { type: 'static', value: 'null' };
  }

  if (t.isTemplateLiteral(expr)) {
    return evaluateTemplateLiteral(
      unwrapped as NodePath<t.TemplateLiteral>,
      diagnostics,
      options
    );
  }

  if (t.isBinaryExpression(expr) && expr.operator === '+') {
    const leftPath = unwrapped.get('left');
    const rightPath = unwrapped.get('right');
    if (!leftPath.isExpression() || !rightPath.isExpression()) {
      diagnostics.push(INVALID_EXPRESSION_DIAGNOSTIC);
      return null;
    }
    const left = evaluateExpression(leftPath, diagnostics, options);
    const right = evaluateExpression(rightPath, diagnostics, options);
    if (!left || !right) {
      return null;
    }
    return createSequence([left, right]);
  }

  if (t.isConditionalExpression(expr)) {
    if (!options.evaluateConditionals) {
      return { type: 'dynamic', node: expr };
    }

    const consequentPath = unwrapped.get('consequent');
    const alternatePath = unwrapped.get('alternate');
    if (!consequentPath.isExpression() || !alternatePath.isExpression()) {
      diagnostics.push(INVALID_EXPRESSION_DIAGNOSTIC);
      return null;
    }
    const consequent = evaluateExpression(consequentPath, diagnostics, options);
    const alternate = evaluateExpression(alternatePath, diagnostics, options);
    if (!consequent || !alternate) {
      return null;
    }
    return { type: 'choice', branches: [consequent, alternate] };
  }

  if (isDeriveInvocation(expr, unwrapped.scope)) {
    return { type: 'derive', node: expr };
  }

  return { type: 'dynamic', node: expr };
}

function evaluateTemplateLiteral(
  templatePath: NodePath<t.TemplateLiteral>,
  diagnostics: ExtractionDiagnostic[],
  options: Required<EvaluateStringExpressionOptions>
): StringExpressionNode | null {
  const template = templatePath.node;
  const nodes: StringExpressionNode[] = [];

  for (let index = 0; index < template.quasis.length; index++) {
    const cooked = template.quasis[index].value.cooked;
    if (cooked == null) {
      diagnostics.push(INVALID_TEMPLATE_ESCAPE_DIAGNOSTIC);
      return null;
    }
    if (cooked) {
      appendNode(nodes, { type: 'static', value: cooked });
    }

    if (index < template.expressions.length) {
      const expressionPath = templatePath.get('expressions')[index];
      if (!expressionPath.isExpression()) {
        diagnostics.push(INVALID_EXPRESSION_DIAGNOSTIC);
        return null;
      }
      const expressionNode = evaluateExpression(
        expressionPath,
        diagnostics,
        options
      );
      if (!expressionNode) {
        return null;
      }
      appendNode(nodes, expressionNode);
    }
  }

  return createSequence(nodes);
}

function createSequence(
  nodes: StringExpressionNode[]
): StringExpressionNode {
  const normalizedNodes: StringExpressionNode[] = [];
  for (const node of nodes) {
    if (node.type === 'sequence') {
      for (const child of node.nodes) {
        appendNode(normalizedNodes, child);
      }
    } else {
      appendNode(normalizedNodes, node);
    }
  }

  if (normalizedNodes.length === 0) {
    return { type: 'static', value: '' };
  }
  if (normalizedNodes.length === 1) {
    return normalizedNodes[0];
  }
  return { type: 'sequence', nodes: normalizedNodes };
}

function appendNode(
  nodes: StringExpressionNode[],
  nextNode: StringExpressionNode
): void {
  const lastNode = nodes[nodes.length - 1];
  if (lastNode?.type === 'static' && nextNode.type === 'static') {
    lastNode.value += nextNode.value;
    return;
  }
  nodes.push(nextNode);
}

function unwrapExpressionPath(
  exprPath: NodePath<t.Expression>
): NodePath<t.Expression> {
  let currentPath = exprPath;
  while (
    currentPath.isTSAsExpression() ||
    currentPath.isTSSatisfiesExpression() ||
    currentPath.isTSNonNullExpression() ||
    currentPath.isTSTypeAssertion() ||
    currentPath.isParenthesizedExpression()
  ) {
    const expressionPath = currentPath.get(
      'expression'
    ) as NodePath<t.Expression>;
    if (!expressionPath.isExpression()) {
      return currentPath;
    }
    currentPath = expressionPath;
  }
  return currentPath;
}
