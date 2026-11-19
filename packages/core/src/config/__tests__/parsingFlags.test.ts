import { describe, expect, it } from 'vitest';
import { resolveAutoderive } from '../parsingFlags';

describe('resolveAutoderive', () => {
  it.each([
    [true, { jsx: true }],
    [false, { jsx: false }],
    [undefined, { jsx: false }],
    [{ jsx: true }, { jsx: true }],
    [{ jsx: false }, { jsx: false }],
    [{}, { jsx: false }],
  ])('resolveAutoderive(%j) -> %j', (value, expected) => {
    expect(resolveAutoderive(value)).toEqual(expected);
  });
});
