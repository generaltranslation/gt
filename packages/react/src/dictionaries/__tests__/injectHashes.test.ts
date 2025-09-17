import { describe, it, expect, vi } from 'vitest';
import { injectHashes } from '../injectHashes';
import { Dictionary } from '../../types/types';

// Mock the hashSource function
vi.mock('generaltranslation/id', () => ({
  hashSource: vi.fn(({ source, context, id }) => `hash_${source}_${context || 'none'}_${id}`),
}));

describe('injectHashes', () => {
  describe('should inject hashes for dictionary entries without hashes', () => {
    it('should inject hash for simple string entry', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        greeting: ['Hello world', { $_hash: 'hash_Hello world_none_greeting' }],
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should inject hash for array entry without metadata', () => {
      const dictionary: Dictionary = {
        welcome: ['Welcome to our app'],
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        welcome: ['Welcome to our app', { $_hash: 'hash_Welcome to our app_none_welcome' }],
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should inject hash for array entry with existing metadata but no hash', () => {
      const dictionary: Dictionary = {
        greeting: ['Hello {name}', { $context: 'personal' }],
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        greeting: ['Hello {name}', { $context: 'personal', $_hash: 'hash_Hello {name}_personal_greeting' }],
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should not modify entries that already have hashes', () => {
      const dictionary: Dictionary = {
        greeting: ['Hello world', { $_hash: 'existing_hash' }],
        farewell: 'Goodbye',
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        greeting: ['Hello world', { $_hash: 'existing_hash' }],
        farewell: ['Goodbye', { $_hash: 'hash_Goodbye_none_farewell' }],
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should handle multiple entries needing hashes', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
        welcome: 'Welcome',
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        greeting: ['Hello', { $_hash: 'hash_Hello_none_greeting' }],
        farewell: ['Goodbye', { $_hash: 'hash_Goodbye_none_farewell' }],
        welcome: ['Welcome', { $_hash: 'hash_Welcome_none_welcome' }],
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should handle nested dictionary structures', () => {
    it('should inject hashes for nested entries', () => {
      const dictionary: Dictionary = {
        user: {
          profile: {
            name: 'Name',
            email: 'Email',
          },
        },
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        user: {
          profile: {
            name: ['Name', { $_hash: 'hash_Name_none_user.profile.name' }],
            email: ['Email', { $_hash: 'hash_Email_none_user.profile.email' }],
          },
        },
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should handle deeply nested structures', () => {
      const dictionary: Dictionary = {
        app: {
          nav: {
            menu: {
              items: {
                home: 'Home',
                about: 'About',
              },
            },
          },
        },
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        app: {
          nav: {
            menu: {
              items: {
                home: ['Home', { $_hash: 'hash_Home_none_app.nav.menu.items.home' }],
                about: ['About', { $_hash: 'hash_About_none_app.nav.menu.items.about' }],
              },
            },
          },
        },
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should handle mixed nested structures with existing hashes', () => {
      const dictionary: Dictionary = {
        section1: {
          item1: ['Item 1', { $_hash: 'existing_hash_1' }],
          item2: 'Item 2',
        },
        section2: {
          item3: 'Item 3',
        },
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        section1: {
          item1: ['Item 1', { $_hash: 'existing_hash_1' }],
          item2: ['Item 2', { $_hash: 'hash_Item 2_none_section1.item2' }],
        },
        section2: {
          item3: ['Item 3', { $_hash: 'hash_Item 3_none_section2.item3' }],
        },
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should handle entries with context', () => {
    it('should include context in hash generation', () => {
      const dictionary: Dictionary = {
        submit: ['Submit', { $context: 'button' }],
        save: ['Save', { $context: 'action' }],
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        submit: ['Submit', { $context: 'button', $_hash: 'hash_Submit_button_submit' }],
        save: ['Save', { $context: 'action', $_hash: 'hash_Save_action_save' }],
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should handle entries with complex metadata', () => {
      const dictionary: Dictionary = {
        greeting: ['Hello {name}', { $context: 'personal', $id: 'greeting_id', customField: 'custom' }],
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        greeting: ['Hello {name}', { $context: 'personal', $id: 'greeting_id', customField: 'custom', $_hash: 'hash_Hello {name}_personal_greeting' }],
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should handle entries without context alongside those with context', () => {
      const dictionary: Dictionary = {
        title: 'Page Title',
        button: ['Click me', { $context: 'action' }],
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        title: ['Page Title', { $_hash: 'hash_Page Title_none_title' }],
        button: ['Click me', { $context: 'action', $_hash: 'hash_Click me_action_button' }],
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should handle custom id parameter', () => {
    it('should use custom id as prefix for hash generation', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
      };

      const result = injectHashes(dictionary, 'custom.prefix');

      expect(result.dictionary).toEqual({
        greeting: ['Hello', { $_hash: 'hash_Hello_none_custom.prefix.greeting' }],
        farewell: ['Goodbye', { $_hash: 'hash_Goodbye_none_custom.prefix.farewell' }],
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should handle nested structure with custom id', () => {
      const dictionary: Dictionary = {
        user: {
          name: 'Name',
          email: 'Email',
        },
      };

      const result = injectHashes(dictionary, 'app.section');

      expect(result.dictionary).toEqual({
        user: {
          name: ['Name', { $_hash: 'hash_Name_none_app.section.user.name' }],
          email: ['Email', { $_hash: 'hash_Email_none_app.section.user.email' }],
        },
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should return correct updateDictionary flag', () => {
    it('should return false when no updates needed', () => {
      const dictionary: Dictionary = {
        greeting: ['Hello world', { $_hash: 'existing_hash' }],
        farewell: ['Goodbye', { $_hash: 'another_hash' }],
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        greeting: ['Hello world', { $_hash: 'existing_hash' }],
        farewell: ['Goodbye', { $_hash: 'another_hash' }],
      });
      expect(result.updateDictionary).toBe(false);
    });

    it('should return true when some entries need hashes', () => {
      const dictionary: Dictionary = {
        existing: ['Already has hash', { $_hash: 'existing' }],
        needsHash: 'Needs a hash',
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        existing: ['Already has hash', { $_hash: 'existing' }],
        needsHash: ['Needs a hash', { $_hash: 'hash_Needs a hash_none_needsHash' }],
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should return true when nested entries need hashes', () => {
      const dictionary: Dictionary = {
        section: {
          withHash: ['Has hash', { $_hash: 'existing' }],
          nested: {
            needsHash: 'Needs hash',
          },
        },
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        section: {
          withHash: ['Has hash', { $_hash: 'existing' }],
          nested: {
            needsHash: ['Needs hash', { $_hash: 'hash_Needs hash_none_section.nested.needsHash' }],
          },
        },
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should handle edge cases', () => {
    it('should handle empty dictionary', () => {
      const dictionary: Dictionary = {};

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({});
      expect(result.updateDictionary).toBe(false);
    });

    it('should handle dictionary with only non-entry values', () => {
      const dictionary: Dictionary = {
        section: {
          subsection: {
            deep: {},
          },
        },
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        section: {
          subsection: {
            deep: {},
          },
        },
      });
      expect(result.updateDictionary).toBe(false);
    });

    it('should handle mixed dictionary with empty objects and entries', () => {
      const dictionary: Dictionary = {
        empty: {},
        withEntry: {
          message: 'Hello world',
        },
        alsoEmpty: {
          nested: {},
        },
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary).toEqual({
        empty: {},
        withEntry: {
          message: ['Hello world', { $_hash: 'hash_Hello world_none_withEntry.message' }],
        },
        alsoEmpty: {
          nested: {},
        },
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should maintain dictionary reference', () => {
    it('should mutate the original dictionary object', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
      };
      const originalRef = dictionary;

      const result = injectHashes(dictionary);

      expect(result.dictionary).toBe(originalRef);
      expect(dictionary).toEqual({
        greeting: ['Hello world', { $_hash: 'hash_Hello world_none_greeting' }],
      });
    });

    it('should maintain nested object references', () => {
      const nestedObj = { message: 'Hello' };
      const dictionary: Dictionary = {
        section: nestedObj,
      };

      const result = injectHashes(dictionary);

      expect(result.dictionary.section).toBe(nestedObj);
      expect(nestedObj).toEqual({
        message: ['Hello', { $_hash: 'hash_Hello_none_section.message' }],
      });
    });
  });
});