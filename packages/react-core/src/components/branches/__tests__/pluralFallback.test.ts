import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { renderPlural } from '../Plural.shared';
import { GtInternalBranch } from '../Branch';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };
function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const conditions = { _locale: 'en', _enableI18n: true };

beforeEach(() => {
  resetGTGlobals();
  // Both the locales list and _enableI18n matter here. Without them
  // getFormatLocales() returns [defaultLocale], the rows below run English
  // rules instead of Latvian and Arabic ones, and they still pass.
  initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'ar', 'lv'] });
});
afterEach(() => {
  resetGTGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('plural branch selection', () => {
  it.each([
    ['lv', 0],
    ['ar', 0],
  ])('%s n=%i falls back to the children', (locale, n) => {
    expect(
      renderPlural({
        n,
        _locale: locale,
        _enableI18n: true,
        one: '1 item',
        children: 'N items',
      })
    ).toBe('N items');
  });

  it.each([
    [0, 'No items'],
    [1, 'Exactly one'],
    [1n, 'Exactly one'],
    [21, 'N items'],
  ])('n=%s picks an exact branch before a category', (n, expected) => {
    expect(
      renderPlural({
        ...conditions,
        n,
        _0: 'No items',
        _1: 'Exactly one',
        one: '1 item',
        children: 'N items',
      })
    ).toBe(expected);
  });

  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, 'nth'],
    [22, '2nd'],
  ])('ordinal n=%i picks the ordinal category', (n, expected) => {
    const places = { one: '1st', two: '2nd', few: '3rd', children: 'nth' };
    expect(renderPlural({ ...conditions, n, ordinal: true, ...places })).toBe(
      expected
    );
    expect(renderPlural({ ...conditions, n, ...places })).toBe(
      n === 1 ? '1st' : 'nth'
    );
  });

  it('reads zero as a plural category, which English does not have', () => {
    expect(
      renderPlural({
        ...conditions,
        n: 0,
        zero: 'No items',
        children: 'N items',
      })
    ).toBe('N items');
  });

  it('logs and renders the children in production when n is not a number', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      renderPlural({
        ...conditions,
        n: '3' as unknown as number,
        one: '1 item',
        children: 'N items',
      })
    ).toBe('N items');
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('<Plural> needs a number or a bigint for n')
    );
  });

  it('throws in development when n is not a number', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(() =>
      renderPlural({
        ...conditions,
        n: '3' as unknown as number,
        children: 'N items',
      })
    ).toThrow('<Plural> needs a number or a bigint for n');
  });

  it('reports a number with no branch', () => {
    const untyped = { ...conditions, n: 5, one: '1 item' } as Parameters<
      typeof renderPlural
    >[0];
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(renderPlural(untyped)).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('<Plural> has no branch for n')
    );
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => renderPlural(untyped)).toThrow('<Plural> has no branch for n');
  });
});

describe('branch selection', () => {
  it.each([
    ['admin', 'Admin'],
    ['guest', 'Someone'],
    [true, 'Yes'],
    [0, 'Zero'],
    ['data-id', 'Someone'],
    ['toString', 'Someone'],
  ])('branch=%s renders %s', (branch, expected) => {
    expect(
      GtInternalBranch({
        branch,
        admin: 'Admin',
        true: 'Yes',
        0: 'Zero',
        'data-id': 'injected',
        children: 'Someone',
      })
    ).toBe(expected);
  });

  it('reports a value with no branch', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      GtInternalBranch({ branch: 'guest', admin: 'Admin' })
    ).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('<Branch> has no branch for its value')
    );
    expect(
      GtInternalBranch({ branch: 'data-id', 'data-id': 'injected' })
    ).toBeUndefined();
    expect(error).toHaveBeenLastCalledWith(
      expect.stringContaining('branch: data-id')
    );
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => GtInternalBranch({ branch: 'guest', admin: 'Admin' })).toThrow(
      '<Branch> has no branch for its value'
    );
  });
});
