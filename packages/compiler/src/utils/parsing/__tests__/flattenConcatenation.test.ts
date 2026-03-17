import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { flattenConcatenation } from '../flattenConcatenation';

describe('flattenConcatenation', () => {
  it('flattens "a" + "b" into two StringLiterals', () => {
    const node = t.binaryExpression(
      '+',
      t.stringLiteral('a'),
      t.stringLiteral('b')
    );
    const result = flattenConcatenation(node);
    expect(result).toHaveLength(2);
    expect((result[0] as t.StringLiteral).value).toBe('a');
    expect((result[1] as t.StringLiteral).value).toBe('b');
  });

  it('flattens "a" + b + "c" + d into 4 elements in correct order', () => {
    // Left-recursive: (("a" + b) + "c") + d
    const node = t.binaryExpression(
      '+',
      t.binaryExpression(
        '+',
        t.binaryExpression('+', t.stringLiteral('a'), t.identifier('b')),
        t.stringLiteral('c')
      ),
      t.identifier('d')
    );
    const result = flattenConcatenation(node);
    expect(result).toHaveLength(4);
    expect((result[0] as t.StringLiteral).value).toBe('a');
    expect((result[1] as t.Identifier).name).toBe('b');
    expect((result[2] as t.StringLiteral).value).toBe('c');
    expect((result[3] as t.Identifier).name).toBe('d');
  });

  it('flattens a deeply nested left-recursive tree correctly', () => {
    // ((("a" + "b") + "c") + "d") + "e"
    let node: t.Expression = t.stringLiteral('a');
    for (const val of ['b', 'c', 'd', 'e']) {
      node = t.binaryExpression('+', node, t.stringLiteral(val));
    }
    const result = flattenConcatenation(node);
    expect(result).toHaveLength(5);
    expect(result.map((r) => (r as t.StringLiteral).value)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('does NOT flatten a non-+ BinaryExpression', () => {
    const node = t.binaryExpression(
      '-',
      t.numericLiteral(1),
      t.numericLiteral(2)
    );
    const result = flattenConcatenation(node);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(node);
  });

  it('returns a single element for a non-BinaryExpression', () => {
    const node = t.identifier('x');
    const result = flattenConcatenation(node);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(node);
  });
});
