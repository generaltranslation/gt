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
      const result = getSubtree(mockDictionary, 'greeting');
      expect(result).toBe('Hello');
    });

    it('should return nested dictionary', () => {
      const result = getSubtree(mockDictionary, 'user');
      expect(result).toEqual({
        name: 'John',
        profile: {
          bio: 'Software developer',
          location: 'New York',
        },
      });
    });

    it('should return nested string entry', () => {
      const result = getSubtree(mockDictionary, 'user.name');
      expect(result).toBe('John');
    });

    it('should return deeply nested dictionary', () => {
      const result = getSubtree(mockDictionary, 'user.profile');
      expect(result).toEqual({
        bio: 'Software developer',
        location: 'New York',
      });
    });

    it('should return deeply nested string entry', () => {
      const result = getSubtree(mockDictionary, 'user.profile.bio');
      expect(result).toBe('Software developer');
    });

    it('should return array-based dictionary entry', () => {
      const result = getSubtree(mockDictionary, 'messages.welcome');
      expect(result).toEqual(['Welcome to our app', { $context: 'greeting' }]);
    });

    it('should return very deeply nested value', () => {
      const result = getSubtree(mockDictionary, 'nested.deeply.nested.value');
      expect(result).toBe('Deep value');
    });
  });

  describe('should handle invalid paths gracefully', () => {
    it('should return undefined for non-existent top-level key', () => {
      const result = getSubtree(mockDictionary, 'nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent nested key', () => {
      const result = getSubtree(mockDictionary, 'user.nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return undefined when trying to access property of string value', () => {
      const result = getSubtree(mockDictionary, 'greeting.invalid');
      expect(result).toBeUndefined();
    });
  });

  describe('should handle edge cases', () => {
    it('should handle empty string id', () => {
      const result = getSubtree(mockDictionary, '');
      expect(result).toEqual(mockDictionary);
    });

    it('should handle empty dictionary', () => {
      const emptyDict: Dictionary = {};
      const result = getSubtree(emptyDict, 'any');
      expect(result).toBeUndefined();
    });
  });
});
