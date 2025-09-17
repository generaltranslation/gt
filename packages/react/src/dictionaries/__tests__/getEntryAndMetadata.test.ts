import { describe, it, expect } from 'vitest';
import getEntryAndMetadata from '../getEntryAndMetadata';
import { DictionaryEntry } from '../../types/types';

describe('getEntryAndMetadata', () => {
  describe('should handle string entries', () => {
    it('should return string entry without metadata', () => {
      const value: DictionaryEntry = 'Hello World';

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: 'Hello World',
      });
    });

    it('should handle empty string', () => {
      const value: DictionaryEntry = '';

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: '',
      });
    });
  });

  describe('should handle single-element arrays', () => {
    it('should extract entry from single-element array', () => {
      const value: DictionaryEntry = ['Hello World'];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: 'Hello World',
      });
    });

    it('should handle empty string in single-element array', () => {
      const value: DictionaryEntry = [''];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: '',
      });
    });

    it('should handle single-element array with special characters', () => {
      const value: DictionaryEntry = ['Hello {name}, welcome to {app}!'];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: 'Hello {name}, welcome to {app}!',
      });
    });
  });

  describe('should handle two-element arrays with metadata', () => {
    it('should extract entry and metadata from two-element array', () => {
      const value: DictionaryEntry = ['Hello World', { $context: 'greeting' }];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: 'Hello World',
        metadata: { $context: 'greeting' },
      });
    });

    it('should handle complex metadata object', () => {
      const value: DictionaryEntry = [
        'Welcome {name}',
        {
          $context: 'greeting',
          $id: 'welcome_message',
          $_hash: 'hash_value',
          customField: 'custom_value',
        },
      ];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: 'Welcome {name}',
        metadata: {
          $context: 'greeting',
          $id: 'welcome_message',
          $_hash: 'hash_value',
          customField: 'custom_value',
        },
      });
    });

    it('should handle empty metadata object', () => {
      const value: DictionaryEntry = ['Hello', {}];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: 'Hello',
        metadata: {},
      });
    });

    it('should handle metadata with nested objects', () => {
      const value: DictionaryEntry = [
        'Complex message',
        {
          $context: 'complex',
          nestedObject: {
            key1: 'value1',
            key2: 'value2',
          },
          arrayField: [1, 2, 3],
        },
      ];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: 'Complex message',
        metadata: {
          $context: 'complex',
          nestedObject: {
            key1: 'value1',
            key2: 'value2',
          },
          arrayField: [1, 2, 3],
        },
      });
    });
  });

  describe('should handle edge cases', () => {
    it('should handle array with more than 2 elements (fallback to string)', () => {
      // Note: This is technically an invalid DictionaryEntry, but testing the function's behavior
      const value: any = ['Hello', { $context: 'greeting' }, 'extra'];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: value, // Should return the whole array as entry when not matching expected formats
      });
    });

    it('should handle empty array (fallback to string)', () => {
      // Note: This is technically an invalid DictionaryEntry, but testing the function's behavior
      const value: any = [];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: value, // Should return the whole array as entry when not matching expected formats
      });
    });
  });

  describe('should preserve metadata structure', () => {
    it('should not mutate original metadata object', () => {
      const metadata = { $context: 'greeting', $id: 'test' };
      const value: DictionaryEntry = ['Hello', metadata];
      const originalMetadata = { ...metadata };

      const result = getEntryAndMetadata(value);

      expect(metadata).toEqual(originalMetadata);
      expect(result.metadata).toEqual(metadata);
      expect(result.metadata).toBe(metadata); // Should be the same reference
    });

    it('should handle metadata with special characters and symbols', () => {
      const value: DictionaryEntry = [
        'Message with symbols: @#$%^&*()',
        {
          $context: 'special-context_123',
          $id: 'id-with-dashes_and_underscores',
          'field-with-dashes': 'value',
          field_with_underscores: 'value',
          'field with spaces': 'value',
        },
      ];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: 'Message with symbols: @#$%^&*()',
        metadata: {
          $context: 'special-context_123',
          $id: 'id-with-dashes_and_underscores',
          'field-with-dashes': 'value',
          field_with_underscores: 'value',
          'field with spaces': 'value',
        },
      });
    });

    it('should handle null and undefined values in metadata', () => {
      const value: DictionaryEntry = [
        'Test message',
        {
          $context: 'test',
          nullField: null,
          undefinedField: undefined,
          falseField: false,
          zeroField: 0,
          emptyStringField: '',
        } as any,
      ];

      const result = getEntryAndMetadata(value);

      expect(result).toEqual({
        entry: 'Test message',
        metadata: {
          $context: 'test',
          nullField: null,
          undefinedField: undefined,
          falseField: false,
          zeroField: 0,
          emptyStringField: '',
        },
      });
    });
  });
});