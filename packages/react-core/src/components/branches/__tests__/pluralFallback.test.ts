import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { renderPlural } from '../Plural.shared';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };
function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('plural branch fallbacks', () => {
  beforeEach(() => {
    resetGTGlobals();
    // Both the locales list and _enableI18n matter here. Without them
    // getFormatLocales() returns [defaultLocale], the rows below run English
    // rules instead of Latvian and Arabic ones, and they still pass.
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'ar', 'lv'] });
  });
  afterEach(resetGTGlobals);

  it.each([
    ['lv', 0],
    ['ar', 0],
  ])('%s n=%i falls back to the other branch', (locale, n) => {
    expect(
      renderPlural({
        n,
        _locale: locale,
        _enableI18n: true,
        one: '1 item',
        other: 'N items',
      })
    ).toBe('N items');
  });

  // two, few and many have always preferred the branch over children.
  // zero and one now behave the same way.
  it('prefers a generic branch over children', () => {
    expect(
      renderPlural({
        n: 1,
        _locale: 'en',
        _enableI18n: true,
        other: 'N items',
        children: '1 item',
      })
    ).toBe('N items');
  });

  it('still falls through to children when no branch can match', () => {
    expect(
      renderPlural({
        n: 5,
        _locale: 'en',
        _enableI18n: true,
        one: '1 item',
        children: 'N items',
      })
    ).toBe('N items');
  });
});
