import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { renderPlural } from '../Plural.shared';
import { GtInternalSelect } from '../Select';

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
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'ar', 'cy', 'lv'],
  });
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

  it('picks English ordinal branches', () => {
    const place = (n: number, exact = {}) =>
      renderPlural(
        {
          ...conditions,
          n,
          ...exact,
          one: `${n}st`,
          two: `${n}nd`,
          few: `${n}rd`,
          children: `${n}th`,
        },
        true
      );
    expect(
      [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map((n) => place(n))
    ).toEqual(
      '1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 101st 111th'.split(' ')
    );
    expect([1, 2, 21].map((n) => place(n, { _1: 'Winner' }))).toEqual([
      'Winner',
      '2nd',
      '21st',
    ]);
    // English cardinals have one and other.
    expect(
      renderPlural({ ...conditions, n: 2, two: '2nd', children: '2th' })
    ).toBe('2th');
  });

  it.each([
    [0, 'zero'],
    [1, 'one'],
    [2, 'two'],
    [3, 'few'],
    [4, 'few'],
    [5, 'many'],
    [6, 'many'],
    [7, 'zero'],
    [10, 'other'],
  ])('cy ordinal n=%i is %s', (n, category) => {
    expect(
      renderPlural(
        {
          n,
          _locale: 'cy',
          _enableI18n: true,
          zero: 'zero',
          one: 'one',
          two: 'two',
          few: 'few',
          many: 'many',
          children: 'other',
        },
        true
      )
    ).toBe(category);
  });

  it('names <Ordinal> when it reports n', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const untyped = { ...conditions, n: '3', children: 'nth' } as unknown;
    expect(() =>
      renderPlural(untyped as Parameters<typeof renderPlural>[0], true)
    ).toThrow('<Ordinal> needs a number or a bigint for n');
  });

  // The host has at most one of these as its own locale, so the others fail
  // if the plural is left to the host's rules.
  it.each(['ar', 'pl', 'ja'])(
    'a locale Intl has no data for picks by the rules of the default locale %s',
    (defaultLocale) => {
      resetGTGlobals();
      initializeI18nConfig({ defaultLocale, locales: [defaultLocale, 'qaa'] });
      const counts = [0, 1, 2, 5, 21];
      expect(
        counts.map((n) =>
          renderPlural({
            n,
            _locale: 'qaa',
            _enableI18n: true,
            zero: 'zero',
            one: 'one',
            two: 'two',
            few: 'few',
            many: 'many',
            children: 'other',
          })
        )
      ).toEqual(
        counts.map((n) => new Intl.PluralRules(defaultLocale).select(n))
      );
    }
  );

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
  ])('value=%s renders %s', (value, expected) => {
    expect(
      GtInternalSelect({
        value,
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
      GtInternalSelect({ value: 'guest', admin: 'Admin' })
    ).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('<Select> has no branch for its value')
    );
    expect(
      GtInternalSelect({ value: 'data-id', 'data-id': 'injected' })
    ).toBeUndefined();
    expect(error).toHaveBeenLastCalledWith(
      expect.stringContaining('value: data-id')
    );
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => GtInternalSelect({ value: 'guest', admin: 'Admin' })).toThrow(
      '<Select> has no branch for its value'
    );
  });
});
