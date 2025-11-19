import { describe, it, expect } from 'vitest';
import { _formatListToParts } from '../format';

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
