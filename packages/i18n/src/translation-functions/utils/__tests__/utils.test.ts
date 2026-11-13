import { afterEach, describe, expect, it } from 'vitest';
import { formatMessage } from '../formatMessage';
import { interpolateMessage } from '../interpolation/interpolateMessage';
import { isEncodedTranslationOptions } from '../isEncodedTranslationOptions';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';

describe('formatMessage', () => {
  afterEach(() => Reflect.deleteProperty(globalThis, '__generaltranslation'));

  it('uses the mapped language for custom locale plural rules', () => {
    initializeI18nConfig({
      defaultLocale: 'brand-arabic',
      locales: ['brand-arabic'],
      customMapping: { 'brand-arabic': { code: 'ar' } },
    });
    expect(
      formatMessage(
        '{count, plural, zero {zero} one {one} two {two} few {few} many {many} other {other}}',
        { count: '3' },
        'brand-arabic'
      )
    ).toBe('few');
  });
  it.each([
    ['2', 'exact'],
    ['02', 'exact'],
    ['2.5', '2.5 items'],
  ])(
    'formats numeric-string plural %j instead of returning raw ICU',
    (count, expected) => {
      expect(
        formatMessage(
          '{count, plural, =2 {exact} one {one item} other {# items}}',
          { count },
          'en-US'
        )
      ).toBe(expected);
    }
  );

  it('matches an exact selector by number for a string value', () => {
    expect(
      formatMessage(
        '{count, plural, =01 {one} other {# items}}',
        { count: '1' },
        'en-US'
      )
    ).toBe('one');
  });
});

describe('interpolateMessage', () => {
  it('formats missing translation fallback with the source locale', () => {
    expect(
      interpolateMessage({
        source: 'Value {n, number}',
        target: undefined,
        options: {
          $format: 'ICU',
          $locale: 'fr',
          n: 1234.5,
        },
        sourceLocale: 'en',
      })
    ).toBe('Value 1,234.5');
  });

  it('cuts an ICU message with the terminator of its locale, like a string', () => {
    const cut = ($format: 'ICU' | 'STRING') =>
      interpolateMessage({
        source: 'Hello world',
        target: 'Bonjour le monde',
        options: { $format, $locale: 'fr', $maxChars: 9 },
        sourceLocale: 'en',
      });
    expect(cut('ICU')).toBe('Bonjour\u202f…');
    expect(cut('ICU')).toBe(cut('STRING'));
  });
});

describe('isEncodedTranslationOptions', () => {
  it('accepts encoded empty source strings', () => {
    expect(isEncodedTranslationOptions({ $_hash: 'hash', $_source: '' })).toBe(
      true
    );
  });

  it('rejects non-string encoded fields', () => {
    expect(isEncodedTranslationOptions({ $_hash: {}, $_source: {} })).toBe(
      false
    );
  });
});
