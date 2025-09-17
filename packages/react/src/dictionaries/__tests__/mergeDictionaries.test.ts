import { describe, it, expect } from 'vitest';
import mergeDictionaries from '../mergeDictionaries';
import { Dictionary } from '../../types/types';

describe('mergeDictionaries', () => {
  describe('should merge primitive and array values correctly', () => {
    it('should merge simple string entries', () => {
      const defaultDict: Dictionary = {
        greeting: 'Hello',
        farewell: 'Goodbye',
      };
      const localeDict: Dictionary = {
        greeting: 'Hola',
        welcome: 'Bienvenido',
      };

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({
        greeting: 'Hola', // localeDict overwrites defaultDict
        farewell: 'Goodbye', // from defaultDict
        welcome: 'Bienvenido', // from localeDict
      });
    });

    it('should merge array-based dictionary entries', () => {
      const defaultDict: Dictionary = {
        message1: ['Hello world', { $context: 'greeting' }],
        message2: ['How are you?', { $context: 'question' }],
      };
      const localeDict: Dictionary = {
        message1: ['Hola mundo', { $context: 'greeting', $locale: 'es' }],
        message3: ['Adios', { $context: 'farewell' }],
      };

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({
        message1: ['Hola mundo', { $context: 'greeting', $locale: 'es' }],
        message2: ['How are you?', { $context: 'question' }],
        message3: ['Adios', { $context: 'farewell' }],
      });
    });

    it('should handle mixed primitive types and arrays', () => {
      const defaultDict: Dictionary = {
        simple: 'Simple text',
        withMetadata: ['Text with metadata', { $context: 'test' }],
      };
      const localeDict: Dictionary = {
        simple: ['Texto simple', { $context: 'simple' }],
        withMetadata: 'Texto con metadatos',
      };

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({
        simple: ['Texto simple', { $context: 'simple' }],
        withMetadata: 'Texto con metadatos',
      });
    });
  });

  describe('should merge nested dictionary structures recursively', () => {
    it('should merge simple nested dictionaries', () => {
      const defaultDict: Dictionary = {
        user: {
          name: 'John',
          age: 'Twenty-five',
        },
        settings: {
          theme: 'light',
          language: 'en',
        },
      };
      const localeDict: Dictionary = {
        user: {
          name: 'Juan',
          location: 'Madrid',
        },
        app: {
          name: 'Mi App',
        },
      };

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({
        user: {
          name: 'Juan', // overwritten
          age: 'Twenty-five', // from default
          location: 'Madrid', // from locale
        },
        settings: {
          theme: 'light',
          language: 'en',
        },
        app: {
          name: 'Mi App',
        },
      });
    });

    it('should handle deeply nested structures', () => {
      const defaultDict: Dictionary = {
        level1: {
          level2: {
            level3: {
              message: 'Deep message',
              data: 'Deep data',
            },
            sibling: 'Sibling value',
          },
        },
      };
      const localeDict: Dictionary = {
        level1: {
          level2: {
            level3: {
              message: 'Mensaje profundo',
              newField: 'Nuevo campo',
            },
            newSibling: 'Nuevo hermano',
          },
        },
      };

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              message: 'Mensaje profundo',
              data: 'Deep data',
              newField: 'Nuevo campo',
            },
            sibling: 'Sibling value',
            newSibling: 'Nuevo hermano',
          },
        },
      });
    });

    it('should merge mixed flat and nested structures', () => {
      const defaultDict: Dictionary = {
        flatMessage: 'Flat message',
        nested: {
          message: 'Nested message',
          data: ['Data with metadata', { $context: 'data' }],
        },
      };
      const localeDict: Dictionary = {
        flatMessage: ['Mensaje plano', { $context: 'flat' }],
        nested: {
          message: 'Mensaje anidado',
          newEntry: 'Nueva entrada',
        },
        newFlat: 'Nuevo plano',
      };

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({
        flatMessage: ['Mensaje plano', { $context: 'flat' }],
        newFlat: 'Nuevo plano',
        nested: {
          message: 'Mensaje anidado',
          data: ['Data with metadata', { $context: 'data' }],
          newEntry: 'Nueva entrada',
        },
      });
    });
  });

  describe('should handle edge cases correctly', () => {
    it('should handle empty dictionaries', () => {
      const defaultDict: Dictionary = {};
      const localeDict: Dictionary = {
        message: 'Hello',
      };

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({
        message: 'Hello',
      });
    });

    it('should handle both empty dictionaries', () => {
      const defaultDict: Dictionary = {};
      const localeDict: Dictionary = {};

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({});
    });

    it('should handle empty locale dictionary', () => {
      const defaultDict: Dictionary = {
        message: 'Hello',
        nested: {
          value: 'Nested value',
        },
      };
      const localeDict: Dictionary = {};

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({
        message: 'Hello',
        nested: {
          value: 'Nested value',
        },
      });
    });

    it('should handle undefined nested objects gracefully', () => {
      const defaultDict: Dictionary = {
        user: {
          name: 'John',
        },
      };
      const localeDict: Dictionary = {
        settings: {
          theme: 'dark',
        },
      };

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({
        user: {
          name: 'John',
        },
        settings: {
          theme: 'dark',
        },
      });
    });

    it('should not mutate original dictionaries', () => {
      const defaultDict: Dictionary = {
        message: 'Hello',
        nested: {
          value: 'Original',
        },
      };
      const localeDict: Dictionary = {
        message: 'Hola',
        nested: {
          newValue: 'Nuevo',
        },
      };
      
      const originalDefault = JSON.parse(JSON.stringify(defaultDict));
      const originalLocale = JSON.parse(JSON.stringify(localeDict));

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(defaultDict).toEqual(originalDefault);
      expect(localeDict).toEqual(originalLocale);
      expect(result).not.toBe(defaultDict);
      expect(result).not.toBe(localeDict);
    });

    it('should handle complex mixed types correctly', () => {
      const defaultDict: Dictionary = {
        strings: {
          hello: 'Hello',
          world: 'World',
        },
        arrays: {
          greeting: ['Hello World', { $context: 'greeting' }],
          farewell: ['Goodbye', { $context: 'farewell' }],
        },
      };
      const localeDict: Dictionary = {
        strings: {
          hello: 'Hola',
          goodbye: 'Adios',
        },
        arrays: {
          greeting: ['Hola Mundo', { $context: 'greeting', $locale: 'es' }],
          welcome: ['Bienvenido', { $context: 'welcome' }],
        },
        newSection: {
          message: 'Nuevo mensaje',
        },
      };

      const result = mergeDictionaries(defaultDict, localeDict);

      expect(result).toEqual({
        strings: {
          hello: 'Hola',
          world: 'World',
          goodbye: 'Adios',
        },
        arrays: {
          greeting: ['Hola Mundo', { $context: 'greeting', $locale: 'es' }],
          farewell: ['Goodbye', { $context: 'farewell' }],
          welcome: ['Bienvenido', { $context: 'welcome' }],
        },
        newSection: {
          message: 'Nuevo mensaje',
        },
      });
    });
  });
});