import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { computeCurrency } from '../Currency.shared';
import { computeDateTime } from '../DateTime.shared';
import { computeNum } from '../Num.shared';
import { computeRelativeTime } from '../RelativeTime.shared';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

// Formatting needs no credentials: the config has no apiKey or projectId.
const props = { _enableI18n: true, _locale: 'brand-french' };
const date = new Date(Date.UTC(2024, 2, 14, 12));

describe('variable formatting with a custom locale alias', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'brand-french'],
      customMapping: { 'brand-french': { code: 'fr', name: 'Brand French' } },
    });
  });
  afterEach(resetGTGlobals);

  it('formats numbers in the canonical locale', () => {
    expect(computeNum({ ...props, children: 1234.5 })).toBe(
      new Intl.NumberFormat(['fr', 'en']).format(1234.5)
    );
  });

  it('formats currency in the canonical locale', () => {
    expect(
      computeCurrency({ ...props, children: '1234.5', currency: 'EUR' })
    ).toBe(
      new Intl.NumberFormat(['fr', 'en'], {
        style: 'currency',
        currency: 'EUR',
      }).format(1234.5)
    );
  });

  it('formats dates in the canonical locale', () => {
    const options = { dateStyle: 'long', timeZone: 'UTC' } as const;
    expect(computeDateTime({ ...props, children: date, options })).toBe(
      new Intl.DateTimeFormat(['fr', 'en'], options).format(date)
    );
  });

  it('formats relative times in the canonical locale', () => {
    expect(computeRelativeTime({ ...props, value: -1, unit: 'day' })).toBe(
      new Intl.RelativeTimeFormat(['fr', 'en']).format(-1, 'day')
    );
    expect(
      computeRelativeTime({
        ...props,
        date: new Date(date.getTime() - 2 * 3_600_000),
        baseDate: date,
      })
    ).toBe(new Intl.RelativeTimeFormat(['fr', 'en']).format(-2, 'hour'));
  });

  it('uses the default locale when translation is off', () => {
    expect(
      computeNum({ _enableI18n: false, _locale: 'brand-french', children: 1.5 })
    ).toBe(new Intl.NumberFormat('en').format(1.5));
  });
});
