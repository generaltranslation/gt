import { describe, it, expect } from 'vitest';
import { injectFallbacks } from '../injectFallbacks';
import { Dictionary } from '../../types/types';

describe('injectFallbacks', () => {
  describe('should inject fallbacks for missing translations', () => {
    it('should inject source text when no translation exists', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
      };
      const translationsDictionary: Dictionary = {};
      const missingTranslations = [
        {
          source: 'Hello world',
          metadata: { $id: 'greeting', $_hash: 'abc123' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        greeting: 'Hello world',
      });
    });

    it('should use existing translation when available', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
      };
      const translationsDictionary: Dictionary = {
        greeting: 'Hola mundo',
      };
      const missingTranslations = [
        {
          source: 'Hello world',
          metadata: { $id: 'greeting', $_hash: 'abc123' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        greeting: 'Hola mundo',
      });
    });

    it('should use array-format translation when available', () => {
      const dictionary: Dictionary = {
        greeting: ['Hello {name}', { $context: 'personal' }],
      };
      const translationsDictionary: Dictionary = {
        greeting: ['Hola {name}', { $context: 'personal' }],
      };
      const missingTranslations = [
        {
          source: 'Hello {name}',
          metadata: { $id: 'greeting', $context: 'personal', $_hash: 'def456' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        greeting: 'Hola {name}',
      });
    });

    it('should handle multiple missing translations', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
        welcome: 'Welcome',
      };
      const translationsDictionary: Dictionary = {
        greeting: 'Hola',
      };
      const missingTranslations = [
        {
          source: 'Goodbye',
          metadata: { $id: 'farewell', $_hash: 'xyz789' },
        },
        {
          source: 'Welcome',
          metadata: { $id: 'welcome', $_hash: 'qwe456' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        greeting: 'Hola',
        farewell: 'Goodbye',
        welcome: 'Welcome',
      });
    });
  });

  describe('should handle nested dictionary paths', () => {
    it('should inject fallback into nested path', () => {
      const dictionary: Dictionary = {
        user: {
          profile: {
            name: 'Name',
            email: 'Email',
          },
        },
      };
      const translationsDictionary: Dictionary = {
        user: {
          profile: {
            name: 'Nombre',
          },
        },
      };
      const missingTranslations = [
        {
          source: 'Email',
          metadata: { $id: 'user.profile.email', $_hash: 'email123' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        user: {
          profile: {
            name: 'Nombre',
            email: 'Email',
          },
        },
      });
    });

    it('should create nested structure when missing', () => {
      const dictionary: Dictionary = {
        messages: {
          errors: {
            validation: 'Validation failed',
          },
        },
      };
      const translationsDictionary: Dictionary = {};
      const missingTranslations = [
        {
          source: 'Validation failed',
          metadata: { $id: 'messages.errors.validation', $_hash: 'val456' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        messages: {
          errors: {
            validation: 'Validation failed',
          },
        },
      });
    });

    it('should handle deeply nested missing translations', () => {
      const dictionary: Dictionary = {
        app: {
          ui: {
            forms: {
              labels: {
                firstName: 'First Name',
                lastName: 'Last Name',
              },
            },
          },
        },
      };
      const translationsDictionary: Dictionary = {
        app: {
          ui: {
            forms: {
              labels: {
                firstName: 'Prénom',
              },
            },
          },
        },
      };
      const missingTranslations = [
        {
          source: 'Last Name',
          metadata: { $id: 'app.ui.forms.labels.lastName', $_hash: 'last789' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        app: {
          ui: {
            forms: {
              labels: {
                firstName: 'Prénom',
                lastName: 'Last Name',
              },
            },
          },
        },
      });
    });
  });

  describe('should handle entries with context metadata', () => {
    it('should inject fallback for entry with context', () => {
      const dictionary: Dictionary = {
        submit: ['Submit', { $context: 'button' }],
      };
      const translationsDictionary: Dictionary = {};
      const missingTranslations = [
        {
          source: 'Submit',
          metadata: { $id: 'submit', $context: 'button', $_hash: 'sub123' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        submit: 'Submit',
      });
    });

    it('should prefer translation with context over fallback', () => {
      const dictionary: Dictionary = {
        cancel: ['Cancel', { $context: 'button' }],
      };
      const translationsDictionary: Dictionary = {
        cancel: ['Cancelar', { $context: 'button' }],
      };
      const missingTranslations = [
        {
          source: 'Cancel',
          metadata: { $id: 'cancel', $context: 'button', $_hash: 'can456' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        cancel: 'Cancelar',
      });
    });

    it('should handle mixed metadata scenarios', () => {
      const dictionary: Dictionary = {
        save: ['Save {item}', { $context: 'action', $_hash: 'save789' }],
        delete: 'Delete',
      };
      const translationsDictionary: Dictionary = {};
      const missingTranslations = [
        {
          source: 'Save {item}',
          metadata: { $id: 'save', $context: 'action', $_hash: 'save789' },
        },
        {
          source: 'Delete',
          metadata: { $id: 'delete', $_hash: 'del123' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        save: 'Save {item}',
        delete: 'Delete',
      });
    });
  });

  describe('should handle edge cases and complex scenarios', () => {
    it('should handle empty missing translations array', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
      };
      const translationsDictionary: Dictionary = {
        greeting: 'Hola',
      };
      const missingTranslations: any[] = [];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        greeting: 'Hola',
      });
    });

    it('should handle empty translations dictionary', () => {
      const dictionary: Dictionary = {
        message1: 'Message 1',
        message2: 'Message 2',
      };
      const translationsDictionary: Dictionary = {};
      const missingTranslations = [
        {
          source: 'Message 1',
          metadata: { $id: 'message1', $_hash: 'msg1' },
        },
        {
          source: 'Message 2',
          metadata: { $id: 'message2', $_hash: 'msg2' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        message1: 'Message 1',
        message2: 'Message 2',
      });
    });

    it('should maintain reference to translationsDictionary', () => {
      const dictionary: Dictionary = {
        test: 'Test value',
      };
      const translationsDictionary: Dictionary = {
        existing: 'Existing value',
      };
      const missingTranslations = [
        {
          source: 'Test value',
          metadata: { $id: 'test', $_hash: 'test123' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toBe(translationsDictionary);
      expect(result).toEqual({
        existing: 'Existing value',
        test: 'Test value',
      });
    });
  });

  describe('should handle complex real-world scenarios', () => {
    it('should handle mixed translation states', () => {
      const dictionary: Dictionary = {
        nav: {
          home: 'Home',
          about: 'About',
          contact: 'Contact',
        },
        forms: {
          name: ['Name', { $context: 'form-label' }],
          email: ['Email', { $context: 'form-label' }],
          submit: ['Submit Form', { $context: 'button' }],
        },
      };
      const translationsDictionary: Dictionary = {
        nav: {
          home: 'Accueil',
          about: 'À propos',
        },
        forms: {
          name: ['Nom', { $context: 'form-label' }],
        },
      };
      const missingTranslations = [
        {
          source: 'Contact',
          metadata: { $id: 'nav.contact', $_hash: 'contact1' },
        },
        {
          source: 'Email',
          metadata: {
            $id: 'forms.email',
            $context: 'form-label',
            $_hash: 'email2',
          },
        },
        {
          source: 'Submit Form',
          metadata: {
            $id: 'forms.submit',
            $context: 'button',
            $_hash: 'submit3',
          },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        nav: {
          home: 'Accueil',
          about: 'À propos',
          contact: 'Contact',
        },
        forms: {
          name: ['Nom', { $context: 'form-label' }],
          email: 'Email',
          submit: 'Submit Form',
        },
      });
    });

    it('should handle overwriting existing fallback with better translation', () => {
      const dictionary: Dictionary = {
        title: 'Page Title',
        subtitle: 'Page Subtitle',
      };
      const translationsDictionary: Dictionary = {
        title: 'Fallback Title',
        subtitle: 'Proper Translation',
      };
      const missingTranslations = [
        {
          source: 'Page Title',
          metadata: { $id: 'title', $_hash: 'title1' },
        },
        {
          source: 'Page Subtitle',
          metadata: { $id: 'subtitle', $_hash: 'sub1' },
        },
      ];

      const result = injectFallbacks(
        dictionary,
        translationsDictionary,
        missingTranslations
      );

      expect(result).toEqual({
        title: 'Fallback Title',
        subtitle: 'Proper Translation',
      });
    });
  });
});
