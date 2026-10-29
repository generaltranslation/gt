import { describe, expect, it } from 'vitest';
import { formatAst, TYPE } from '../index';
import { formatMessage, parse } from '../parser';

describe('formatAst', () => {
  it('matches formatMessage for a localized currency', () => {
    const message = '{n, number, ::currency/EUR}';
    expect(formatAst(parse(message), 'de', { n: 1234.5 })).toEqual(
      formatMessage(message, 'de', { n: 1234.5 })
    );
  });

  it('defaults to the library locale and empty variables', () => {
    expect(formatAst([{ type: TYPE.literal, value: 'Hi' }])).toBe('Hi');
    expect(formatAst([])).toBe('');
  });

  it('validates locales like formatMessage instead of using the host locale', () => {
    const ast = [{ type: TYPE.literal, value: 'Hi' } as const];
    const errorOf = (format: () => unknown): unknown => {
      try {
        format();
      } catch (error) {
        return error;
      }
      throw new Error('expected an invalid-locale error');
    };
    for (const locales of [[], 'not a locale!', ['en', 'x!']]) {
      expect(errorOf(() => formatAst(ast, locales))).toEqual(
        errorOf(() => formatMessage('Hi', locales))
      );
    }
    expect(() => formatAst(ast, [])).toThrow(TypeError);
    expect(() => formatAst(ast, 'not a locale!')).toThrow(RangeError);
  });
});
