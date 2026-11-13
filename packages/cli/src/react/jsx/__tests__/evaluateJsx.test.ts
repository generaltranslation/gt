import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import {
  isMeaningful,
  isStaticExpression,
  isStaticValue,
  isValidIcu,
} from '../evaluateJsx.js';

const expression = (code: string) =>
  parseExpression(code, {
    plugins: ['jsx', 'typescript'],
    createParenthesizedExpressions: true,
  });

/** The first child of <div>{children}</div>. */
const jsxChild = (children: string) =>
  (expression(`<div>${children}</div>`) as t.JSXElement).children[0];

describe('isValidIcu', () => {
  it('preserves FormatJS acceptance for a style with a brace', () => {
    expect(isValidIcu('{n, number, foo{bar}baz}')).toEqual({ isValid: true });
  });

  // ICU rejects a token that is not its own, and Intl cannot format some.
  it.each([
    '{n, number, ::integer-width/x*00}',
    '{n, number, ::currency}',
    '{n, number, ::permille}',
  ])('rejects the number skeleton of %j', (message) => {
    expect(isValidIcu(message).isValid).toBe(false);
  });
});

describe('isMeaningful', () => {
  it.each([
    ["'Hello world'", true],
    ["'  Hello  '", true],
    ["'   \\n\\t   '", false],
    ["''", false],
    ['`Hello world`', true],
    ['`   \n\t   `', false],
    ['`Hello ${name}!`', false],
    ["'Hello' + '   '", true],
    ["'   ' + 'world'", true],
    ["'   ' + '\\t\\n'", false],
    ["'Hello' - 'world'", false],
    ['variable', false],
    ['42', false],
    ['true', false],
  ])('expression %s -> %s', (code, expected) => {
    expect(isMeaningful(expression(code))).toBe(expected);
  });

  it.each([
    ['Hello world', true],
    ['123', true],
    ['   \n\t   ', false],
    ["{'Hello world'}", true],
    ['{`Hello world`}', true],
    ["{'   '}", false],
    ['{variable}', false],
  ])('JSX child %j -> %s', (children, expected) => {
    expect(isMeaningful(jsxChild(children))).toBe(expected);
  });
});

describe('isStaticExpression', () => {
  it.each([
    ["'Hello world'", 'Hello world'],
    ["''", ''],
    ['`Hello world`', 'Hello world'],
    ["('Hello world')", 'Hello world'],
    ["(('Hello'))", 'Hello'],
    ['42', '42'],
    ['3.14', '3.14'],
    ['0', '0'],
    ['true', 'true'],
    ['false', 'false'],
    ['null', 'null'],
  ])('%s is static with value %j', (code, value) => {
    expect(isStaticExpression(expression(code))).toEqual({
      isStatic: true,
      value,
    });
  });

  it.each([
    '`Hello ${name}!`',
    "'Hello ' + 'world'",
    "'Number: ' + 42",
    "'Hello' - 'world'",
    'variable',
    'func()',
    '({})',
  ])('%s is not static', (code) => {
    expect(isStaticExpression(expression(code))).toEqual({ isStatic: false });
  });

  it('treats an empty JSX expression as a static empty string', () => {
    const container = jsxChild('{}') as t.JSXExpressionContainer;

    expect(isStaticExpression(container.expression)).toEqual({
      isStatic: true,
      value: '',
    });
  });
});

describe('isStaticValue', () => {
  it.each([
    ["'Hello world'", true],
    ["''", true],
    ['42', true],
    ['0', true],
    ['`Hello world`', true],
    ['`Hello ${name}!`', true],
    ['true', false],
    ['null', false],
    ['variable', false],
    ["'Hello' + 'world'", false],
    ['func()', false],
  ])('%s -> %s', (code, expected) => {
    expect(isStaticValue(expression(code))).toBe(expected);
  });
});
