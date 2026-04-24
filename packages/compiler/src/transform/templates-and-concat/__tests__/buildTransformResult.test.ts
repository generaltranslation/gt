import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { buildTransformResult } from '../buildTransformationResult';

describe('buildTransformResult', () => {
  it('returns StringLiteral for all-static parts', () => {
    const parts = [{ type: 'static' as const, content: 'hello world' }];
    const { message, variables } = buildTransformResult(parts);
    expect(t.isStringLiteral(message)).toBe(true);
    expect((message as t.StringLiteral).value).toBe('hello world');
    expect(variables).toBeNull();
  });

  it('returns StringLiteral with placeholders for dynamic parts (no derive)', () => {
    const node = t.identifier('name');
    const parts = [
      { type: 'static' as const, content: 'Hello, ' },
      { type: 'dynamic' as const, content: node as t.Expression },
      { type: 'static' as const, content: '!' },
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
      { type: 'static' as const, content: 'Hello ' },
      { type: 'derive' as const, content: deriveNode as t.Expression },
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
