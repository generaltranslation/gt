import { describe, it, expect } from 'vitest';
import { collectUntranslatedEntries } from '../collectUntranslatedEntries';
import { Dictionary } from '../../types/types';

describe('collectUntranslatedEntries', () => {
  describe('should collect simple untranslated entries', () => {
    it('should return untranslated entry when key missing from translations', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
      };
      const translations: Dictionary = {};

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([
        {
          source: 'Hello world',
          metadata: {
            $id: 'greeting',
            $context: undefined,
            $_hash: '',
          },
        },
      ]);
    });

    it('should return empty array when all entries are translated', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
        farewell: 'Goodbye',
      };
      const translations: Dictionary = {
        greeting: 'Hola mundo',
        farewell: 'Adiós',
      };

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([]);
    });

    it('should collect multiple untranslated entries', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
        farewell: 'Goodbye',
        welcome: 'Welcome',
      };
      const translations: Dictionary = {
        greeting: 'Hola mundo',
      };

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([
        {
          source: 'Goodbye',
          metadata: {
            $id: 'farewell',
            $context: undefined,
            $_hash: '',
          },
        },
        {
          source: 'Welcome',
          metadata: {
            $id: 'welcome',
            $context: undefined,
            $_hash: '',
          },
        },
      ]);
    });
  });

  describe('should handle array-based dictionary entries', () => {
    it('should collect untranslated entry with metadata', () => {
      const dictionary: Dictionary = {
        greeting: [
          'Hello {name}',
          { $context: 'personal-greeting', $_hash: 'abc123' },
        ],
      };
      const translations: Dictionary = {};

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([
        {
          source: 'Hello {name}',
          metadata: {
            $id: 'greeting',
            $context: 'personal-greeting',
            $_hash: 'abc123',
          },
        },
      ]);
    });

    it('should collect untranslated entry with partial metadata', () => {
      const dictionary: Dictionary = {
        greeting: ['Hello world', { $context: 'greeting' }],
      };
      const translations: Dictionary = {};

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([
        {
          source: 'Hello world',
          metadata: {
            $id: 'greeting',
            $context: 'greeting',
            $_hash: '',
          },
        },
      ]);
    });

    it('should handle array entry without metadata', () => {
      const dictionary: Dictionary = {
        greeting: ['Hello world'],
      };
      const translations: Dictionary = {};

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([
        {
          source: 'Hello world',
          metadata: {
            $id: 'greeting',
            $context: undefined,
            $_hash: '',
          },
        },
      ]);
    });
  });

  describe('should handle nested dictionaries', () => {
    it('should collect untranslated entries from nested structure', () => {
      const dictionary: Dictionary = {
        user: {
          profile: {
            name: 'Name',
            bio: 'Biography',
          },
        },
        settings: {
          theme: 'Theme',
        },
      };
      const translations: Dictionary = {
        user: {
          profile: {
            name: 'Nombre',
          },
        },
      };

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([
        {
          source: 'Biography',
          metadata: {
            $id: 'user.profile.bio',
            $context: undefined,
            $_hash: '',
          },
        },
        {
          source: 'Theme',
          metadata: {
            $id: 'settings.theme',
            $context: undefined,
            $_hash: '',
          },
        },
      ]);
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
      const translations: Dictionary = {
        app: {
          nav: {
            menu: {
              items: {
                home: 'Inicio',
              },
            },
          },
        },
      };

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([
        {
          source: 'About',
          metadata: {
            $id: 'app.nav.menu.items.about',
            $context: undefined,
            $_hash: '',
          },
        },
      ]);
    });

    it('should handle missing nested translation structure', () => {
      const dictionary: Dictionary = {
        user: {
          name: 'Name',
          email: 'Email',
        },
      };
      const translations: Dictionary = {};

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([
        {
          source: 'Name',
          metadata: {
            $id: 'user.name',
            $context: undefined,
            $_hash: '',
          },
        },
        {
          source: 'Email',
          metadata: {
            $id: 'user.email',
            $context: undefined,
            $_hash: '',
          },
        },
      ]);
    });
  });

  describe('should handle mixed entry types', () => {
    it('should handle mix of strings and arrays in nested structure', () => {
      const dictionary: Dictionary = {
        messages: {
          greeting: 'Hello',
          welcome: ['Welcome {name}', { $context: 'personalized' }],
          info: {
            title: 'Information',
            content: ['Important notice', { $_hash: 'def456' }],
          },
        },
      };
      const translations: Dictionary = {
        messages: {
          greeting: 'Hola',
        },
      };

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([
        {
          source: 'Welcome {name}',
          metadata: {
            $id: 'messages.welcome',
            $context: 'personalized',
            $_hash: '',
          },
        },
        {
          source: 'Information',
          metadata: {
            $id: 'messages.info.title',
            $context: undefined,
            $_hash: '',
          },
        },
        {
          source: 'Important notice',
          metadata: {
            $id: 'messages.info.content',
            $context: undefined,
            $_hash: 'def456',
          },
        },
      ]);
    });
  });

  describe('should handle custom id parameter', () => {
    it('should use custom id as prefix for entry ids', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
      };
      const translations: Dictionary = {};

      const result = collectUntranslatedEntries(
        dictionary,
        translations,
        'custom'
      );

      expect(result).toEqual([
        {
          source: 'Hello',
          metadata: {
            $id: 'custom.greeting',
            $context: undefined,
            $_hash: '',
          },
        },
        {
          source: 'Goodbye',
          metadata: {
            $id: 'custom.farewell',
            $context: undefined,
            $_hash: '',
          },
        },
      ]);
    });

    it('should handle nested structure with custom id', () => {
      const dictionary: Dictionary = {
        user: {
          name: 'Name',
        },
      };
      const translations: Dictionary = {};

      const result = collectUntranslatedEntries(
        dictionary,
        translations,
        'app'
      );

      expect(result).toEqual([
        {
          source: 'Name',
          metadata: {
            $id: 'app.user.name',
            $context: undefined,
            $_hash: '',
          },
        },
      ]);
    });
  });

  describe('should handle edge cases', () => {
    it('should handle empty dictionaries', () => {
      const dictionary: Dictionary = {};
      const translations: Dictionary = {};

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([]);
    });

    it('should handle empty source dictionary with translations', () => {
      const dictionary: Dictionary = {};
      const translations: Dictionary = {
        greeting: 'Hello',
      };

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([]);
    });

    it('should handle mixed translated and untranslated nested entries', () => {
      const dictionary: Dictionary = {
        section1: {
          item1: 'Item 1',
          item2: 'Item 2',
        },
        section2: {
          item3: 'Item 3',
        },
      };
      const translations: Dictionary = {
        section1: {
          item1: 'Artículo 1',
        },
        section2: {},
      };

      const result = collectUntranslatedEntries(dictionary, translations);

      expect(result).toEqual([
        {
          source: 'Item 2',
          metadata: {
            $id: 'section1.item2',
            $context: undefined,
            $_hash: '',
          },
        },
        {
          source: 'Item 3',
          metadata: {
            $id: 'section2.item3',
            $context: undefined,
            $_hash: '',
          },
        },
      ]);
    });
  });
});
