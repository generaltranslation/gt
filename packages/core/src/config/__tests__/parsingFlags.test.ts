import { describe, expect, it } from 'vitest';
import { resolveAutoderive } from '../parsingFlags';

describe('resolveAutoderive', () => {
  it('true enables both jsx and strings', () => {
    expect(resolveAutoderive(true)).toEqual({ jsx: true, strings: true });
  });

  it('false disables both jsx and strings', () => {
    expect(resolveAutoderive(false)).toEqual({ jsx: false, strings: false });
  });

  it('{ jsx: true, strings: false } enables only jsx', () => {
    expect(resolveAutoderive({ jsx: true, strings: false })).toEqual({
      jsx: true,
      strings: false,
    });
  });

  it('{ jsx: false, strings: true } enables only strings', () => {
    expect(resolveAutoderive({ jsx: false, strings: true })).toEqual({
      jsx: false,
      strings: true,
    });
  });

  it('{ jsx: true } defaults strings to false', () => {
    expect(resolveAutoderive({ jsx: true })).toEqual({
      jsx: true,
      strings: false,
    });
  });

  it('{ strings: true } defaults jsx to false', () => {
    expect(resolveAutoderive({ strings: true })).toEqual({
      jsx: false,
      strings: true,
    });
  });

  it('{} defaults both to false', () => {
    expect(resolveAutoderive({})).toEqual({ jsx: false, strings: false });
  });
});
