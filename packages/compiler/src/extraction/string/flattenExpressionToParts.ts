import * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import {
  evaluateStringExpression,
  INVALID_TEMPLATE_ESCAPE_ERROR,
} from './evaluateStringExpression';
import type { ExtractionDiagnostic, StringExpressionNode } from '../types';

export type Part =
  | { type: 'static'; value: string }
  | { type: 'derive'; node: t.Expression }
  | { type: 'dynamic'; node: t.Expression };

export type FlattenExpressionError = {
  kind: 'invalid-template-escape' | 'invalid-expression';
  message: string;
};

type FlattenExpressionResult = {
  parts: Part[];
  errors: FlattenExpressionError[];
};

/**
 * Compiler-compatible expression flattening.
 *
 * This intentionally keeps conditionals and type assertions conservative so
 * existing compiler validation behavior stays stable while sharing the same
 * literal/template/concat walker used by the extraction API.
 */
export function flattenExpressionToParts(
  exprPath: NodePath<t.Expression>
): FlattenExpressionResult {
  const result = evaluateStringExpression(exprPath, {
    evaluateConditionals: false,
    unwrapExpressions: false,
  });

  if (result.diagnostics.length > 0 || !result.value) {
    return {
      parts: [],
      errors: result.diagnostics.map(toFlattenExpressionError),
    };
  }

  return {
    parts: stringNodeToParts(result.value),
    errors: [],
  };
}

function stringNodeToParts(node: StringExpressionNode): Part[] {
  switch (node.type) {
    case 'static':
      return [{ type: 'static', value: node.value }];
    case 'dynamic':
      return [{ type: 'dynamic', node: node.node }];
    case 'derive':
      return [{ type: 'derive', node: node.node }];
    case 'sequence':
      return node.nodes.flatMap(stringNodeToParts);
    case 'choice':
      return [{ type: 'dynamic', node: t.identifier('undefined') }];
  }
}

function toFlattenExpressionError(
  diagnostic: ExtractionDiagnostic
): FlattenExpressionError {
  if (diagnostic.code === 'invalid-template-escape') {
    return {
      kind: 'invalid-template-escape',
      message: INVALID_TEMPLATE_ESCAPE_ERROR,
    };
  }
  return {
    kind: 'invalid-expression',
    message: diagnostic.message,
  };
}
