import { describe, expect, it } from 'vitest';

import { _getPluralForm } from '../getPluralForm';
import type { PluralType } from '../../settings/plurals';

const form = (n: number, forms: PluralType[], locale: string) =>
  _getPluralForm(n, forms, [locale]);

describe('_getPluralForm fallbacks', () => {
  it.each([
    ['lv', 0, 'zero'],
    ['ar', 0, 'zero'],
    ['ar', 2, 'two'],
    ['ru', 3, 'few'],
    ['ru', 5, 'many'],
  ])('%s n=%i (category "%s") degrades to "other"', (locale, n) => {
    expect(form(n, ['one', 'other'], locale)).toBe('other');
  });

  it.each([
    ['en', 1],
    ['fr', 0],
  ])('%s n=%i (category "one") degrades to "other"', (locale, n) => {
    expect(form(n, ['other'], locale)).toBe('other');
  });

  it('degrades to the "plural" alias before "other"', () => {
    expect(form(0, ['singular', 'plural'], 'lv')).toBe('plural');
    expect(form(3, ['plural', 'other'], 'ru')).toBe('plural');
    // 5 is already en's "other" category, so the exact match wins.
    expect(form(5, ['plural', 'other'], 'en')).toBe('other');
  });

  it('prefers an exact category or an alias over the fallback', () => {
    expect(form(0, ['zero', 'other'], 'ar')).toBe('zero');
    expect(form(21, ['one', 'other'], 'ru')).toBe('one');
    expect(form(3, ['few', 'other'], 'ru')).toBe('few');
    // ru picks "one" at 21 and br picks "two" at 22. ar n=2 would hit the
    // magnitude override above instead of these two lines.
    expect(form(21, ['singular', 'plural'], 'ru')).toBe('singular');
    expect(form(22, ['dual', 'other'], 'br')).toBe('dual');
  });

  it('returns "" when there is no "plural" or "other" to fall back to', () => {
    expect(form(5, ['one'], 'en')).toBe('');
    expect(form(0, ['one'], 'lv')).toBe('');
  });
});
