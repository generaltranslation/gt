import { describe, it, expect, vi } from 'vitest';
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
      children: 'Many items',
    });

    const result = getBranchComponentParameters(
      getObjectExpressionPath(expression),
      GT_COMPONENT_TYPES.Plural
    );

    const keys = result.map(([key]) => key);
    expect(keys).toEqual(['one', 'other']);
  });

  it('reads the children as the other branch', () => {
    const expression = makeObjectExpression({
      children: 'child content',
      morning: 'Good morning',
    });

    const result = getBranchComponentParameters(
      getObjectExpressionPath(expression),
      GT_COMPONENT_TYPES.Branch
    );

    const keys = result.map(([key]) => key);
    expect(keys).toEqual(['other', 'morning']);
  });

  it('warns about malformed exact numbers, which are not rendered', () => {
    const warn = vi.fn();
    const expression = makeObjectExpression({
      n: '5',
      _0: 'No items',
      _01: 'One item',
      _1e3: 'A thousand items',
      children: 'Many items',
    });

    const result = getBranchComponentParameters(
      getObjectExpressionPath(expression),
      GT_COMPONENT_TYPES.Plural,
      warn
    );

    expect(result.map(([key]) => key)).toEqual(['=0', 'other']);
    expect(warn.mock.calls.map(([diagnostic]) => diagnostic)).toEqual([
      'Ignored the _01 prop of <Plural> because it is not an exact number. Write the number without a leading zero or an exponent, as in _0 or _1000.',
      'Ignored the _1e3 prop of <Plural> because it is not an exact number. Write the number without a leading zero or an exponent, as in _0 or _1000.',
    ]);
  });

  it.each([GT_COMPONENT_TYPES.Plural, GT_COMPONENT_TYPES.Branch])(
    'fails an other prop on <%s>, whose fallback is its children',
    (component) => {
      const fail = vi.fn();
      const expression = makeObjectExpression({
        one: 'One item',
        other: 'Many items',
      });

      const result = getBranchComponentParameters(
        getObjectExpressionPath(expression),
        component,
        undefined,
        fail
      );

      expect(result.map(([key]) => key)).toEqual(['one']);
      expect(fail.mock.calls.map(([diagnostic]) => diagnostic)).toEqual([
        `<${component}> has no other prop. Write the fallback as its children.`,
      ]);
    }
  );
});
