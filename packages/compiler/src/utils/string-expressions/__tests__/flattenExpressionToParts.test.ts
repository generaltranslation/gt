import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  flattenExpressionToParts,
  type Part,
} from '../flattenExpressionToParts';
import { buildTransformResult } from '../buildTransformationResult';
import { resolveStaticExpression } from '../resolveStaticExpression';
/**
 * Parse code and extract the first expression's NodePath, then run the callback.
 */
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

function expectFlattenedParts(code: string, expectedParts: Part[]) {
  withExpressionPath(code, (path) => {
    const { parts, errors } = flattenExpressionToParts(path);
    expect(errors).toEqual([]);
    expect(parts).toEqual(expectedParts);
  });
}

describe('flattenExpressionToParts', () => {
  it('flattens a string literal', () => {
    expectFlattenedParts('"hello"', [{ type: 'static', value: 'hello' }]);
  });

  it('flattens a numeric literal', () => {
    expectFlattenedParts('42', [{ type: 'static', value: '42' }]);
  });

  it('flattens a boolean literal', () => {
    expectFlattenedParts('true', [{ type: 'static', value: 'true' }]);
  });

  it('flattens null', () => {
    expectFlattenedParts('null', [{ type: 'static', value: 'null' }]);
  });

  it('flattens a plain template literal', () => {
    expectFlattenedParts('`hello`', [{ type: 'static', value: 'hello' }]);
  });

  it('flattens and merges adjacent static concatenation parts', () => {
    expectFlattenedParts('"A" + "B" + "C"', [{ type: 'static', value: 'ABC' }]);
  });

  it('does not merge static parts across dynamic parts', () => {
    withExpressionPath('"A" + name + "B"', (path) => {
      const { parts, errors } = flattenExpressionToParts(path);
      expect(errors).toEqual([]);
      expect(parts).toHaveLength(3);
      expect(parts[0]).toEqual({ type: 'static', value: 'A' });
      expect((parts[1] as Part).type).toBe('dynamic');
      expect(parts[2]).toEqual({ type: 'static', value: 'B' });
    });
  });

  it('flattens template with expression', () => {
    withExpressionPath('`A${name}B`', (path) => {
      const { parts, errors } = flattenExpressionToParts(path);
      expect(errors).toEqual([]);
      expect(parts).toHaveLength(3);
      expect(parts[0]).toEqual({ type: 'static', value: 'A' });
      expect((parts[1] as Part).type).toBe('dynamic');
      expect(parts[2]).toEqual({ type: 'static', value: 'B' });
    });
  });

  it('flattens an identifier as dynamic', () => {
    withExpressionPath('name', (path) => {
      const { parts, errors } = flattenExpressionToParts(path);
      expect(errors).toEqual([]);
      expect(parts).toHaveLength(1);
      expect((parts[0] as Part).type).toBe('dynamic');
    });
  });

  it('recognizes derive() as a derive part', () => {
    const code = `import { derive } from 'gt-react/browser';\nderive(fn())`;
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
    traverse(ast, {
      ExpressionStatement(path) {
        const expr = path.get('expression') as NodePath<t.Expression>;
        const { parts, errors } = flattenExpressionToParts(expr);
        expect(errors).toEqual([]);
        expect(parts).toHaveLength(1);
        expect((parts[0] as Part).type).toBe('derive');
        path.stop();
      },
    });
  });

  it('reports invalid escape sequences in template literals', () => {
    withTaggedTemplatePath('tag`\\xg`;', (path) => {
      const { parts, errors } = flattenExpressionToParts(path);
      expect(parts).toEqual([]);
      expect(errors).toEqual([
        'Template literal contains an invalid escape sequence',
      ]);
    });
  });

  it('reports invalid escape sequences once per template literal', () => {
    withTaggedTemplatePath('tag`\\xg${value}\\xh`;', (path) => {
      const { errors } = flattenExpressionToParts(path);
      expect(errors).toEqual([
        'Template literal contains an invalid escape sequence',
      ]);
    });
  });
});

describe('resolveStaticExpression', () => {
  it('resolves nested static string expressions', () => {
    withExpressionPath('"A" + `B ${"C"}`', (path) => {
      expect(resolveStaticExpression(path)).toEqual({
        errors: [],
        values: ['AB C'],
      });
    });
  });

  it('rejects dynamic expressions', () => {
    withExpressionPath('`Hello ${name}`', (path) => {
      expect(resolveStaticExpression(path)).toEqual({
        errors: ['Expression is not a static string'],
      });
    });
  });

  it('reports invalid escape sequences', () => {
    withTaggedTemplatePath('tag`\\xg`;', (path) => {
      expect(resolveStaticExpression(path)).toEqual({
        errors: ['Template literal contains an invalid escape sequence'],
      });
    });
  });
});

describe('buildTransformResult', () => {
  it('returns StringLiteral for all-static parts', () => {
    const parts = [{ type: 'static' as const, value: 'hello world' }];
    const { message, variables } = buildTransformResult(parts);
    expect(t.isStringLiteral(message)).toBe(true);
    expect((message as t.StringLiteral).value).toBe('hello world');
    expect(variables).toBeNull();
  });

  it('returns StringLiteral with placeholders for dynamic parts (no derive)', () => {
    const node = t.identifier('name');
    const parts = [
      { type: 'static' as const, value: 'Hello, ' },
      { type: 'dynamic' as const, node },
      { type: 'static' as const, value: '!' },
    ];
    const { message, variables } = buildTransformResult(parts);
    expect(t.isStringLiteral(message)).toBe(true);
    expect((message as t.StringLiteral).value).toBe('Hello, {0}!');
    expect(variables).not.toBeNull();
    expect(variables!.properties).toHaveLength(1);
  });

  it('preserves derive expressions in TemplateLiteral', () => {
    const deriveNode = t.callExpression(t.identifier('derive'), [
      t.callExpression(t.identifier('fn'), []),
    ]);
    const parts = [
      { type: 'static' as const, value: 'Hello ' },
      { type: 'derive' as const, node: deriveNode as t.Expression },
    ];
    const { message, variables } = buildTransformResult(parts);
    expect(t.isTemplateLiteral(message)).toBe(true);
    const tl = message as t.TemplateLiteral;
    expect(tl.expressions).toHaveLength(1);
    expect(tl.expressions[0]).toBe(deriveNode);
    expect(tl.quasis).toHaveLength(2);
    expect(tl.quasis[0].value.raw).toBe('Hello ');
    expect(tl.quasis[1].value.raw).toBe('');
    expect(variables).toBeNull();
  });
});
