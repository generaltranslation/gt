import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatMessage } from '../formatMessage';
import { interpolateMessage } from '../interpolateMessage';
import { isEncodedTranslationOptions } from '../isEncodedTranslationOptions';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';

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

  it('formats the source with the source locale when the ICU translation is malformed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      interpolateMessage({
        source: 'Value {n, number}',
        target: 'Valeur {n, number',
        options: { $format: 'ICU', $locale: 'fr', n: 1234.5 },
        sourceLocale: 'en',
      })
    ).toBe('Value 1,234.5');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('keeps the translation when the source cannot be formatted either', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const render = ($maxChars?: number) =>
      interpolateMessage({
        source: 'Hello {name}',
        target: 'Bonjour {name}',
        options: { $format: 'ICU', $locale: 'fr', $maxChars },
        sourceLocale: 'en',
      });
    expect(render()).toBe('Bonjour {name}');
    expect(render(9)).toBe('Bonjour\u202f…');
    warn.mockRestore();
  });

  it('warns once when the source is the malformed text', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const entry = 'Value {n, number';
    expect(
      interpolateMessage({
        source: entry,
        target: entry,
        options: { $format: 'ICU', $locale: 'en', n: 1 },
        sourceLocale: 'en',
      })
    ).toBe(entry);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('fills the variables of an ICU message and leaves a string as it is', () => {
    const render = ($format: 'ICU' | 'STRING') =>
      interpolateMessage({
        source: 'Hello {name}',
        options: { $format, name: 'Ada' },
      });
    expect(render('ICU')).toBe('Hello Ada');
    expect(render('STRING')).toBe('Hello {name}');
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
