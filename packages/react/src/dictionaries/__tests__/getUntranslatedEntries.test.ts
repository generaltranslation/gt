import { describe, it, expect } from 'vitest';
import { getUntranslatedEntries } from '../getUntranslatedEntries';
import { Dictionary } from '../../types/types';

describe('getUntranslatedEntries', () => {
  const originalTree: Dictionary = {
    greeting: 'Hello',
    user: {
      name: 'John',
      profile: {
        bio: ['Software developer', { $context: 'profession' }],
        location: 'New York'
      }
    },
    messages: {
      welcome: ['Welcome to our app', { $context: 'greeting' }],
      goodbye: 'Goodbye!',
      nested: {
        deep: 'Deep message'
      }
    }
  };

  describe('should find all untranslated entries when translation is empty', () => {
    it('should return all entries from empty translation tree', () => {
      const translatedTree: Dictionary = {};
      const result = getUntranslatedEntries(originalTree, translatedTree);
      
      expect(result).toHaveLength(6);
      expect(result).toEqual([
        { source: 'Hello', metadata: { $id: 'greeting' } },
        { source: 'John', metadata: { $id: 'user.name' } },
        { source: 'Software developer', metadata: { $id: 'user.profile.bio', $context: 'profession' } },
        { source: 'New York', metadata: { $id: 'user.profile.location' } },
        { source: 'Welcome to our app', metadata: { $id: 'messages.welcome', $context: 'greeting' } },
        { source: 'Goodbye!', metadata: { $id: 'messages.goodbye' } }
      ]);
    });
  });

  describe('should find partial untranslated entries', () => {
    it('should find untranslated entries when some translations exist', () => {
      const translatedTree: Dictionary = {
        greeting: 'Hola',
        user: {
          name: 'Juan'
        },
        messages: {
          welcome: 'Bienvenido a nuestra app'
        }
      };
      
      const result = getUntranslatedEntries(originalTree, translatedTree);
      
      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { source: 'Software developer', metadata: { $id: 'user.profile.bio', $context: 'profession' } },
        { source: 'New York', metadata: { $id: 'user.profile.location' } },
        { source: 'Goodbye!', metadata: { $id: 'messages.goodbye' } }
      ]);
    });

    it('should handle partial nested translations', () => {
      const translatedTree: Dictionary = {
        user: {
          profile: {
            bio: 'Desarrollador de software'
          }
        },
        messages: {
          nested: {
            deep: 'Mensaje profundo'
          }
        }
      };
      
      const result = getUntranslatedEntries(originalTree, translatedTree);
      
      expect(result).toHaveLength(4);
      expect(result).toEqual([
        { source: 'Hello', metadata: { $id: 'greeting' } },
        { source: 'John', metadata: { $id: 'user.name' } },
        { source: 'New York', metadata: { $id: 'user.profile.location' } },
        { source: 'Welcome to our app', metadata: { $id: 'messages.welcome', $context: 'greeting' } }
      ]);
    });
  });

  describe('should return empty array when fully translated', () => {
    it('should return empty array when all entries are translated', () => {
      const translatedTree: Dictionary = {
        greeting: 'Hola',
        user: {
          name: 'Juan',
          profile: {
            bio: 'Desarrollador de software',
            location: 'Nueva York'
          }
        },
        messages: {
          welcome: 'Bienvenido a nuestra app',
          goodbye: 'Adiós!',
          nested: {
            deep: 'Mensaje profundo'
          }
        }
      };
      
      const result = getUntranslatedEntries(originalTree, translatedTree);
      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });
  });

  describe('should handle edge cases', () => {
    it('should handle empty original tree', () => {
      const emptyTree: Dictionary = {};
      const translatedTree: Dictionary = { some: 'translation' };
      
      const result = getUntranslatedEntries(emptyTree, translatedTree);
      expect(result).toEqual([]);
    });

    it('should handle single entry tree', () => {
      const singleTree: Dictionary = { hello: 'world' };
      const emptyTranslation: Dictionary = {};
      
      const result = getUntranslatedEntries(singleTree, emptyTranslation);
      expect(result).toEqual([
        { source: 'world', metadata: { $id: 'hello' } }
      ]);
    });

    it('should handle custom id prefix', () => {
      const simpleTree: Dictionary = { test: 'value' };
      const emptyTranslation: Dictionary = {};
      
      const result = getUntranslatedEntries(simpleTree, emptyTranslation, 'prefix');
      expect(result).toEqual([
        { source: 'value', metadata: { $id: 'prefix.test' } }
      ]);
    });

    it('should preserve context metadata from original entries', () => {
      const treeWithContext: Dictionary = {
        button: ['Click me', { $context: 'action', customField: 'custom' }]
      };
      const emptyTranslation: Dictionary = {};
      
      const result = getUntranslatedEntries(treeWithContext, emptyTranslation);
      expect(result).toEqual([
        { source: 'Click me', metadata: { $id: 'button', $context: 'action' } }
      ]);
    });

    it('should handle mixed dictionary and string entries', () => {
      const mixedTree: Dictionary = {
        simple: 'Simple string',
        complex: {
          nested: 'Nested string'
        }
      };
      const partialTranslation: Dictionary = {
        simple: 'Cadena simple'
      };
      
      const result = getUntranslatedEntries(mixedTree, partialTranslation);
      expect(result).toEqual([
        { source: 'Nested string', metadata: { $id: 'complex.nested' } }
      ]);
    });
  });
});