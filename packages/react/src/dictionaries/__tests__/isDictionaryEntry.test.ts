import { describe, it, expect } from 'vitest';
import { isDictionaryEntry } from '../isDictionaryEntry';
import { Dictionary, DictionaryEntry } from '../../types/types';

describe('isDictionaryEntry', () => {
  describe('should return true for valid DictionaryEntry types', () => {
    it('should return true for simple string entry', () => {
      const entry: DictionaryEntry = 'Hello world';
      expect(isDictionaryEntry(entry)).toBe(true);
    });

    it('should return true for array with single string element', () => {
      const entry: DictionaryEntry = ['Hello world'];
      expect(isDictionaryEntry(entry)).toBe(true);
    });

    it('should return true for array with string and metadata', () => {
      const entry: DictionaryEntry = ['Hello world', { $context: 'greeting' }];
      expect(isDictionaryEntry(entry)).toBe(true);
    });

    it('should return true for array with string and complex metadata', () => {
      const entry: DictionaryEntry = [
        'Hello {name}',
        { $context: 'greeting', $id: 'hello', customField: 'custom' },
      ];
      expect(isDictionaryEntry(entry)).toBe(true);
    });

    it('should return true for array with string and empty object metadata', () => {
      const entry: DictionaryEntry = ['Hello', {}];
      expect(isDictionaryEntry(entry)).toBe(false);
    });
  });

  describe('should return false for invalid types', () => {
    it('should return false for undefined', () => {
      expect(isDictionaryEntry(undefined)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isDictionaryEntry(null)).toBe(false);
    });

    it('should return false for number', () => {
      expect(isDictionaryEntry(42)).toBe(false);
    });

    it('should return false for boolean', () => {
      expect(isDictionaryEntry(true)).toBe(false);
      expect(isDictionaryEntry(false)).toBe(false);
    });

    it('should return false for plain object (Dictionary)', () => {
      const dict: Dictionary = { hello: 'world' };
      expect(isDictionaryEntry(dict)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isDictionaryEntry({})).toBe(false);
    });
  });

  describe('should return false for invalid array formats', () => {
    it('should return false for empty array', () => {
      expect(isDictionaryEntry([])).toBe(false);
    });

    it('should return false for array with more than 2 elements', () => {
      expect(isDictionaryEntry(['hello', {}, 'extra'])).toBe(false);
    });

    it('should return false for array with non-string first element', () => {
      expect(isDictionaryEntry([42, { $context: 'number' }])).toBe(false);
      expect(isDictionaryEntry([true, { $context: 'boolean' }])).toBe(false);
      expect(isDictionaryEntry([null, { $context: 'null' }])).toBe(false);
    });

    it('should return false for array with non-object second element', () => {
      expect(isDictionaryEntry(['hello', 'world'])).toBe(false);
      expect(isDictionaryEntry(['hello', 42])).toBe(false);
      expect(isDictionaryEntry(['hello', true])).toBe(false);
      expect(isDictionaryEntry(['hello', null])).toBe(false);
    });

    it('should return false for array with 3 elements', () => {
      expect(
        isDictionaryEntry(['hello', { $context: 'greeting' }, 'extra'])
      ).toBe(false);
    });
  });

  describe('should handle edge cases correctly', () => {
    it('should handle empty string', () => {
      expect(isDictionaryEntry('')).toBe(true);
    });

    it('should handle array with empty string', () => {
      expect(isDictionaryEntry([''])).toBe(true);
    });

    it('should handle array with empty string and metadata', () => {
      expect(isDictionaryEntry(['', { $context: 'empty' }])).toBe(true);
    });

    it('should handle nested arrays', () => {
      expect(isDictionaryEntry([['nested']])).toBe(false);
    });

    it('should handle function as input', () => {
      expect(isDictionaryEntry(() => 'hello')).toBe(false);
    });
  });
});
