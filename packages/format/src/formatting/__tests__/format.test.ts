import { describe, it, expect } from 'vitest';
import {
  formatCutoff,
  formatDateTime,
  formatMessage as publicFormatMessage,
  formatRelativeTimeFromDate,
} from '../../core';
import { intlCache } from '../../cache/IntlCache';
import {
  _formatListToParts,
  _formatRelativeTime,
  _selectRelativeTimeUnit,
} from '../format';
import type { FormatVariables } from '../../types';

// The host's zone, so a formatted date compares with what Intl gives.
const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;

// formatMessage with positional arguments, as these cases are written.
const formatIcuString = (
  message: string,
  locales: string | string[],
  variables: FormatVariables,
  zone: string
) => publicFormatMessage(message, { locales, variables, timeZone: zone });

describe('formatMessage with ICU strings', () => {
  it.each([
    ['plain text', {}, 'plain text'],
    ['Hello {name}', { name: 'Ada' }, 'Hello Ada'],
    ['Zero: {value}', { value: 0 }, 'Zero: 0'],
    ['False: {value}', { value: false }, 'False: false'],
    ['True: {value}!', { value: true }, 'True: true!'],
    ['Null: {value}', { value: null }, 'Null: '],
    [
      '{kind, select, constructor {ctor} __proto__ {proto} other {fallback}}',
      { kind: 'constructor' },
      'ctor',
    ],
    [
      '{kind, select, constructor {ctor} __proto__ {proto} other {fallback}}',
      { kind: '__proto__' },
      'proto',
    ],
    [
      '{kind, select, constructor {ctor} __proto__ {proto} other {fallback}}',
      { kind: 'missing' },
      'fallback',
    ],
    [
      '{count, plural, =0 {none} one {# item} other {# items}}',
      { count: 0 },
      'none',
    ],
    [
      '{count, plural, =0 {none} one {# item} other {# items}}',
      { count: 1 },
      '1 item',
    ],
    [
      '{count, plural, =0 {none} one {# item} other {# items}}',
      { count: 12 },
      '12 items',
    ],
    [
      '{count, plural, offset:1 =0 {none} one {one guest} other {# guests}}',
      { count: 5 },
      '4 guests',
    ],
    [
      '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
      { place: 22 },
      '22nd',
    ],
    [
      '{outer, select, yes {{count, plural, one {one} other {#}}} other {no}}',
      { outer: 'yes', count: 4 },
      '4',
    ],
    ["This '{isn''t}' ICU", {}, "This {isn't} ICU"],
  ])(
    'formats %j through the public format boundary',
    (message, variables, expected) => {
      expect(formatIcuString(message, 'en-US', variables, timeZone)).toBe(
        expected
      );
    }
  );

  it('passes number skeletons through the package boundary', () => {
    expect(
      formatIcuString(
        '{value, number, ::currency/USD .00}',
        'en-US',
        {
          value: 1234.5,
        },
        timeZone
      )
    ).toBe('$1,234.50');
    expect(
      formatIcuString(
        '{value, number, ::scale/0.5}',
        'en-US',
        {
          value: 12.34,
        },
        timeZone
      )
    ).toBe('6.17');
  });

  // ICU4C rejects each of these, or formats what Intl cannot. FormatJS reads
  // them as best it can.
  it.each([
    '{value, number, ::constructor}',
    '{value, number, ::__proto__}',
    '{value, number, ::integer-width/*}',
    '{value, number, ::integer-width/x*00}',
    '{value, number, ::.00/xyzr}',
    '{value, number, ::currency}',
    '{value, number, foo{bar}baz}',
    '{value, time, ::C}',
    '{value, time, ::A}',
    '{value, time, ::Jj}',
  ])('rejects %j through the public boundary', (message) => {
    expect(() =>
      formatIcuString(message, 'en-US', { value: 1 }, timeZone)
    ).toThrow();
  });

  it('preserves numeric-string precision through the public boundary', () => {
    expect(
      publicFormatMessage('{value, number}', {
        timeZone,
        locales: 'en-US',
        variables: { value: '123456789012345678901234567890' },
      })
    ).toBe('123,456,789,012,345,678,901,234,567,890');
  });

  it('reads own variables only through the public boundary', () => {
    expect(() =>
      publicFormatMessage('Hello {name}', {
        timeZone,
        locales: 'en',
        variables: Object.create({ name: 'Ada' }),
      })
    ).toThrow('The ICU message variable "name" was not provided.');
  });

  it.each([
    ['00A0', '\u00A0'],
    ['1680', '\u1680'],
    ['2000', '\u2000'],
    ['2007', '\u2007'],
    ['202F', '\u202F'],
    ['205F', '\u205F'],
    ['3000', '\u3000'],
  ])(
    'reads Unicode space U+%s as part of a style name, which is then unknown',
    (_codePoint, space) => {
      expect(() =>
        publicFormatMessage(`{n, number, ${space}percent}`, {
          timeZone,
          locales: 'en-US',
          variables: { n: 2 },
        })
      ).toThrow('is not an ICU style name');
    }
  );

  it('passes date skeletons through the package boundary', () => {
    const value = new Date('2020-05-06T14:03:02Z');
    expect(
      formatIcuString(
        '{value, date, ::yyyyMMMdd}',
        'en-US',
        { value },
        timeZone
      )
    ).toBe(
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(value)
    );
  });

  it.each([['de-DE', 'hj', '14 Uhr']])(
    'preserves FormatJS hour skeleton %s ::%s through the public boundary',
    (locale, skeleton, expected) => {
      const value = new Date(2020, 4, 6, 14, 3, 2);
      expect(
        publicFormatMessage(`{value, time, ::${skeleton}}`, {
          timeZone,
          locales: locale,
          variables: { value },
        })
      ).toBe(expected);
    }
  );

  it('preserves regional hour cycles', () => {
    const value = new Date(2020, 4, 6, 7, 3, 2);
    expect(
      publicFormatMessage('{value, time, ::j}', {
        timeZone,
        locales: 'en-u-rg-gbzzzz',
        variables: { value },
      })
    ).toBe('07');

    expect(() =>
      publicFormatMessage('{value, time, ::j}', {
        timeZone,
        locales: [],
        variables: { value },
      })
    ).toThrow();
  });

  it('preserves locale arrays through the package boundary', () => {
    expect(
      formatIcuString(
        '{value, number}',
        ['de-DE', 'en-US'],
        {
          value: 1234.5,
        },
        timeZone
      )
    ).toBe(new Intl.NumberFormat('de-DE').format(1234.5));
  });

  it('still surfaces missing-variable failures through the package boundary', () => {
    expect(() =>
      formatIcuString('Hello {name}', 'en-US', {}, timeZone)
    ).toThrow('variable "name" was not provided');
  });

  it('keeps a syntax error’s code and place through the public boundary', () => {
    expect.assertions(3);
    try {
      publicFormatMessage('{name', {
        variables: {},
        timeZone,
        locales: 'en-US',
      });
    } catch (error) {
      const syntaxError = error as SyntaxError & {
        code?: string;
        location?: unknown;
        originalMessage?: string;
      };
      expect(syntaxError.code).toBe('EXPECT_ARGUMENT_CLOSING_BRACE');
      expect(syntaxError.location).toEqual({
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 5, line: 1, column: 6 },
      });
      expect(syntaxError.originalMessage).toBe('{name');
    }
  });

  it.each([
    ['2', 'exact'],
    ['02', 'exact'],
    ['2.5', '2.5 items'],
  ])(
    'coerces numeric-string plural %j through the public package',
    (count, expected) => {
      expect(
        publicFormatMessage(
          '{count, plural, =2 {exact} one {one item} other {# items}}',
          { timeZone, locales: 'en-US', variables: { count } }
        )
      ).toBe(expected);
    }
  );

  it.each([
    [1, 'one'],
    ['1', 'one'],
    ['01', 'one'],
    [2, 'other'],
  ])(
    'matches an exact selector by number through the public package for %j',
    (count, expected) => {
      expect(
        publicFormatMessage('{count, plural, =01 {one} other {other}}', {
          timeZone,
          locales: 'en-US',
          variables: { count },
        })
      ).toBe(expected);
    }
  );

  it('formats a boolean as text, and a Date as a short date and time', () => {
    expect(
      publicFormatMessage('before {value} after', {
        locales: 'en-US',
        timeZone,
        variables: { value: true },
      })
    ).toBe('before true after');
    expect(
      publicFormatMessage('before {value} after', {
        locales: 'en-US',
        timeZone: 'Asia/Tokyo',
        variables: { value: new Date(0) },
      })
    ).toBe('before 1/1/70, 9:00 AM after');
  });
});

describe('_formatListToParts', () => {
  it.each<[string, string[], string[], Intl.ListFormatOptions, string[]]>([
    ['an empty list', [], ['en'], {}, []],
    ['a single item', ['apple'], ['en'], {}, ['apple']],
    [
      'two items',
      ['apple', 'banana'],
      ['en'],
      {},
      ['apple', ' and ', 'banana'],
    ],
    [
      'three items',
      ['apple', 'banana', 'orange'],
      ['en'],
      {},
      ['apple', ', ', 'banana', ', and ', 'orange'],
    ],
    [
      'a disjunction',
      ['red', 'green', 'blue'],
      ['en'],
      { type: 'disjunction' },
      ['red', ', ', 'green', ', or ', 'blue'],
    ],
    [
      'units',
      ['1 km', '2 mi', '3 ft'],
      ['en'],
      { type: 'unit' },
      ['1 km', ', ', '2 mi', ', ', '3 ft'],
    ],
    [
      'the short style',
      ['first', 'second', 'third'],
      ['en'],
      { style: 'short' },
      ['first', ', ', 'second', ', & ', 'third'],
    ],
    [
      'the narrow style',
      ['A', 'B', 'C'],
      ['en'],
      { style: 'narrow' },
      ['A', ', ', 'B', ', ', 'C'],
    ],
    [
      'a short disjunction',
      ['a', 'b', 'c'],
      ['en'],
      { type: 'disjunction', style: 'short' },
      ['a', ', ', 'b', ', or ', 'c'],
    ],
    [
      'Spanish',
      ['manzana', 'plátano', 'naranja'],
      ['es'],
      {},
      ['manzana', ', ', 'plátano', ' y ', 'naranja'],
    ],
    [
      'French',
      ['pomme', 'banane', 'orange'],
      ['fr'],
      {},
      ['pomme', ', ', 'banane', ' et ', 'orange'],
    ],
    [
      'the first of several locales',
      ['item1', 'item2', 'item3'],
      ['es-ES', 'en-US'],
      {},
      ['item1', ', ', 'item2', ' y ', 'item3'],
    ],
  ])('formats %s', (_label, value, locales, options, expected) => {
    expect(_formatListToParts({ value, locales, options })).toEqual(expected);
  });

  it('preserves the identity and order of non-string items', () => {
    const object = { name: 'object' };
    const date = new Date('2023-01-01');
    const fn = () => 'hello';
    const value = ['string', 42, object, true, null, undefined, date, fn, 0];

    const result = _formatListToParts({ value, locales: ['en'], options: {} });

    expect(result).toHaveLength(value.length * 2 - 1);
    result.forEach((part, index) => {
      if (index % 2 === 0) expect(part).toBe(value[index / 2]);
      else expect(part).toBe(index === result.length - 2 ? ', and ' : ', ');
    });
  });
});

describe('_selectRelativeTimeUnit', () => {
  const baseDate = new Date('2026-06-15T12:00:00Z');
  const second = 1000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;

  it.each<[string, number, number, Intl.RelativeTimeFormatUnit]>([
    ['the same instant', 0, 0, 'second'],
    ['under a minute', -30 * second, -30, 'second'],
    ['under an hour', -5 * minute, -5, 'minute'],
    ['under a day', -3 * hour, -3, 'hour'],
    ['a future date', 3 * hour, 3, 'hour'],
    ['under a week', -5 * day, -5, 'day'],
    // Floors rather than rounding 3.5 days up to 4 days or a week.
    ['a partial day', -3.5 * day, -3, 'day'],
    ['exactly a week', -7 * day, -1, 'week'],
    ['under four weeks', -14 * day, -2, 'week'],
    // 28-29 days floor to 0 months, so they stay in weeks.
    ['28 days', -28 * day, -4, 'week'],
    ['29 days', -29 * day, -4, 'week'],
    ['30 days', -30 * day, -1, 'month'],
    ['under a year', -60 * day, -2, 'month'],
    // 360-364 days floor to 0 years, so they stay in months.
    ['362 days', -362 * day, -12, 'month'],
    ['over a year', -400 * day, -1, 'year'],
  ])('selects the unit for %s', (_label, offset, value, unit) => {
    const date = new Date(baseDate.getTime() + offset);
    expect(_selectRelativeTimeUnit(date, baseDate)).toEqual({ value, unit });
  });

  it.each([
    [-2 * hour, '2 hours ago'],
    [3 * day, 'in 3 days'],
    [-14 * day, '2 weeks ago'],
  ])('formats an offset of %d ms from the base date', (offset, expected) => {
    const date = new Date(baseDate.getTime() + offset);
    expect(
      formatRelativeTimeFromDate(date, { baseDate, locales: ['en'] })
    ).toBe(expected);
  });
});

describe('_formatRelativeTime', () => {
  it.each<[number, Intl.RelativeTimeFormatUnit, string, string]>([
    [-1, 'day', 'en', 'yesterday'],
    [2, 'hour', 'en', 'in 2 hours'],
    [-1, 'week', 'en', 'last week'],
    [0, 'day', 'en', 'today'],
    [-3, 'day', 'es', 'hace 3 días'],
  ])('formats %d %s in %s as %j', (value, unit, locale, expected) => {
    expect(
      _formatRelativeTime({ value, unit, locales: [locale], options: {} })
    ).toBe(expected);
  });
});

describe('the Intl cache', () => {
  it('formats a date in the time zone it is given', () => {
    const date = new Date('2020-05-06T14:03:02Z');
    const format = (zone: string) =>
      formatDateTime(date, {
        locales: 'en-US',
        timeStyle: 'short',
        timeZone: zone,
      });
    expect(format('America/New_York')).toBe('10:03 AM');
    expect(format('UTC')).toBe('2:03 PM');
  });

  it('shares one instance of a custom format', () => {
    expect(
      formatCutoff('Hello, world!', { locales: 'en-US', maxChars: 8 })
    ).toBe('Hello, …');
    expect(intlCache.get('CutoffFormat', 'en', { maxChars: 8 })).toBe(
      intlCache.get('CutoffFormat', 'en', { maxChars: 8 })
    );
  });
});
