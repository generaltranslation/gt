import { describe, it, expect, vi } from 'vitest';
import { constructTranslationSubtree } from '../constructTranslationSubtree';
import { Dictionary, Translations } from '../../types/types';

// Mock the hashSource function from generaltranslation/id
vi.mock('generaltranslation/id', () => ({
  hashSource: vi.fn(({ source, context, id }) => `hash_${source}_${context || 'default'}_${id}`),
}));

describe('constructTranslationSubtree', () => {
  describe('should handle simple dictionary entries', () => {
    it('should inject hash and collect untranslated string entry', () => {
      const subtree: Dictionary = {
        greeting: 'Hello World',
      };
      const translationSubtree: Dictionary = {};
      const translations: Translations = {};

      const result = constructTranslationSubtree(subtree, translationSubtree, translations);

      expect(subtree).toEqual({
        greeting: ['Hello World', { $_hash: 'hash_Hello World_default_greeting' }],
      });
      expect(translationSubtree).toEqual({
        greeting: 'Hello World',
      });
      expect(result.untranslatedEntries).toEqual([
        {
          source: 'Hello World',
          metadata: {
            $id: 'greeting',
            $context: undefined,
            $_hash: 'hash_Hello World_default_greeting',
          },
        },
      ]);
    });

    it('should handle array entry with metadata', () => {
      const subtree: Dictionary = {
        welcome: ['Welcome back', { $context: 'greeting' }],
      };
      const translationSubtree: Dictionary = {};
      const translations: Translations = {};

      const result = constructTranslationSubtree(subtree, translationSubtree, translations);

      expect(subtree).toEqual({
        welcome: ['Welcome back', { $context: 'greeting', $_hash: 'hash_Welcome back_greeting_welcome' }],
      });
      expect(translationSubtree).toEqual({
        welcome: 'Welcome back',
      });
      expect(result.untranslatedEntries).toEqual([
        {
          source: 'Welcome back',
          metadata: {
            $id: 'welcome',
            $context: 'greeting',
            $_hash: 'hash_Welcome back_greeting_welcome',
          },
        },
      ]);
    });

    it('should use existing translation when available', () => {
      const subtree: Dictionary = {
        greeting: ['Hello World', { $_hash: 'existing_hash' }],
      };
      const translationSubtree: Dictionary = {};
      const translations: Translations = {
        existing_hash: 'Hola Mundo',
      };

      const result = constructTranslationSubtree(subtree, translationSubtree, translations);

      expect(translationSubtree).toEqual({
        greeting: 'Hola Mundo',
      });
      // Note: The implementation still adds to untranslated entries if translationSubtree[key] doesn't exist,
      // even when a translation is found in the translations object
      expect(result.untranslatedEntries).toEqual([
        {
          source: 'Hello World',
          metadata: {
            $id: 'greeting',
            $context: undefined,
            $_hash: 'existing_hash',
          },
        },
      ]);
    });

    it('should use existing translation subtree entry when available', () => {
      const subtree: Dictionary = {
        greeting: 'Hello World',
      };
      const translationSubtree: Dictionary = {
        greeting: 'Bonjour Monde',
      };
      const translations: Translations = {};

      const result = constructTranslationSubtree(subtree, translationSubtree, translations);

      expect(translationSubtree).toEqual({
        greeting: 'Bonjour Monde',
      });
      expect(result.untranslatedEntries).toEqual([]);
    });
  });

  describe('should handle nested dictionary structures', () => {
    it('should process nested dictionaries recursively', () => {
      const subtree: Dictionary = {
        user: {
          profile: {
            name: 'John Doe',
            bio: 'Software developer',
          },
        },
        messages: {
          welcome: 'Welcome!',
        },
      };
      const translationSubtree: Dictionary = {};
      const translations: Translations = {};

      const result = constructTranslationSubtree(subtree, translationSubtree, translations);

      expect(subtree.user.profile).toEqual({
        name: ['John Doe', { $_hash: 'hash_John Doe_default_user.profile.name' }],
        bio: ['Software developer', { $_hash: 'hash_Software developer_default_user.profile.bio' }],
      });
      expect(translationSubtree).toEqual({
        user: {
          profile: {
            name: 'John Doe',
            bio: 'Software developer',
          },
        },
        messages: {
          welcome: 'Welcome!',
        },
      });
      expect(result.untranslatedEntries).toHaveLength(3);
      expect(result.untranslatedEntries).toContainEqual({
        source: 'John Doe',
        metadata: {
          $id: 'user.profile.name',
          $context: undefined,
          $_hash: 'hash_John Doe_default_user.profile.name',
        },
      });
    });

    it('should handle mixed nested structure with existing translations', () => {
      const subtree: Dictionary = {
        user: {
          name: 'John',
          settings: {
            theme: 'dark',
          },
        },
      };
      const translationSubtree: Dictionary = {
        user: {
          settings: {
            theme: 'oscuro',
          },
        },
      };
      const translations: Translations = {};

      const result = constructTranslationSubtree(subtree, translationSubtree, translations);

      expect(translationSubtree).toEqual({
        user: {
          name: 'John',
          settings: {
            theme: 'oscuro',
          },
        },
      });
      expect(result.untranslatedEntries).toEqual([
        {
          source: 'John',
          metadata: {
            $id: 'user.name',
            $context: undefined,
            $_hash: 'hash_John_default_user.name',
          },
        },
      ]);
    });
  });

  describe('should handle id parameter correctly', () => {
    it('should use provided id as prefix', () => {
      const subtree: Dictionary = {
        greeting: 'Hello',
      };
      const translationSubtree: Dictionary = {};
      const translations: Translations = {};
      const id = 'app.messages';

      const result = constructTranslationSubtree(subtree, translationSubtree, translations, id);

      expect(result.untranslatedEntries[0].metadata.$id).toBe('app.messages.greeting');
      expect(subtree).toEqual({
        greeting: ['Hello', { $_hash: 'hash_Hello_default_app.messages.greeting' }],
      });
    });
  });

  describe('should handle edge cases', () => {
    it('should handle empty subtree', () => {
      const subtree: Dictionary = {};
      const translationSubtree: Dictionary = {};
      const translations: Translations = {};

      const result = constructTranslationSubtree(subtree, translationSubtree, translations);

      expect(result.untranslatedEntries).toEqual([]);
      expect(translationSubtree).toEqual({});
    });

    it('should not modify entries that already have hash', () => {
      const subtree: Dictionary = {
        greeting: ['Hello', { $context: 'greeting', $_hash: 'existing_hash' }],
      };
      const translationSubtree: Dictionary = {};
      const translations: Translations = {};

      constructTranslationSubtree(subtree, translationSubtree, translations);

      expect(subtree).toEqual({
        greeting: ['Hello', { $context: 'greeting', $_hash: 'existing_hash' }],
      });
    });

    it('should handle array entry without metadata', () => {
      const subtree: Dictionary = {
        simple: ['Simple text'],
      };
      const translationSubtree: Dictionary = {};
      const translations: Translations = {};

      const result = constructTranslationSubtree(subtree, translationSubtree, translations);

      expect(subtree).toEqual({
        simple: ['Simple text', { $_hash: 'hash_Simple text_default_simple' }],
      });
      expect(result.untranslatedEntries).toHaveLength(1);
    });
  });
});