import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createStaticFormatter,
  createStaticValue,
  initializeGTSPA,
} from '../static-runtime';
import { createStaticIntlFormatter } from '../static-runtime-intl';

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
    const format = createStaticFormatter(['fr', 'en'], 'UTC');
    expect(
      format(
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
        { name: 'Ada', count: 1234.5, role: 'guest', when: DATE }
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
    const value = createStaticValue(['fr-BE', 'en'], 'UTC');
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

  it('builds each Intl object once for every module of a build', () => {
    const pluralRules = countBuilt('PluralRules');
    const numberFormat = countBuilt('NumberFormat');
    const tree = [
      ['count', 'plural', { one: [0, ' item'], other: [0, ' items'] }],
    ] as const;
    const first = createStaticFormatter(['en-AU']);
    const second = createStaticFormatter(['en-AU']);
    expect(pluralRules()).toBe(0);

    for (const format of [first, second, first]) {
      expect(format(tree, { count: 2 })).toBe('2 items');
    }
    expect(pluralRules()).toBe(1);
    expect(numberFormat()).toBe(1);
  });

  it('builds no Intl object for text and plain values', () => {
    const built = (
      ['PluralRules', 'NumberFormat', 'DateTimeFormat'] as const
    ).map(countBuilt);
    const format = createStaticFormatter(['de']);
    expect(format(['Hallo ', ['name'], '!'], { name: 'Ada' })).toBe(
      'Hallo Ada!'
    );
    expect(built.map((count) => count())).toEqual([0, 0, 0]);
  });

  it('formats numbers, dates and times through the intl entry', () => {
    const format = createStaticIntlFormatter(['fr', 'en'], 'UTC');
    expect(
      format(
        [['total', 'number', 'currency'], ' le ', ['due', 'date', 'long']],
        { total: 1234.5, due: DATE },
        { total: { currency: 'EUR' } }
      )
    ).toBe(
      `${new Intl.NumberFormat('fr', { style: 'currency', currency: 'EUR' }).format(1234.5)} le 15 janvier 2024`
    );
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
