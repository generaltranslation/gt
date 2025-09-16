import { describe, it, expect } from 'vitest';
import { injectEntry } from '../injectEntry';
import { Dictionary, DictionaryEntry } from '../../types/types';

describe('injectEntry', () => {
  describe('should inject entries into flat dictionary structure', () => {
    it('should inject simple string entry at root level', () => {
      const dictionary: Dictionary = {};
      const entry: DictionaryEntry = 'Hello World';
      
      injectEntry(entry, dictionary, 'greeting');
      
      expect(dictionary).toEqual({
        greeting: 'Hello World'
      });
    });

    it('should inject array-based entry with metadata', () => {
      const dictionary: Dictionary = {};
      const entry: DictionaryEntry = ['Welcome', { $context: 'greeting' }];
      
      injectEntry(entry, dictionary, 'welcome');
      
      expect(dictionary).toEqual({
        welcome: ['Welcome', { $context: 'greeting' }]
      });
    });

    it('should inject entry with single-element array', () => {
      const dictionary: Dictionary = {};
      const entry: DictionaryEntry = ['Hello'];
      
      injectEntry(entry, dictionary, 'simple');
      
      expect(dictionary).toEqual({
        simple: ['Hello']
      });
    });
  });

  describe('should inject entries into nested dictionary structure', () => {
    it('should inject entry into single-level nested path', () => {
      const dictionary: Dictionary = {};
      const entry: DictionaryEntry = 'John Doe';
      
      injectEntry(entry, dictionary, 'user.name');
      
      expect(dictionary).toEqual({
        user: {
          name: 'John Doe'
        }
      });
    });

    it('should inject entry into multi-level nested path', () => {
      const dictionary: Dictionary = {};
      const entry: DictionaryEntry = 'Software Engineer';
      
      injectEntry(entry, dictionary, 'user.profile.occupation');
      
      expect(dictionary).toEqual({
        user: {
          profile: {
            occupation: 'Software Engineer'
          }
        }
      });
    });

    it('should inject entry into existing nested structure', () => {
      const dictionary: Dictionary = {
        user: {
          name: 'John'
        }
      };
      const entry: DictionaryEntry = 'john@example.com';
      
      injectEntry(entry, dictionary, 'user.email');
      
      expect(dictionary).toEqual({
        user: {
          name: 'John',
          email: 'john@example.com'
        }
      });
    });

    it('should inject deeply nested entry with metadata', () => {
      const dictionary: Dictionary = {};
      const entry: DictionaryEntry = ['Deep message', { $context: 'system' }];
      
      injectEntry(entry, dictionary, 'app.messages.system.error');
      
      expect(dictionary).toEqual({
        app: {
          messages: {
            system: {
              error: ['Deep message', { $context: 'system' }]
            }
          }
        }
      });
    });
  });

  describe('should handle DictionaryEntry parameter type', () => {
    it('should return entry when dictionary parameter is a DictionaryEntry', () => {
      const dictionary: DictionaryEntry = 'Existing entry';
      const entry: DictionaryEntry = 'New entry';
      
      const result = injectEntry(entry, dictionary, 'any.path');
      
      expect(result).toBe('New entry');
    });

    it('should return entry when dictionary parameter is array DictionaryEntry', () => {
      const dictionary: DictionaryEntry = ['Existing entry', { $context: 'test' }];
      const entry: DictionaryEntry = 'New entry';
      
      const result = injectEntry(entry, dictionary, 'any.path');
      
      expect(result).toBe('New entry');
    });

    it('should still mutate dictionary when it is a Dictionary object', () => {
      const dictionary: Dictionary = { existing: 'value' };
      const entry: DictionaryEntry = 'Hello World';
      
      const result = injectEntry(entry, dictionary, 'greeting');
      
      expect(dictionary).toEqual({
        existing: 'value',
        greeting: 'Hello World'
      });
      expect(result).toBeUndefined();
    });

    it('should inject complex entry into nested paths in Dictionary', () => {
      const dictionary: Dictionary = {};
      const entry: DictionaryEntry = ['Complex entry', { $context: 'test' }];
      
      const result = injectEntry(entry, dictionary, 'user.profile.bio');
      
      expect(result).toBeUndefined();
      expect(dictionary).toEqual({
        user: {
          profile: {
            bio: ['Complex entry', { $context: 'test' }]
          }
        }
      });
    });
  });

  describe('should handle edge cases and overwrites', () => {
    it('should overwrite existing entry', () => {
      const dictionary: Dictionary = {
        greeting: 'Old greeting'
      };
      const entry: DictionaryEntry = 'New greeting';
      
      injectEntry(entry, dictionary, 'greeting');
      
      expect(dictionary).toEqual({
        greeting: 'New greeting'
      });
    });

    it('should throw error when trying to access property of primitive during navigation', () => {
      const dictionary: Dictionary = {
        user: 'Simple string'
      };
      const entry: DictionaryEntry = 'John';
      
      expect(() => {
        injectEntry(entry, dictionary, 'user.name');
      }).toThrow();
    });

    it('should handle null parent values', () => {
      const dictionary: Dictionary = {
        user: null as any
      };
      const entry: DictionaryEntry = 'John';
      
      injectEntry(entry, dictionary, 'user.name');
      
      expect(dictionary).toEqual({
        user: {
          name: 'John'
        }
      });
    });

    it('should handle empty string entry', () => {
      const dictionary: Dictionary = {};
      const entry: DictionaryEntry = '';
      
      injectEntry(entry, dictionary, 'empty.message');
      
      expect(dictionary).toEqual({
        empty: {
          message: ''
        }
      });
    });
  });
});