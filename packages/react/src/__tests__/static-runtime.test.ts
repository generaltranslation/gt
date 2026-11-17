import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatStatic,
  initializeGTSPA,
  staticOr,
  staticValue,
} from '../static-runtime';
import { formatStaticIntl } from '../static-runtime-intl';

// Equivalence with gt-react's runtime is tested where the trees are compiled:
// packages/compiler/src/__tests__/staticRuntime.test.ts.

const DATE = new Date(Date.UTC(2024, 0, 15, 12, 30));

type IntlConstructor = 'PluralRules' | 'NumberFormat' | 'DateTimeFormat';

const originals = {
  PluralRules: Intl.PluralRules,
  NumberFormat: Intl.NumberFormat,
  DateTimeFormat: Intl.DateTimeFormat,
};

/** Counts how often an Intl object is built from here on. */
function countBuilt(name: IntlConstructor): () => number {
  let built = 0;
  const Original = originals[name] as new (...args: unknown[]) => object;
  Object.assign(Intl, {
    [name]: class extends Original {
      constructor(...args: unknown[]) {
        super(...args);
        built += 1;
      }
    },
  });
  return () => built;
}

describe('gt-react/static-runtime', () => {
  afterEach(() => {
    Object.assign(Intl, originals);
  });

  it('formats text, values, selects and plurals in the build locale', () => {
    expect(
      formatStatic(
        [
          ['name'],
          ' : ',
          [
            'count',
            'plural',
            { '=0': 'rien', one: [0, ' fichier'], other: [0, ' fichiers'] },
          ],
          ' (',
          ['role', 'select', { admin: 'admin', other: 'invité' }],
          ') le ',
          ['when'],
        ],
        { name: 'Ada', count: 1234.5, role: 'guest', when: DATE },
        'fr,en',
        0,
        '',
        '',
        'UTC'
      )
    ).toBe(
      `Ada : ${new Intl.NumberFormat('fr').format(1234.5)} fichiers (invité) le 15/01/2024 12:30`
    );
  });

  it('gives a template literal what a value prints as', () => {
    const expected = new Intl.DateTimeFormat(['fr-BE', 'en'], {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(DATE);
    const built = countBuilt('DateTimeFormat');
    const value = (input: unknown) => staticValue(input, 'fr-BE,en', 'UTC');
    const object = { toString: () => 'object' };
    expect(
      [null, undefined, 'text', 0, false, 12n, object].map((input) =>
        value(input)
      )
    ).toEqual(['', '', 'text', 0, false, 12n, object]);
    expect(built()).toBe(0);
    expect(`Le ${value(DATE)}`).toBe(`Le ${expected}`);
    expect(value(DATE)).toBe(expected);
    expect(built()).toBe(1);
  });

  it('builds each Intl object once for every call site of a build', () => {
    const pluralRules = countBuilt('PluralRules');
    const numberFormat = countBuilt('NumberFormat');
    const tree = [
      ['count', 'plural', { one: [0, ' item'], other: [0, ' items'] }],
    ] as const;
    for (let call = 0; call < 3; call++) {
      expect(formatStatic(tree, { count: 2 }, 'en-AU')).toBe('2 items');
    }
    expect(pluralRules()).toBe(1);
    expect(numberFormat()).toBe(1);
  });

  it('formats a plural of a small count from what the build found out, without Intl', () => {
    const built = (
      ['PluralRules', 'NumberFormat', 'DateTimeFormat'] as const
    ).map(countBuilt);
    // fr-CH: every integer below 1,000 is its digits; 0 and 1 are `one`
    const format = (values: Record<string, unknown>) =>
      formatStatic(tree, values, 'fr-CH,en', 1, 'oo|x');
    const tree = [
      ['count', 'plural', { one: [0, ' élément'], other: [0, ' éléments'] }],
      ', ',
      ['role', 'select', { admin: 'admin', other: 'invité' }],
    ] as const;
    expect(
      [0, 1, 2, 999, '7', 12n].map((count) => format({ count, role: 'admin' }))
    ).toEqual([
      '0 élément, admin',
      '1 élément, admin',
      '2 éléments, admin',
      '999 éléments, admin',
      '7 éléments, admin',
      '12 éléments, admin',
    ]);
    expect(built.map((count) => count())).toEqual([0, 0, 0]);

    // A count the build did not look at goes to Intl
    expect(format({ count: 1000, role: 'x' })).toBe(
      `${new originals.NumberFormat(['fr-CH', 'en']).format(1000)} éléments, invité`
    );
    expect(format({ count: 1.5, role: 'x' })).toBe(
      `${new originals.NumberFormat(['fr-CH', 'en']).format(1.5)} élément, invité`
    );
    expect(format({ count: -1, role: 'x' })).toBe(
      `${new originals.NumberFormat(['fr-CH', 'en']).format(-1)} élément, invité`
    );
    expect(built.map((count) => count())).toEqual([1, 1, 0]);
  });

  it('builds no Intl object for text and plain values', () => {
    const built = (
      ['PluralRules', 'NumberFormat', 'DateTimeFormat'] as const
    ).map(countBuilt);
    expect(formatStatic(['Hallo ', ['name'], '!'], { name: 'Ada' }, 'de')).toBe(
      'Hallo Ada!'
    );
    expect(built.map((count) => count())).toEqual([0, 0, 0]);
  });

  it('formats numbers, dates and times through the intl entry', () => {
    expect(
      formatStaticIntl(
        [['total', 'number', 'currency'], ' le ', ['due', 'date', 'long']],
        { total: 1234.5, due: DATE },
        'fr,en',
        { total: { currency: 'EUR' } },
        'UTC'
      )
    ).toBe(
      `${new Intl.NumberFormat('fr', { style: 'currency', currency: 'EUR' }).format(1234.5)} le 15 janvier 2024`
    );
  });

  it('joins the parts of a message as the runtime does', () => {
    const object = { valueOf: () => 42, toString: () => 'text' };
    const inBranch = [
      ['kind', 'select', { other: ['by ', ['value']] }],
    ] as const;
    // An object prints as its text, in a branch too
    expect(formatStatic(inBranch, { kind: 'x', value: object }, 'en')).toBe(
      'by text'
    );
    // A value that is the whole message is printed by itself
    expect(formatStatic([['value']], { value: ['a', 'b'] }, 'en')).toBe('ab');
    expect(formatStatic([['value']], { value: Symbol('s') }, 'en')).toBe(
      'Symbol(s)'
    );
    expect(
      formatStatic(['(', ['value'], ')'], { value: ['a', 'b'] }, 'en')
    ).toBe('(a,b)');
    expect(() =>
      formatStatic(['(', ['value'], ')'], { value: Symbol('s') }, 'en')
    ).toThrow(TypeError);
  });

  it('formats the source of a translation that throws', () => {
    const translation = [
      ['count', 'plural', { one: 'un', other: 'plusieurs' }],
    ] as const;
    const format = (count: unknown) =>
      staticOr(
        { count },
        (values) => formatStatic(translation, values, 'fr,en'),
        (values) => `source ${values.count}`
      );
    expect(format(1)).toBe('un');
    expect(format(2n ** 70n)).toBe(`source ${2n ** 70n}`);
  });

  it('resolves initializeGTSPA() without loading anything', async () => {
    const loadTranslations = vi.fn();
    await expect(
      initializeGTSPA({ defaultLocale: 'en', loadTranslations })
    ).resolves.toBeUndefined();
    expect(loadTranslations).not.toHaveBeenCalled();
  });

  it('publishes an entry that imports nothing', () => {
    for (const extension of ['mjs', 'cjs']) {
      const code = readFileSync(
        fileURLToPath(
          new URL(`../../dist/static-runtime.${extension}`, import.meta.url)
        ),
        'utf8'
      );
      expect(code).not.toMatch(/^import\b|\brequire\(/m);
    }
  });
});
