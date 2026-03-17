import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { deriveVariableName } from '../deriveVariableName';

describe('deriveVariableName', () => {
  it('returns the name for an Identifier', () => {
    expect(deriveVariableName(t.identifier('name'))).toBe('name');
  });

  it('returns the property name for a non-computed MemberExpression', () => {
    const node = t.memberExpression(
      t.identifier('user'),
      t.identifier('name')
    );
    expect(deriveVariableName(node)).toBe('name');
  });

  it('returns "expr" for a computed MemberExpression', () => {
    const node = t.memberExpression(
      t.identifier('user'),
      t.stringLiteral('name'),
      true // computed
    );
    expect(deriveVariableName(node)).toBe('expr');
  });

  it('returns "expr" for a CallExpression', () => {
    const node = t.callExpression(
      t.memberExpression(t.identifier('user'), t.identifier('getName')),
      []
    );
    expect(deriveVariableName(node)).toBe('expr');
  });

  it('returns "expr" for a BinaryExpression', () => {
    const node = t.binaryExpression(
      '+',
      t.identifier('a'),
      t.identifier('b')
    );
    expect(deriveVariableName(node)).toBe('expr');
  });

  it('returns "expr" for a TemplateLiteral', () => {
    const node = t.templateLiteral(
      [t.templateElement({ raw: 'hello', cooked: 'hello' }, true)],
      []
    );
    expect(deriveVariableName(node)).toBe('expr');
  });
});
