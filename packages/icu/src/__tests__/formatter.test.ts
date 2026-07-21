/**
 * Compatibility cases are adapted from the FormatJS intl-messageformat suite:
 * https://github.com/formatjs/formatjs/blob/75edf1cd6a7045475bb134daf62c686602c92547/packages/intl-messageformat/tests/index.test.ts
 * intl-messageformat is BSD-3-Clause licensed. See ../../THIRD_PARTY_NOTICES.md.
 */

import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { formatMessage } from '../index';

describe('formatMessage', () => {
  it('interpolates direct arguments without dropping zero', () => {
    expect(
      formatMessage('Hi {name}, count: {count}', 'en', {
        name: 'Ada',
        count: 0,
      })
    ).toBe('Hi Ada, count: 0');
  });

  it.each([
    [false, ''],
    [null, ''],
    [undefined, ''],
    [true, true],
    [0n, ''],
    [123n, 123n],
  ])('formats direct argument %s', (value, expected) => {
    expect(formatMessage('{value}', 'en', { value })).toBe(expected);
  });

  it('exposes the formatter parts return type honestly', () => {
    expectTypeOf(formatMessage('{value}', 'en', { value: true })).toBeUnknown();
  });

  it('preserves non-string values as parts like intl-messageformat', () => {
    const date = new Date(0);
    expect(
      formatMessage('before {value} after', 'en', { value: true })
    ).toEqual(['before ', true, ' after']);
    expect(
      formatMessage('before {value} after', 'en', { value: date })
    ).toEqual(['before ', date, ' after']);
    expect(formatMessage('{value}', 'en', { value: date })).toBe(date);
  });

  it('requires every referenced variable', () => {
    expect(() => formatMessage('Hello {name}', 'en')).toThrow(
      'variable "name" was not provided'
    );
  });

  it('does not require the ES2022 Object.hasOwn API', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Object, 'hasOwn');
    Object.defineProperty(Object, 'hasOwn', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(
        formatMessage('{kind, select, yes {Hi {name}} other {No}}', 'en', {
          kind: 'yes',
          name: 'Ada',
        })
      ).toBe('Hi Ada');
    } finally {
      if (descriptor) {
        Object.defineProperty(Object, 'hasOwn', descriptor);
      } else {
        Reflect.deleteProperty(Object, 'hasOwn');
      }
    }
  });

  it('selects exact and fallback branches without prototype collisions', () => {
    const message =
      '{value, select, constructor {ctor} __proto__ {proto} toString {string} other {fallback}}';
    expect(formatMessage(message, 'en', { value: 'constructor' })).toBe('ctor');
    expect(formatMessage(message, 'en', { value: '__proto__' })).toBe('proto');
    expect(formatMessage(message, 'en', { value: 'toString' })).toBe('string');
    expect(formatMessage(message, 'en', { value: 'missing' })).toBe('fallback');
  });

  it.each([
    ['ar', 0, 'zero'],
    ['ar', 1, 'one'],
    ['ar', 2, 'two'],
    ['ar', 4, 'few'],
    ['ar', 15, 'many'],
    ['ar', 100, 'other'],
  ])('uses %s cardinal plural rules for %d', (locale, count, expected) => {
    const message =
      '{count, plural, zero {zero} one {one} two {two} few {few} many {many} other {other}}';
    expect(formatMessage(message, locale, { count })).toBe(expected);
  });

  it('prefers exact plural matches and applies offsets to rules and pound', () => {
    const message =
      '{count, plural, offset:1 =0 {Nobody came} =1 {Only Ada came} one {Ada and one other} other {Ada and # others}}';
    expect(formatMessage(message, 'en', { count: 0 })).toBe('Nobody came');
    expect(formatMessage(message, 'en', { count: 1 })).toBe('Only Ada came');
    expect(formatMessage(message, 'en', { count: 2 })).toBe(
      'Ada and one other'
    );
    expect(formatMessage(message, 'en', { count: 5 })).toBe('Ada and 4 others');
  });

  it.each([
    [1, 'canonical'],
    ['1', 'canonical'],
    ['01', 'leading'],
    ['+1', 'positive'],
    [0, 'zero'],
    ['0', 'zero'],
    ['-0', 'negative zero'],
    ['-01', 'negative leading'],
  ])(
    'preserves raw exact plural selector matching for %j',
    (count, expected) => {
      const message =
        '{count, plural, =1 {canonical} =01 {leading} =+1 {positive} =0 {zero} =-0 {negative zero} =-01 {negative leading} other {other}}';

      expect(formatMessage(message, 'en', { count })).toBe(expected);
    }
  );

  it.each([
    ['2', '{count, plural, =2 {exact} other {# items}}', 'exact'],
    ['02', '{count, plural, =2 {exact} other {# items}}', '2 items'],
    [' 2 ', '{count, plural, =2 {exact} other {# items}}', '2 items'],
    ['1', '{count, plural, one {one item} other {# items}}', 'one item'],
    ['2.5', '{count, plural, one {one item} other {# items}}', '2.5 items'],
    ['', '{count, plural, one {one item} other {# items}}', '0 items'],
    [
      'not-a-number',
      '{count, plural, one {one item} other {# items}}',
      'NaN items',
    ],
  ])(
    'coerces plural string %j while preserving raw exact matching',
    (count, message, expected) => {
      expect(formatMessage(message, 'en', { count })).toBe(expected);
    }
  );

  it('uses ordinal plural rules', () => {
    const message =
      '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
    expect(
      [1, 2, 3, 4, 11, 21].map((place) =>
        formatMessage(message, 'en', { place })
      )
    ).toEqual(['1st', '2nd', '3rd', '4th', '11th', '21st']);
  });

  it('preserves a plural value through tags but not nested selects', () => {
    const bold = ([value]: string[]) => `<b>${value}</b>`;
    expect(
      formatMessage('{count, plural, other {<b># items</b>}}', 'en', {
        count: 3,
        b: bold,
      })
    ).toBe('<b>3 items</b>');
    expect(
      formatMessage(
        '{count, plural, other {{kind, select, a {# items} other {none}}}}',
        'en',
        { count: 3, kind: 'a' }
      )
    ).toBe('# items');
  });

  it('flattens nested rich-text tag arrays without adding separators', () => {
    expect(
      formatMessage('hello <b>world<i>!</i> <br/> </b>', 'en', {
        b: (chunks: string[]) => ['<b>', ...chunks, '</b>'],
        i: (chunks: string[]) => `$$${chunks}$$`,
      })
    ).toBe('hello <b>world$$!$$ <br/> </b>');
  });

  it('formats named number styles', () => {
    expect(formatMessage('{n, number}', 'en-US', { n: 123456.78 })).toBe(
      new Intl.NumberFormat('en-US').format(123456.78)
    );
    expect(
      formatMessage('{n, number, integer}', 'en-US', { n: 123456.78 })
    ).toBe('123,457');
    expect(formatMessage('{n, number, percent}', 'en-US', { n: 0.56 })).toBe(
      '56%'
    );
  });

  it('preserves unscaled numeric-string precision', () => {
    const value = '123456789012345678901234567890';
    const expected = '123,456,789,012,345,678,901,234,567,890';

    expect(formatMessage('{n, number}', 'en-US', { n: value })).toBe(expected);
    expect(formatMessage('{n, number, ::scale/0}', 'en-US', { n: value })).toBe(
      expected
    );
  });

  it('formats number skeleton precision, grouping, currency, and scale', () => {
    expect(
      formatMessage('{n, number, ::currency/CAD .0 group-off}', 'en-US', {
        n: 123456.78,
      })
    ).toMatch(/\$123456\.8/u);
    expect(
      formatMessage('{n, number, ::currency/GBP .0#}', 'en-US', {
        n: 123456.789,
      })
    ).toBe('£123,456.79');
    expect(
      formatMessage('{n, number, ::percent scale/0.01}', 'en-US', { n: 12.3 })
    ).toBe('12%');
    expect(formatMessage('{n, number, ::scale/0}', 'en-US', { n: 12.34 })).toBe(
      '12.34'
    );
  });

  it('formats minimum integer-width skeletons', () => {
    expect(
      formatMessage('{n, number, ::integer-width/*000}', 'en', { n: 7 })
    ).toBe('007');
  });

  it.each([
    ['000', 'exact integer digits'],
    ['##00', 'maximum integer digits'],
  ])('matches FormatJS rejection of integer-width/%s', (width, error) => {
    expect(() =>
      formatMessage(`{n, number, ::integer-width/${width}}`, 'en', { n: 7 })
    ).toThrow(error);
  });

  it('supports bigint number and plural formatting', () => {
    expect(
      formatMessage('Total: {total, number, ::currency/USD}', 'en-US', {
        total: 12345678901234567890n,
      })
    ).toContain('$12,345,678,901,234,567,890.00');
    expect(
      formatMessage('{count, plural, one {one} other {many}}', 'en', {
        count: 2n,
      })
    ).toBe('many');
    expect(() =>
      formatMessage('{value, number, ::scale/1.5}', 'en', { value: 2n })
    ).toThrow('Cannot apply fractional scale');
  });

  it('rejects unsafe bigint plural selection instead of losing precision', () => {
    const count = 1000000000000000001n;
    expect(
      formatMessage('{count, plural, other {# items}}', 'ru', { count })
    ).toBe(`${new Intl.NumberFormat('ru').format(count)} items`);

    expect(() =>
      formatMessage(
        '{count, plural, one {one} few {few} many {many} other {other}}',
        'ru',
        { count }
      )
    ).toThrow('outside the safe integer range');
  });

  it('formats date and time named styles', () => {
    const value = new Date('2020-05-06T14:03:02Z');
    expect(formatMessage('{d, date, full}', 'en-US', { d: value })).toBe(
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(value)
    );
    expect(formatMessage('{d, time, short}', 'en-US', { d: value })).toBe(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
      }).format(value)
    );
  });

  it('formats date and locale-aware hour skeletons', () => {
    const value = new Date('2020-05-06T14:03:02Z');
    expect(formatMessage('{d, date, ::yyyyMMMdd}', 'en-US', { d: value })).toBe(
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(value)
    );
    expect(formatMessage('{d, time, ::jjmmss}', 'de-DE', { d: value })).toBe(
      new Intl.DateTimeFormat('de-DE', {
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(value)
    );
  });

  it.each(['C', 'S', 'A'])(
    'preserves FormatJS handling of the %s date/time skeleton field',
    (field) => {
      const value = new Date('2020-05-06T14:03:02Z');
      expect(
        formatMessage(`{d, time, ::${field}}`, 'en-US', { d: value })
      ).toBe(new Intl.DateTimeFormat('en-US').format(value));
    }
  );

  it('reuses equivalent Intl formatters within one message', () => {
    const originalNumberFormat = Intl.NumberFormat;
    const originalDateTimeFormat = Intl.DateTimeFormat;
    const originalPluralRules = Intl.PluralRules;
    const numberFormat = vi.fn();
    const dateTimeFormat = vi.fn();
    const pluralRules = vi.fn();

    Object.defineProperties(Intl, {
      NumberFormat: {
        value: new Proxy(originalNumberFormat, {
          construct(target, args) {
            numberFormat();
            return Reflect.construct(target, args);
          },
        }),
      },
      DateTimeFormat: {
        value: new Proxy(originalDateTimeFormat, {
          construct(target, args) {
            dateTimeFormat();
            return Reflect.construct(target, args);
          },
        }),
      },
      PluralRules: {
        value: new Proxy(originalPluralRules, {
          construct(target, args) {
            pluralRules();
            return Reflect.construct(target, args);
          },
        }),
      },
    });

    try {
      const value = new Date('2020-05-06T14:03:02Z');
      formatMessage(
        '{n, number} {n, number} {d, date, short} {d, date, short} ' +
          '{n, plural, one {# item} other {# items}} ' +
          '{n, plural, one {# item} other {# items}}',
        'en-US',
        { n: 2, d: value }
      );

      expect(numberFormat).toHaveBeenCalledTimes(1);
      expect(dateTimeFormat).toHaveBeenCalledTimes(1);
      expect(pluralRules).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperties(Intl, {
        NumberFormat: { value: originalNumberFormat },
        DateTimeFormat: { value: originalDateTimeFormat },
        PluralRules: { value: originalPluralRules },
      });
    }
  });

  it('applies ICU apostrophe escaping', () => {
    expect(formatMessage("This '{isn''t}' obvious", 'en')).toBe(
      "This {isn't} obvious"
    );
    expect(formatMessage("'{name}'", 'en', { name: 'ignored' })).toBe('{name}');
  });
});
