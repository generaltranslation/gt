import { describe, expect, it } from 'vitest';
import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  evaluateStringExpression,
  INVALID_TEMPLATE_ESCAPE_ERROR,
  stringNodeToStaticValues,
  stringNodeToVariants,
} from '../index';

function withExpressionPath(
  code: string,
  callback: (path: NodePath<t.Expression>) => void
) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, {
    ExpressionStatement(path) {
      callback(path.get('expression') as NodePath<t.Expression>);
      path.stop();
    },
  });
}

function withTaggedTemplatePath(
  code: string,
  callback: (path: NodePath<t.TemplateLiteral>) => void
) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, {
    TaggedTemplateExpression(path) {
      callback(path.get('quasi') as NodePath<t.TemplateLiteral>);
      path.stop();
    },
  });
}

function expectStaticValues(code: string, expected: string[]) {
  withExpressionPath(code, (path) => {
    const result = evaluateStringExpression(path);
    expect(result.diagnostics).toEqual([]);
    expect(result.value).not.toBeNull();
    expect(stringNodeToStaticValues(result.value!)).toEqual(expected);
  });
}

describe('evaluateStringExpression', () => {
  it('evaluates static literals', () => {
    expectStaticValues('"hello"', ['hello']);
    expectStaticValues('42', ['42']);
    expectStaticValues('true', ['true']);
    expectStaticValues('null', ['null']);
  });

  it('evaluates template literals and concatenation', () => {
    expectStaticValues('`hello ${"world"}`', ['hello world']);
    expectStaticValues('"A" + `B ${"C"}`', ['AB C']);
  });

  it('evaluates conditional choices', () => {
    expectStaticValues('flag ? "A" : "B"', ['A', 'B']);
  });

  it('reports invalid template escapes', () => {
    withTaggedTemplatePath('tag`\\xg`;', (path) => {
      const result = evaluateStringExpression(path);
      expect(result.value).toBeNull();
      expect(result.diagnostics).toEqual([
        {
          level: 'error',
          code: 'invalid-template-escape',
          message: INVALID_TEMPLATE_ESCAPE_ERROR,
        },
      ]);
    });
  });

  it('returns undefined static values for dynamic identifiers', () => {
    withExpressionPath('`Hello ${name}`', (path) => {
      const result = evaluateStringExpression(path);
      expect(result.diagnostics).toEqual([]);
      expect(result.value).not.toBeNull();
      expect(stringNodeToStaticValues(result.value!)).toBeUndefined();
      expect(stringNodeToVariants(result.value!)).toEqual([]);
    });
  });

  it('recognizes derive calls', () => {
    const code = `import { derive } from 'gt-react/browser';\nderive(fn())`;
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
    traverse(ast, {
      ExpressionStatement(path) {
        const result = evaluateStringExpression(
          path.get('expression') as NodePath<t.Expression>
        );
        expect(result.diagnostics).toEqual([]);
        expect(result.value?.type).toBe('derive');
        expect(stringNodeToStaticValues(result.value!)).toBeUndefined();
        path.stop();
      },
    });
  });
});
