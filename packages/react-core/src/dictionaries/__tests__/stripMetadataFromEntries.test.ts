import { describe, it, expect } from 'vitest';
import { stripMetadataFromEntries } from '../stripMetadataFromEntries';
import { Dictionary } from '../../types/types';

describe('stripMetadataFromEntries', () => {
  describe('should strip metadata from dictionary entries', () => {
    it('should return string entries unchanged', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello World',
        farewell: 'Goodbye',
      };

      const result = stripMetadataFromEntries(dictionary);

      expect(result).toEqual({
        greeting: 'Hello World',
        farewell: 'Goodbye',
      });
    });

    it('should strip metadata from array entries with metadata', () => {
      const dictionary: Dictionary = {
        welcome: ['Welcome back', { $context: 'greeting', $id: 'welcome_id' }],
        error: [
          'Something went wrong',
          { $context: 'error', customField: 'value' },
        ],
      };

      const result = stripMetadataFromEntries(dictionary);

      expect(result).toEqual({
        welcome: 'Welcome back',
        error: 'Something went wrong',
      });
    });

    it('should handle single-element arrays', () => {
      const dictionary: Dictionary = {
        simple: ['Simple text'],
        another: ['Another text'],
      };

      const result = stripMetadataFromEntries(dictionary);

      expect(result).toEqual({
        simple: 'Simple text',
        another: 'Another text',
      });
    });

    it('should handle mixed entry types', () => {
      const dictionary: Dictionary = {
        string: 'Plain string',
        withMetadata: ['Text with metadata', { $context: 'test' }],
        singleArray: ['Single array element'],
      };

      const result = stripMetadataFromEntries(dictionary);

      expect(result).toEqual({
        string: 'Plain string',
        withMetadata: 'Text with metadata',
        singleArray: 'Single array element',
      });
    });
  });

  describe('should handle nested dictionary structures', () => {
    it('should recursively strip metadata from nested dictionaries', () => {
      const dictionary: Dictionary = {
        user: {
          profile: {
            name: ['John Doe', { $context: 'name' }],
            bio: 'Software developer',
            location: ['New York', { $context: 'location', $id: 'loc_1' }],
          },
          settings: {
            theme: 'dark',
            language: ['English', { $context: 'language' }],
          },
        },
        messages: {
          welcome: ['Welcome!', { $context: 'greeting' }],
          goodbye: 'See you later',
        },
      };

      const result = stripMetadataFromEntries(dictionary);

      expect(result).toEqual({
        user: {
          profile: {
            name: 'John Doe',
            bio: 'Software developer',
            location: 'New York',
          },
          settings: {
            theme: 'dark',
            language: 'English',
          },
        },
        messages: {
          welcome: 'Welcome!',
          goodbye: 'See you later',
        },
      });
    });

    it('should handle deeply nested structures', () => {
      const dictionary: Dictionary = {
        level1: {
          level2: {
            level3: {
              level4: {
                deepEntry: ['Deep value', { $context: 'deep', $id: 'deep_id' }],
                normalEntry: 'Normal value',
              },
            },
          },
        },
      };

      const result = stripMetadataFromEntries(dictionary);

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              level4: {
                deepEntry: 'Deep value',
                normalEntry: 'Normal value',
              },
            },
          },
        },
      });
    });

    it('should handle mixed nested and flat structures', () => {
      const dictionary: Dictionary = {
        flat: ['Flat entry', { $context: 'flat' }],
        nested: {
          entry1: ['Nested entry 1', { $context: 'nested' }],
          entry2: 'Nested entry 2',
          deeperNested: {
            entry3: ['Deep entry', { $context: 'deep', customField: 'custom' }],
          },
        },
      };

      const result = stripMetadataFromEntries(dictionary);

      expect(result).toEqual({
        flat: 'Flat entry',
        nested: {
          entry1: 'Nested entry 1',
          entry2: 'Nested entry 2',
          deeperNested: {
            entry3: 'Deep entry',
          },
        },
      });
    });
  });

  describe('should handle edge cases', () => {
    it('should handle empty dictionary', () => {
      const dictionary: Dictionary = {};

      const result = stripMetadataFromEntries(dictionary);

      expect(result).toEqual({});
    });

    it('should handle dictionary with empty nested objects', () => {
      const dictionary: Dictionary = {
        empty: {},
        nonEmpty: {
          entry: ['Text', { $context: 'test' }],
        },
      };

      const result = stripMetadataFromEntries(dictionary);

      expect(result).toEqual({
        empty: {},
        nonEmpty: {
          entry: 'Text',
        },
      });
    });

    it('should handle complex metadata objects', () => {
      const dictionary: Dictionary = {
        complex: [
          'Complex text',
          {
            $context: 'complex',
            $id: 'complex_id',
            $_hash: 'some_hash',
            customField1: 'value1',
            customField2: { nested: 'nested_value' },
            customField3: [1, 2, 3],
          },
        ],
      };

      const result = stripMetadataFromEntries(dictionary);

      expect(result).toEqual({
        complex: 'Complex text',
      });
    });

    it('should preserve original dictionary structure (not mutate)', () => {
      const dictionary: Dictionary = {
        test: ['Test text', { $context: 'test' }],
        nested: {
          entry: ['Nested text', { $context: 'nested' }],
        },
      };
      const original = JSON.parse(JSON.stringify(dictionary)); // Deep copy for comparison

      const result = stripMetadataFromEntries(dictionary);

      expect(dictionary).toEqual(original); // Original should be unchanged
      expect(result).not.toBe(dictionary); // Should be a new object
      expect(result.test).toBe('Test text');
    });
  });
});
