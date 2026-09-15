import { afterEach, describe, expect, it } from 'vitest';
import { formatMessage } from '../formatMessage';
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
    ['02', '2 items'],
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

  it('preserves raw exact selector matching for string-only interpolation values', () => {
    expect(
      formatMessage(
        '{count, plural, =1 {canonical} =01 {leading} other {# items}}',
        { count: '01' },
        'en-US'
      )
    ).toBe('leading');
  });

  it('formats inherited variables instead of returning raw ICU', () => {
    const variables = Object.create({ name: 'Ada' }) as Record<string, string>;

    expect(formatMessage('Hello {name}', variables, 'en-US')).toBe('Hello Ada');
  });
});
