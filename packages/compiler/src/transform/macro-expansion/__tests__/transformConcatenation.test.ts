import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { transformConcatenation } from '../transformConcatenation';

describe('transformConcatenation', () => {
  it('transforms "Hello, " + name', () => {
    const node = t.binaryExpression(
      '+',
      t.stringLiteral('Hello, '),
      t.identifier('name')
    );
    const { message, variables } = transformConcatenation(node);
    expect(message.value).toBe('Hello, {0}');
    expect(variables).not.toBeNull();
    expect(variables!.properties).toHaveLength(1);
    const prop = variables!.properties[0] as t.ObjectProperty;
    expect((prop.key as t.StringLiteral).value).toBe('0');
  });

  it('transforms "a" + b + "c" + d', () => {
    const node = t.binaryExpression(
      '+',
      t.binaryExpression(
        '+',
        t.binaryExpression('+', t.stringLiteral('a'), t.identifier('b')),
        t.stringLiteral('c')
      ),
      t.identifier('d')
    );
    const { message, variables } = transformConcatenation(node);
    expect(message.value).toBe('a{0}c{1}');
    expect(variables!.properties).toHaveLength(2);
  });

  it('returns null variables when all operands are string literals', () => {
    const node = t.binaryExpression(
      '+',
      t.stringLiteral('a'),
      t.stringLiteral('bc')
    );
    const { message, variables } = transformConcatenation(node);
    expect(message.value).toBe('abc');
    expect(variables).toBeNull();
  });

  it('handles single variable with no strings', () => {
    const node = t.binaryExpression(
      '+',
      t.identifier('x'),
      t.stringLiteral('')
    );
    const { message, variables } = transformConcatenation(node);
    expect(message.value).toBe('{0}');
    expect(variables!.properties).toHaveLength(1);
  });

  it('only increments variable index for non-string-literal operands', () => {
    // "a" + b + "c" + d + "e"
    const node = t.binaryExpression(
      '+',
      t.binaryExpression(
        '+',
        t.binaryExpression(
          '+',
          t.binaryExpression('+', t.stringLiteral('a'), t.identifier('b')),
          t.stringLiteral('c')
        ),
        t.identifier('d')
      ),
      t.stringLiteral('e')
    );
    const { message, variables } = transformConcatenation(node);
    expect(message.value).toBe('a{0}c{1}e');
    expect(variables!.properties).toHaveLength(2);
    const prop0 = variables!.properties[0] as t.ObjectProperty;
    const prop1 = variables!.properties[1] as t.ObjectProperty;
    expect((prop0.key as t.StringLiteral).value).toBe('0');
    expect((prop1.key as t.StringLiteral).value).toBe('1');
  });
});
