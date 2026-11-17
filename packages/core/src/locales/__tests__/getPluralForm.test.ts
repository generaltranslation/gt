import { describe, expect, it } from 'vitest';

import { getPluralForm } from '../getPluralForm';
import {
  getPluralBranchKey,
  isAcceptedPluralForm,
} from '../../settings/plurals';

const form = (n: number | bigint, forms: string[], locale: string) =>
  getPluralForm(n, forms, [locale]);

describe('getPluralForm', () => {
  it.each([
    ['lv', 0, 'zero'],
    ['ar', 0, 'zero'],
    ['ar', 2, 'two'],
    ['ru', 3, 'few'],
    ['ru', 5, 'many'],
    ['en', 1, 'one'],
  ])('%s n=%i picks the "%s" category', (locale, n, category) => {
    expect(form(n, [category, 'other'], locale)).toBe(category);
    expect(form(n, ['other'], locale)).toBe('other');
  });

  it('reads zero, one and two as categories, not as the numbers 0, 1 and 2', () => {
    expect(form(0, ['zero', 'other'], 'en')).toBe('other');
    expect(form(2, ['two', 'other'], 'en')).toBe('other');
    expect(form(21, ['one', 'other'], 'ru')).toBe('one');
    expect(form(1, ['one', 'other'], 'ja')).toBe('other');
  });

  it('does not take the absolute value', () => {
    expect(form(-1, ['=1', 'other'], 'en')).toBe('other');
    expect(form(-1, ['=-1', 'other'], 'en')).toBe('=-1');
  });

  it('rejects a bigint too large to have a category, as ICU does', () => {
    const count = 9007199254741001n;
    expect(() => form(count, ['one', 'few', 'many', 'other'], 'ru')).toThrow(
      RangeError
    );
    expect(form(count, [`=${count}`, 'one', 'other'], 'ru')).toBe(`=${count}`);
    expect(form(count, ['=0', 'other'], 'ru')).toBe('other');
  });

  it('prefers an exact key over the category', () => {
    expect(form(1, ['=1', 'one', 'other'], 'en')).toBe('=1');
    expect(form(0, ['=0', 'other'], 'en')).toBe('=0');
    expect(form(2n, ['=2', 'other'], 'en')).toBe('=2');
    expect(form(1n, ['one', 'other'], 'en')).toBe('one');
  });

  it('returns "" when no branch matches and there is no "other"', () => {
    expect(form(5, ['one'], 'en')).toBe('');
    expect(form(1, ['singular', 'plural'], 'en')).toBe('');
  });
});

describe('plural branch props', () => {
  it.each([
    ['one', true, 'one'],
    ['other', true, 'other'],
    ['_0', true, '=0'],
    ['_12', true, '=12'],
    ['_01', false, '_01'],
    ['_', false, '_'],
    ['singular', false, 'singular'],
    ['n', false, 'n'],
  ])('%s: accepted %s, stored as %s', (prop, accepted, key) => {
    expect(isAcceptedPluralForm(prop)).toBe(accepted);
    expect(getPluralBranchKey(prop)).toBe(key);
  });
});
