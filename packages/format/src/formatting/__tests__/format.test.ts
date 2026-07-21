import { describe, it, expect } from 'vitest';
import { formatMessage as publicFormatMessage } from '../../core';
import { _formatListToParts, _formatMessageICU } from '../format';

describe('_formatMessageICU', () => {
  it.each([
    ['plain text', {}, 'plain text'],
    ['Hello {name}', { name: 'Ada' }, 'Hello Ada'],
    ['Zero: {value}', { value: 0 }, 'Zero: 0'],
    ['False: {value}', { value: false }, 'False: '],
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
      expect(_formatMessageICU(message, 'en-US', variables)).toBe(expected);
    }
  );

  it('passes number skeletons through the package boundary', () => {
    expect(
      _formatMessageICU('{value, number, ::currency/USD .00}', 'en-US', {
        value: 1234.5,
      })
    ).toBe('$1,234.50');
    expect(
      _formatMessageICU('{value, number, ::scale/0}', 'en-US', {
        value: 12.34,
      })
    ).toBe('12.34');
  });

  it('passes date skeletons through the package boundary', () => {
    const value = new Date('2020-05-06T14:03:02Z');
    expect(
      _formatMessageICU('{value, date, ::yyyyMMMdd}', 'en-US', { value })
    ).toBe(
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(value)
    );

    for (const field of ['C', 'S', 'A']) {
      expect(
        _formatMessageICU(`{value, time, ::${field}}`, 'en-US', { value })
      ).toBe(new Intl.DateTimeFormat('en-US').format(value));
    }
  });

  it('preserves locale arrays through the package boundary', () => {
    expect(
      _formatMessageICU('{value, number}', ['de-DE', 'en-US'], {
        value: 1234.5,
      })
    ).toBe(new Intl.NumberFormat('de-DE').format(1234.5));
  });

  it('still surfaces missing-variable failures through the package boundary', () => {
    expect(() => _formatMessageICU('Hello {name}', 'en-US')).toThrow(
      'variable "name" was not provided'
    );
  });

  it.each([
    ['2', 'exact'],
    ['02', '2 items'],
    ['2.5', '2.5 items'],
  ])(
    'coerces numeric-string plural %j through the public package',
    (count, expected) => {
      expect(
        publicFormatMessage(
          '{count, plural, =2 {exact} one {one item} other {# items}}',
          { locales: 'en-US', variables: { count } }
        )
      ).toBe(expected);
    }
  );

  it('preserves boolean interpolation serialization from the previous runtime', () => {
    const result = publicFormatMessage('before {value} after', {
      variables: { value: true },
    });

    expect(result).toBe('before ,true, after');
  });

  it('preserves Date interpolation serialization from the previous runtime', () => {
    const value = new Date(0);
    expect(
      publicFormatMessage('before {value} after', { variables: { value } })
    ).toBe(['before ', value, ' after'].toString());
    expect(publicFormatMessage('{value}', { variables: { value } })).toBe(
      value.toString()
    );
  });
});

describe('_formatListToParts', () => {
  it('should format empty array', () => {
    const result = _formatListToParts({
      value: [],
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual([]);
  });

  it('should format single item array', () => {
    const result = _formatListToParts({
      value: ['apple'],
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual(['apple']);
  });

  it('should format two items with conjunction (default)', () => {
    const result = _formatListToParts({
      value: ['apple', 'banana'],
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual(['apple', ' and ', 'banana']);
  });

  it('should format three items with conjunction', () => {
    const result = _formatListToParts({
      value: ['apple', 'banana', 'orange'],
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual(['apple', ', ', 'banana', ', and ', 'orange']);
  });

  it('should format with disjunction type', () => {
    const result = _formatListToParts({
      value: ['red', 'green', 'blue'],
      locales: ['en'],
      options: { type: 'disjunction' },
    });

    expect(result).toEqual(['red', ', ', 'green', ', or ', 'blue']);
  });

  it('should format with unit type', () => {
    const result = _formatListToParts({
      value: ['1 km', '2 mi', '3 ft'],
      locales: ['en'],
      options: { type: 'unit' },
    });

    expect(result).toEqual(['1 km', ', ', '2 mi', ', ', '3 ft']);
  });

  it('should format with short style', () => {
    const result = _formatListToParts({
      value: ['first', 'second', 'third'],
      locales: ['en'],
      options: { style: 'short' },
    });

    expect(result).toEqual(['first', ', ', 'second', ', & ', 'third']);
  });

  it('should format with narrow style', () => {
    const result = _formatListToParts({
      value: ['A', 'B', 'C'],
      locales: ['en'],
      options: { style: 'narrow' },
    });

    expect(result).toEqual(['A', ', ', 'B', ', ', 'C']);
  });

  it('should respect different locales - Spanish', () => {
    const result = _formatListToParts({
      value: ['manzana', 'plátano', 'naranja'],
      locales: ['es'],
      options: {},
    });

    expect(result).toEqual(['manzana', ', ', 'plátano', ' y ', 'naranja']);
  });

  it('should respect different locales - French', () => {
    const result = _formatListToParts({
      value: ['pomme', 'banane', 'orange'],
      locales: ['fr'],
      options: {},
    });

    expect(result).toEqual(['pomme', ', ', 'banane', ' et ', 'orange']);
  });

  it('should handle mixed data types', () => {
    const mixedArray = ['string', 42, { name: 'object' }, true, null];

    const result = _formatListToParts({
      value: mixedArray,
      locales: ['en'],
      options: {},
    });

    // Should preserve original types and add separators
    expect(result).toHaveLength(9); // 5 items + 4 separators
    expect(result[0]).toBe('string');
    expect(result[2]).toBe(42);
    expect(result[4]).toEqual({ name: 'object' });
    expect(result[6]).toBe(true);
    expect(result[8]).toBe(null);

    // Check separators
    expect(result[1]).toBe(', ');
    expect(result[3]).toBe(', ');
    expect(result[5]).toBe(', ');
    expect(result[7]).toBe(', and ');
  });

  it('should handle objects and preserve their identity', () => {
    const obj1 = { id: 1, name: 'first' };
    const obj2 = { id: 2, name: 'second' };

    const result = _formatListToParts({
      value: [obj1, obj2],
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual([obj1, ' and ', obj2]);
    expect(result[0]).toBe(obj1); // Same reference
    expect(result[2]).toBe(obj2); // Same reference
  });

  it('should handle numbers and preserve their types', () => {
    const result = _formatListToParts({
      value: [1, 2.5, -3, 0],
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual([1, ', ', 2.5, ', ', -3, ', and ', 0]);
    expect(typeof result[0]).toBe('number');
    expect(typeof result[2]).toBe('number');
    expect(typeof result[4]).toBe('number');
    expect(typeof result[6]).toBe('number');
  });

  it('should handle boolean values', () => {
    const result = _formatListToParts({
      value: [true, false],
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual([true, ' and ', false]);
    expect(typeof result[0]).toBe('boolean');
    expect(typeof result[2]).toBe('boolean');
  });

  it('should use default locale when not specified', () => {
    const result = _formatListToParts({
      value: ['one', 'two'],
      options: {},
    });

    expect(result).toEqual(['one', ' and ', 'two']);
  });

  it('should handle multiple locales array', () => {
    const result = _formatListToParts({
      value: ['item1', 'item2', 'item3'],
      locales: ['es-ES', 'en-US'],
      options: {},
    });

    // Should use the first locale in the array (Spanish)
    expect(result).toEqual(['item1', ', ', 'item2', ' y ', 'item3']);
  });

  it('should override default options with provided options', () => {
    const result = _formatListToParts({
      value: ['a', 'b', 'c'],
      locales: ['en'],
      options: {
        type: 'disjunction',
        style: 'short',
      },
    });

    expect(result).toEqual(['a', ', ', 'b', ', or ', 'c']);
  });

  it('should handle very long arrays', () => {
    const longArray = Array.from({ length: 10 }, (_, i) => `item${i + 1}`);

    const result = _formatListToParts({
      value: longArray,
      locales: ['en'],
      options: {},
    });

    // Should have 10 items + 9 separators = 19 total parts
    expect(result).toHaveLength(19);

    // First item should be preserved
    expect(result[0]).toBe('item1');
    // Last item should be preserved
    expect(result[18]).toBe('item10');
    // Second to last separator should be the final conjunction
    expect(result[17]).toBe(', and ');
  });

  it('should handle undefined and null values', () => {
    const result = _formatListToParts({
      value: [undefined, null, 'valid'],
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual([undefined, ', ', null, ', and ', 'valid']);
    expect(result[0]).toBeUndefined();
    expect(result[2]).toBeNull();
    expect(result[4]).toBe('valid');
  });

  it('should handle Date objects', () => {
    const date1 = new Date('2023-01-01');
    const date2 = new Date('2023-12-31');

    const result = _formatListToParts({
      value: [date1, date2],
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual([date1, ' and ', date2]);
    expect(result[0]).toBe(date1);
    expect(result[2]).toBe(date2);
  });

  it('should handle functions', () => {
    const fn1 = () => 'hello';
    const fn2 = () => 'world';

    const result = _formatListToParts({
      value: [fn1, fn2],
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual([fn1, ' and ', fn2]);
    expect(result[0]).toBe(fn1);
    expect(result[2]).toBe(fn2);
  });

  it('should maintain insertion order', () => {
    const items = [3, 1, 4, 1, 5, 9, 2, 6];

    const result = _formatListToParts({
      value: items,
      locales: ['en'],
      options: {},
    });

    // Extract only the original items (every other element starting from 0)
    const extractedItems = result.filter((_, index) => index % 2 === 0);
    expect(extractedItems).toEqual(items);
  });

  it('should work with generic types', () => {
    interface TestItem {
      id: number;
      name: string;
    }

    const items: TestItem[] = [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' },
    ];

    const result = _formatListToParts({
      value: items,
      locales: ['en'],
      options: {},
    });

    expect(result).toEqual([items[0], ' and ', items[1]]);
    expect(result[0]).toBe(items[0]);
    expect(result[2]).toBe(items[1]);
  });
});
