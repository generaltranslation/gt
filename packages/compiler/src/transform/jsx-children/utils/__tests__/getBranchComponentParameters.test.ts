import { describe, it, expect } from 'vitest';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { getBranchComponentParameters } from '../getBranchComponentParameters';
import { GT_COMPONENT_TYPES } from '../../../../utils/constants/gt/constants';

function makeObjectExpression(
  props: Record<string, string>
): t.ObjectExpression {
  const properties = Object.entries(props).map(([key, value]) =>
    t.objectProperty(t.stringLiteral(key), t.stringLiteral(value))
  );
  return t.objectExpression(properties);
}

function getObjectExpressionPath(
  expression: t.ObjectExpression
): NodePath<t.ObjectExpression> {
  const ast = t.file(t.program([t.expressionStatement(expression)]));
  let expressionPath: NodePath<t.ObjectExpression> | undefined;

  traverse(ast, {
    ObjectExpression(path) {
      if (path.node === expression) {
        expressionPath = path;
        path.stop();
      }
    },
  });

  if (!expressionPath) {
    throw new Error('Expected object expression path');
  }

  return expressionPath;
}

describe('getBranchComponentParameters', () => {
  it('should filter out branch and data-* attributes for Branch components', () => {
    const expression = makeObjectExpression({
      'data-testid': 'my-test',
      'data-track': 'click',
      branch: 'someBranch',
      morning: 'Good morning',
      evening: 'Good evening',
    });

    const result = getBranchComponentParameters(
      getObjectExpressionPath(expression),
      GT_COMPONENT_TYPES.Branch
    );

    const keys = result.map(([key]) => key);
    expect(keys).toEqual(['morning', 'evening']);
    expect(result.every(([, valuePath]) => valuePath.isExpression())).toBe(
      true
    );
  });

  it('should filter data-* attributes for Plural components', () => {
    const expression = makeObjectExpression({
      'data-testid': 'my-test',
      'data-track': 'click',
      n: '5',
      one: 'One item',
      other: 'Many items',
    });

    const result = getBranchComponentParameters(
      getObjectExpressionPath(expression),
      GT_COMPONENT_TYPES.Plural
    );

    const keys = result.map(([key]) => key);
    expect(keys).toEqual(['one', 'other']);
  });

  it('should filter out children for any component type', () => {
    const expression = makeObjectExpression({
      children: 'child content',
      morning: 'Good morning',
    });

    const result = getBranchComponentParameters(
      getObjectExpressionPath(expression),
      GT_COMPONENT_TYPES.Branch
    );

    const keys = result.map(([key]) => key);
    expect(keys).toEqual(['morning']);
  });
});
