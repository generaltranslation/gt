import { describe, it, expect } from 'vitest';
import { getSubtree } from '../getSubtree';
import { Dictionary, DictionaryEntry } from '../../types/types';

describe('getSubtree', () => {
  const mockDictionary: Dictionary = {
    greeting: 'Hello',
    user: {
      name: 'John',
      profile: {
        bio: 'Software developer',
        location: 'New York',
      },
    },
    messages: {
      welcome: ['Welcome to our app', { $context: 'greeting' }],
      goodbye: 'Goodbye!',
    },
    nested: {
      deeply: {
        nested: {
          value: 'Deep value',
        },
      },
    },
  };

  describe('should return correct values for valid paths', () => {
    it('should return top-level string entry', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: 'greeting' });
      expect(result).toBe('Hello');
    });

    it('should return nested dictionary', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: 'user' });
      expect(result).toEqual({
        name: 'John',
        profile: {
          bio: 'Software developer',
          location: 'New York',
        },
      });
    });

    it('should return nested string entry', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: 'user.name' });
      expect(result).toBe('John');
    });

    it('should return deeply nested dictionary', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: 'user.profile' });
      expect(result).toEqual({
        bio: 'Software developer',
        location: 'New York',
      });
    });

    it('should return deeply nested string entry', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: 'user.profile.bio' });
      expect(result).toBe('Software developer');
    });

    it('should return array-based dictionary entry', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: 'messages.welcome' });
      expect(result).toEqual(['Welcome to our app', { $context: 'greeting' }]);
    });

    it('should return very deeply nested value', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: 'nested.deeply.nested.value' });
      expect(result).toBe('Deep value');
    });
  });

  describe('should handle invalid paths gracefully', () => {
    it('should return undefined for non-existent top-level key', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: 'nonexistent' });
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent nested key', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: 'user.nonexistent' });
      expect(result).toBeUndefined();
    });

    it('should return undefined when trying to access property of string value', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: 'greeting.invalid' });
      expect(result).toBeUndefined();
    });
  });

  describe('should handle edge cases', () => {
    it('should handle empty string id', () => {
      const result = getSubtree({ dictionary: mockDictionary, id: '' });
      expect(result).toEqual(mockDictionary);
    });

    it('should handle empty dictionary', () => {
      const emptyDict: Dictionary = {};
      const result = getSubtree({ dictionary: emptyDict, id: 'any' });
      expect(result).toBeUndefined();
    });
  });
});
