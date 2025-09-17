import { describe, it, expect } from 'vitest';
import { injectTranslations } from '../injectTranslations';
import { Dictionary, Translations } from '../../types/types';

describe('injectTranslations', () => {
  describe('should inject translations from translations object', () => {
    it('should inject translation using hash lookup', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
      };
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {
        hash123: 'Hola mundo',
      };
      const missingTranslations = [
        {
          source: 'Hello world',
          metadata: { $id: 'greeting', $_hash: 'hash123' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        greeting: 'Hola mundo',
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should inject multiple translations', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
      };
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {
        hello_hash: 'Hola',
        goodbye_hash: 'Adiós',
      };
      const missingTranslations = [
        {
          source: 'Hello',
          metadata: { $id: 'greeting', $_hash: 'hello_hash' },
        },
        {
          source: 'Goodbye',
          metadata: { $id: 'farewell', $_hash: 'goodbye_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        greeting: 'Hola',
        farewell: 'Adiós',
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should prefer hash lookup over existing translation in dictionary', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
      };
      const translationsDictionary: Dictionary = {
        greeting: 'Existing translation',
      };
      const translations: Translations = {
        hash123: 'Hash translation',
      };
      const missingTranslations = [
        {
          source: 'Hello world',
          metadata: { $id: 'greeting', $_hash: 'hash123' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        greeting: 'Hash translation',
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should prefer hash lookup over existing array-format translation', () => {
      const dictionary: Dictionary = {
        greeting: ['Hello {name}', { $context: 'personal' }],
      };
      const translationsDictionary: Dictionary = {
        greeting: ['Hola {name}', { $context: 'personal' }],
      };
      const translations: Translations = {
        hash456: 'Hash-based translation',
      };
      const missingTranslations = [
        {
          source: 'Hello {name}',
          metadata: {
            $id: 'greeting',
            $context: 'personal',
            $_hash: 'hash456',
          },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        greeting: 'Hash-based translation',
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should handle nested dictionary paths', () => {
    it('should inject translation into nested path', () => {
      const dictionary: Dictionary = {
        user: {
          profile: {
            name: 'Name',
          },
        },
      };
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {
        name_hash: 'Nombre',
      };
      const missingTranslations = [
        {
          source: 'Name',
          metadata: { $id: 'user.profile.name', $_hash: 'name_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        user: {
          profile: {
            name: 'Nombre',
          },
        },
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should handle deeply nested translations', () => {
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
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {
        home_hash: 'Accueil',
        about_hash: 'À propos',
      };
      const missingTranslations = [
        {
          source: 'Home',
          metadata: { $id: 'app.nav.menu.items.home', $_hash: 'home_hash' },
        },
        {
          source: 'About',
          metadata: { $id: 'app.nav.menu.items.about', $_hash: 'about_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        app: {
          nav: {
            menu: {
              items: {
                home: 'Accueil',
                about: 'À propos',
              },
            },
          },
        },
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should merge with existing nested translations', () => {
      const dictionary: Dictionary = {
        messages: {
          errors: {
            validation: 'Validation error',
            network: 'Network error',
          },
        },
      };
      const translationsDictionary: Dictionary = {
        messages: {
          errors: {
            validation: 'Error de validación',
          },
        },
      };
      const translations: Translations = {
        network_hash: 'Error de red',
      };
      const missingTranslations = [
        {
          source: 'Network error',
          metadata: { $id: 'messages.errors.network', $_hash: 'network_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        messages: {
          errors: {
            validation: 'Error de validación',
            network: 'Error de red',
          },
        },
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should handle missing translations gracefully', () => {
    it('should skip injection when hash not found and no existing translation', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello world',
      };
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {};
      const missingTranslations = [
        {
          source: 'Hello world',
          metadata: { $id: 'greeting', $_hash: 'nonexistent_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({});
      expect(result.updateDictionary).toBe(false);
    });

    it('should skip injection when no translation available', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
      };
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {
        hello_hash: 'Hola',
      };
      const missingTranslations = [
        {
          source: 'Hello',
          metadata: { $id: 'greeting', $_hash: 'hello_hash' },
        },
        {
          source: 'Goodbye',
          metadata: { $id: 'farewell', $_hash: 'missing_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        greeting: 'Hola',
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should handle partial translation scenarios', () => {
      const dictionary: Dictionary = {
        nav: {
          home: 'Home',
          about: 'About',
          contact: 'Contact',
        },
      };
      const translationsDictionary: Dictionary = {
        nav: {
          home: 'Accueil',
        },
      };
      const translations: Translations = {
        about_hash: 'À propos',
      };
      const missingTranslations = [
        {
          source: 'About',
          metadata: { $id: 'nav.about', $_hash: 'about_hash' },
        },
        {
          source: 'Contact',
          metadata: { $id: 'nav.contact', $_hash: 'missing_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        nav: {
          home: 'Accueil',
          about: 'À propos',
        },
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should handle entries with context metadata', () => {
    it('should inject translation for entry with context', () => {
      const dictionary: Dictionary = {
        submit: ['Submit', { $context: 'button' }],
      };
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {
        submit_hash: 'Enviar',
      };
      const missingTranslations = [
        {
          source: 'Submit',
          metadata: {
            $id: 'submit',
            $context: 'button',
            $_hash: 'submit_hash',
          },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        submit: 'Enviar',
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should handle mixed metadata scenarios', () => {
      const dictionary: Dictionary = {
        save: ['Save {item}', { $context: 'action' }],
        delete: 'Delete',
        confirm: [
          'Are you sure?',
          { $context: 'confirmation', $_hash: 'existing' },
        ],
      };
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {
        save_hash: 'Guardar {item}',
        delete_hash: 'Eliminar',
      };
      const missingTranslations = [
        {
          source: 'Save {item}',
          metadata: { $id: 'save', $context: 'action', $_hash: 'save_hash' },
        },
        {
          source: 'Delete',
          metadata: { $id: 'delete', $_hash: 'delete_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        save: 'Guardar {item}',
        delete: 'Eliminar',
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should return correct updateDictionary flag', () => {
    it('should return false when no translations are injected', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
      };
      const translationsDictionary: Dictionary = {
        existing: 'Existing value',
      };
      const translations: Translations = {};
      const missingTranslations = [
        {
          source: 'Hello',
          metadata: { $id: 'greeting', $_hash: 'missing_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        existing: 'Existing value',
      });
      expect(result.updateDictionary).toBe(false);
    });

    it('should return true when at least one translation is injected', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
      };
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {
        hello_hash: 'Hola',
      };
      const missingTranslations = [
        {
          source: 'Hello',
          metadata: { $id: 'greeting', $_hash: 'hello_hash' },
        },
        {
          source: 'Goodbye',
          metadata: { $id: 'farewell', $_hash: 'missing_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        greeting: 'Hola',
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should return true when all translations are injected', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
      };
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {
        hello_hash: 'Hola',
        goodbye_hash: 'Adiós',
      };
      const missingTranslations = [
        {
          source: 'Hello',
          metadata: { $id: 'greeting', $_hash: 'hello_hash' },
        },
        {
          source: 'Goodbye',
          metadata: { $id: 'farewell', $_hash: 'goodbye_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        greeting: 'Hola',
        farewell: 'Adiós',
      });
      expect(result.updateDictionary).toBe(true);
    });
  });

  describe('should handle edge cases', () => {
    it('should handle empty missing translations array', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
      };
      const translationsDictionary: Dictionary = {
        existing: 'Existing',
      };
      const translations: Translations = {
        hash: 'Translation',
      };
      const missingTranslations: any[] = [];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        existing: 'Existing',
      });
      expect(result.updateDictionary).toBe(false);
    });

    it('should handle empty translations object', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
      };
      const translationsDictionary: Dictionary = {};
      const translations: Translations = {};
      const missingTranslations = [
        {
          source: 'Hello',
          metadata: { $id: 'greeting', $_hash: 'any_hash' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({});
      expect(result.updateDictionary).toBe(false);
    });

    it('should maintain reference to translationsDictionary', () => {
      const dictionary: Dictionary = {
        greeting: 'Hello',
      };
      const translationsDictionary: Dictionary = {
        existing: 'Existing',
      };
      const translations: Translations = {
        hash123: 'Hola',
      };
      const missingTranslations = [
        {
          source: 'Hello',
          metadata: { $id: 'greeting', $_hash: 'hash123' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toBe(translationsDictionary);
      expect(result.dictionary).toEqual({
        existing: 'Existing',
        greeting: 'Hola',
      });
    });
  });

  describe('should handle complex real-world scenarios', () => {
    it('should handle mixed translation sources', () => {
      const dictionary: Dictionary = {
        ui: {
          buttons: {
            save: 'Save',
            cancel: 'Cancel',
            delete: 'Delete',
          },
          messages: {
            success: ['Operation successful', { $context: 'notification' }],
            error: 'An error occurred',
          },
        },
      };
      const translationsDictionary: Dictionary = {
        ui: {
          buttons: {
            cancel: 'Cancelar', // existing translation
          },
        },
      };
      const translations: Translations = {
        save_hash: 'Guardar',
        success_hash: 'Operación exitosa',
      };
      const missingTranslations = [
        {
          source: 'Save',
          metadata: { $id: 'ui.buttons.save', $_hash: 'save_hash' },
        },
        {
          source: 'Delete',
          metadata: { $id: 'ui.buttons.delete', $_hash: 'missing_hash' },
        },
        {
          source: 'Operation successful',
          metadata: {
            $id: 'ui.messages.success',
            $context: 'notification',
            $_hash: 'success_hash',
          },
        },
        {
          source: 'An error occurred',
          metadata: { $id: 'ui.messages.error', $_hash: 'error_missing' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      expect(result.dictionary).toEqual({
        ui: {
          buttons: {
            cancel: 'Cancelar',
            save: 'Guardar',
          },
          messages: {
            success: 'Operación exitosa',
          },
        },
      });
      expect(result.updateDictionary).toBe(true);
    });

    it('should handle translation priority correctly', () => {
      const dictionary: Dictionary = {
        message: 'Hello world',
      };
      const translationsDictionary: Dictionary = {
        message: ['Hola mundo', { $context: 'greeting' }], // existing translation
      };
      const translations: Translations = {
        hash123: 'Translation from hash', // hash-based translation
      };
      const missingTranslations = [
        {
          source: 'Hello world',
          metadata: { $id: 'message', $_hash: 'hash123' },
        },
      ];

      const result = injectTranslations(
        dictionary,
        translationsDictionary,
        translations,
        missingTranslations
      );

      // Should prefer hash-based translation over existing
      expect(result.dictionary).toEqual({
        message: 'Translation from hash',
      });
      expect(result.updateDictionary).toBe(true);
    });
  });
});
