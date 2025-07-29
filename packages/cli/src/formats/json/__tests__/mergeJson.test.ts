import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mergeJson, applyTransformations } from '../mergeJson';
import { readFileSync } from 'fs';
import path from 'path';
import { logError, logWarning, exit } from '../../../console/logging.js';

vi.mock('../../../console/logging.js');
const mockLogError = vi.mocked(logError);
const mockLogWarning = vi.mocked(logWarning);
const mockExit = vi.mocked(exit).mockImplementation(() => {
  throw new Error('Process exit called');
});

describe('mergeJson', () => {
  beforeEach(() => {
    mockLogError.mockClear();
    mockLogWarning.mockClear();
    mockExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Include Schema Tests', () => {
    it('should merge translated content with original JSON using include schema', () => {
      const originalContent = JSON.stringify({
        title: 'English Title',
        description: 'English Description',
        metadata: {
          author: 'John Doe',
          version: '1.0.0',
        },
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/title': 'Título Español',
            '/description': 'Descripción Española',
          }),
          targetLocale: 'es',
        },
        {
          translatedContent: JSON.stringify({
            '/title': 'Titre Français',
            '/description': 'Description Française',
          }),
          targetLocale: 'fr',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.title', '$.description'],
            },
          },
        },
        targets,
        'en'
      );

      expect(result).toHaveLength(2);

      const spanishResult = JSON.parse(result[0]);
      expect(spanishResult.title).toBe('Título Español');
      expect(spanishResult.description).toBe('Descripción Española');
      expect(spanishResult.metadata.author).toBe('John Doe'); // Preserved from original
      expect(spanishResult.metadata.version).toBe('1.0.0'); // Preserved from original

      const frenchResult = JSON.parse(result[1]);
      expect(frenchResult.title).toBe('Titre Français');
      expect(frenchResult.description).toBe('Description Française');
      expect(frenchResult.metadata.author).toBe('John Doe'); // Preserved from original
    });

    it('should handle nested JSON pointers in include schema', () => {
      const originalContent = JSON.stringify({
        app: {
          ui: {
            buttons: {
              save: 'Save',
              cancel: 'Cancel',
            },
          },
        },
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/app/ui/buttons/save': 'Guardar',
            '/app/ui/buttons/cancel': 'Cancelar',
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.app.ui.buttons.*'],
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.app.ui.buttons.save).toBe('Guardar');
      expect(parsed.app.ui.buttons.cancel).toBe('Cancelar');
    });

    it('should ignore invalid JSON pointers in include schema', () => {
      const originalContent = JSON.stringify({
        title: 'English Title',
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/title': 'Título Español',
            '/invalid/path': 'Invalid Value',
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.title'],
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.title).toBe('Título Español');
      expect(parsed.invalid).toBeUndefined();
    });
  });

  describe('No Schema Tests', () => {
    it('should return stringified translated content when no schema matches', () => {
      const originalContent = JSON.stringify({ test: 'value' });
      const targets = [
        {
          translatedContent: JSON.stringify({ translated: 'contenido' }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'file.txt', // doesn't match any schema
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.test'],
            },
          },
        },
        targets,
        'en'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('{"translated":"contenido"}');
    });

    it('should return stringified translated content when no jsonSchema option provided', () => {
      const originalContent = JSON.stringify({ test: 'value' });
      const targets = [
        {
          translatedContent: JSON.stringify({ translated: 'contenido' }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {}, // no jsonSchema
        targets,
        'en'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('{"translated":"contenido"}');
    });
  });

  describe('Composite Schema Array Type Tests', () => {
    it('should merge array composite schema with translated content', () => {
      const originalContent = JSON.stringify({
        items: [
          { locale: 'en', title: 'English Title', desc: 'English Description' },
          {
            locale: 'es',
            title: 'Título Español',
            desc: 'Descripción Española',
          },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': {
                '/title': 'Nouveau Titre',
                '/desc': 'Nouvelle Description',
              },
            },
          }),
          targetLocale: 'fr',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.title', '$.desc'],
                  key: '$.locale',
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.items).toHaveLength(3);

      // English item should be unchanged
      const englishItem = parsed.items.find(
        (item: any) => item.locale === 'en'
      );
      expect(englishItem.title).toBe('English Title');
      expect(englishItem.desc).toBe('English Description');

      // Spanish item should remain unchanged
      const spanishItem = parsed.items.find(
        (item: any) => item.locale === 'es'
      );
      expect(spanishItem.title).toBe('Título Español');
      expect(spanishItem.desc).toBe('Descripción Española');

      // French item should be updated with French translations
      const frenchItem = parsed.items.find((item: any) => item.locale === 'fr');
      expect(frenchItem.title).toBe('Nouveau Titre');
      expect(frenchItem.desc).toBe('Nouvelle Description');
    });

    it('should overwrite existing target locale item when available', () => {
      const originalContent = JSON.stringify({
        items: [
          { locale: 'en', title: 'English Title' },
          { locale: 'fr', title: 'Titre Français Original' },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': {
                '/title': 'Titre Français Traduit',
              },
            },
          }),
          targetLocale: 'fr',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.title'],
                  key: '$.locale',
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      const frenchItem = parsed.items.find((item: any) => item.locale === 'fr');
      expect(frenchItem.title).toBe('Titre Français Traduit');
    });

    it('should overwrite multiple target locale items when available', () => {
      const originalContent = JSON.stringify({
        items: [
          { locale: 'en', title: 'English Title' },
          { locale: 'fr', title: 'Titre Français Original' },
          { locale: 'en', title: 'English Phrase' },
          { locale: 'fr', title: 'Titre Français Phrase1' },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': {
                '/title': 'Titre Français Traduit',
              },
              '/2': {
                '/title': 'Titre Français Phrase2',
              },
            },
          }),
          targetLocale: 'fr',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.title'],
                  key: '$.locale',
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      const frenchItems = parsed.items.filter(
        (item: any) => item.locale === 'fr'
      );
      expect(frenchItems).toHaveLength(2);
      expect(frenchItems[0].title).toBe('Titre Français Traduit');
      expect(frenchItems[1].title).toBe('Titre Français Phrase2');
    });

    it('should handle nested key paths in array type', () => {
      const originalContent = JSON.stringify({
        items: [
          { meta: { locale: 'en' }, title: 'English Title' },
          { meta: { locale: 'es' }, title: 'Título Español' },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': {
                '/title': 'Titre Français',
              },
            },
          }),
          targetLocale: 'fr',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.title'],
                  key: '$.meta.locale',
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      const englishItem = parsed.items.find(
        (item: any) => item.meta.locale === 'en'
      );
      const spanishItem = parsed.items.find(
        (item: any) => item.meta.locale === 'es'
      );
      const frenchItem = parsed.items.find(
        (item: any) => item.meta.locale === 'fr'
      );
      expect(englishItem.title).toBe('English Title');
      expect(spanishItem.title).toBe('Título Español');
      expect(frenchItem.title).toBe('Titre Français');
      expect(englishItem.meta.locale).toBe('en');
      expect(spanishItem.meta.locale).toBe('es');
      expect(frenchItem.meta.locale).toBe('fr');
    });

    it('should skip target when there is no transform and translated content missing sourceObjectPointer for array', () => {
      const originalContent = JSON.stringify({
        items: [{ locale: 'en', title: 'English Title' }],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/different/path': {
              '/0': {
                '/title': 'Título Español',
              },
            },
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.title'],
                  key: '$.locale',
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        'Translated JSON for locale: es does not have a valid sourceObjectPointer: /items. Skipping this target'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.items[0].title).toBe('English Title'); // Unchanged
    });
  });

  describe('Composite Schema Object Type Tests', () => {
    it('should merge object composite schema with translated content', () => {
      const originalContent = JSON.stringify({
        translations: {
          en: { title: 'English Title', desc: 'English Description' },
          es: { title: 'Título Español', desc: 'Descripción Española' },
        },
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/translations': {
              '/title': 'Titre Français',
              '/desc': 'Description Française',
            },
          }),
          targetLocale: 'fr',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.translations': {
                  type: 'object',
                  include: ['$.title', '$.desc'],
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.translations.en.title).toBe('English Title');
      expect(parsed.translations.en.desc).toBe('English Description');
      expect(parsed.translations.es.title).toBe('Título Español');
      expect(parsed.translations.es.desc).toBe('Descripción Española');
      expect(parsed.translations.fr.title).toBe('Titre Français');
      expect(parsed.translations.fr.desc).toBe('Description Française');
    });

    it('should use existing target locale object when available', () => {
      const originalContent = JSON.stringify({
        translations: {
          en: { title: 'English Title' },
          fr: { title: 'Titre Français Original' },
        },
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/translations': {
              '/title': 'Titre Français Traduit',
            },
          }),
          targetLocale: 'fr',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.translations': {
                  type: 'object',
                  include: ['$.title'],
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.translations.fr.title).toBe('Titre Français Traduit');
    });

    it('should handle multiple composite objects', () => {
      const originalContent = JSON.stringify({
        nav: {
          en: { home: 'Home', about: 'About' },
        },
        content: {
          en: { title: 'Title', body: 'Body' },
        },
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/nav': {
              '/home': 'Inicio',
              '/about': 'Acerca de',
            },
            '/content': {
              '/title': 'Título',
              '/body': 'Cuerpo',
            },
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.nav': {
                  type: 'object',
                  include: ['$.*'],
                },
                '$.content': {
                  type: 'object',
                  include: ['$.*'],
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.nav.en.home).toBe('Home');
      expect(parsed.nav.en.about).toBe('About');
      expect(parsed.content.en.title).toBe('Title');
      expect(parsed.content.en.body).toBe('Body');
      expect(parsed.nav.es.home).toBe('Inicio');
      expect(parsed.nav.es.about).toBe('Acerca de');
      expect(parsed.content.es.title).toBe('Título');
      expect(parsed.content.es.body).toBe('Cuerpo');
    });

    it('should skip target when translated content missing sourceObjectPointer for object', () => {
      const originalContent = JSON.stringify({
        translations: {
          en: { title: 'English Title' },
        },
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/different/path': {
              '/title': 'Título Español',
            },
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.translations': {
                  type: 'object',
                  include: ['$.title'],
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        'Translated JSON for locale: es does not have a valid sourceObjectPointer: /translations. Skipping this target'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.translations.en.title).toBe('English Title'); // Unchanged
    });

    it('should handle transformations for array targets', () => {
      const originalContent = JSON.stringify({
        redirects: [
          {
            // decoy
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
          },
          {
            language: 'en',
            source: '/en/path-1',
            destination: '/en/path-1#section-1',
          },
          {
            language: 'en',
            source: '/en/path-2',
            destination: '/en/path-2#section-2',
          },
          {
            language: 'en',
            source: '/en/path-3',
            destination: '/en/path-3#section-3',
          },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({}),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.redirects': {
                  type: 'array',
                  key: '$.language',
                  include: [],
                  transform: {
                    '$.source': {
                      match: '^/{locale}/(.*)$',
                      replace: '/{locale}/$1',
                    },
                    '$.destination': {
                      match: '^/{locale}/(.*)$',
                      replace: '/{locale}/$1',
                    },
                  },
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed).toBeDefined();
      const expected = {
        redirects: [
          {
            // decoy
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
          },
          {
            language: 'en',
            source: '/en/path-1',
            destination: '/en/path-1#section-1',
          },
          {
            language: 'en',
            source: '/en/path-2',
            destination: '/en/path-2#section-2',
          },
          {
            language: 'en',
            source: '/en/path-3',
            destination: '/en/path-3#section-3',
          },
          {
            language: 'es',
            source: '/es/path-1',
            destination: '/es/path-1#section-1',
          },
          {
            language: 'es',
            source: '/es/path-2',
            destination: '/es/path-2#section-2',
          },
          {
            language: 'es',
            source: '/es/path-3',
            destination: '/es/path-3#section-3',
          },
        ],
      };
      expect(JSON.stringify(parsed)).toEqual(JSON.stringify(expected));
    });
  });

  describe('Error Handling', () => {
    it('should exit when no composite property found in schema', () => {
      const originalContent = JSON.stringify({ test: 'value' });
      const targets = [{ translatedContent: '{}', targetLocale: 'es' }];

      expect(() => {
        mergeJson(
          originalContent,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                // Missing both include and composite
              },
            },
          },
          targets,
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'No include or composite property found in JSON schema'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when source object value is not an array for array type', () => {
      const originalContent = JSON.stringify({
        items: 'not-an-array',
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': { '/title': 'Test' },
          }),
          targetLocale: 'es',
        },
      ];

      expect(() => {
        mergeJson(
          originalContent,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.items': {
                    type: 'array',
                    include: ['$.title'],
                    key: '$.locale',
                  },
                },
              },
            },
          },
          targets,
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object value is not an array at path: /items'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when source object value is not an object for object type', () => {
      const originalContent = JSON.stringify({
        translations: 'not-an-object',
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/translations': { '/title': 'Test' },
          }),
          targetLocale: 'es',
        },
      ];

      expect(() => {
        mergeJson(
          originalContent,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.translations': {
                    type: 'object',
                    include: ['$.title'],
                  },
                },
              },
            },
          },
          targets,
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object value is not an object at path: /translations'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when matching default locale item not found in array', () => {
      const originalContent = JSON.stringify({
        items: [{ locale: 'fr', title: 'Titre Français' }],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': { '/title': 'Test' },
          }),
          targetLocale: 'es',
        },
      ];

      expect(() => {
        const result = mergeJson(
          originalContent,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.items': {
                    type: 'array',
                    include: ['$.title'],
                    key: '$.locale',
                  },
                },
              },
            },
          },
          targets,
          'en' // default locale 'en' not found in array
        );
        expect(result).toBeDefined();
        expect(result).toBe(originalContent);
        expect(mockLogWarning).toHaveBeenCalledWith(
          'Matching sourceItems not found at path: /items. Please check your JSON file includes the key field. Skipping this target'
        );
      });
    });

    it('should exit when default locale source item not found in object', () => {
      const originalContent = JSON.stringify({
        translations: {
          fr: { title: 'Titre Français' },
        },
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/translations': { '/title': 'Test' },
          }),
          targetLocale: 'es',
        },
      ];

      expect(() => {
        mergeJson(
          originalContent,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.translations': {
                    type: 'object',
                    include: ['$.title'],
                  },
                },
              },
            },
          },
          targets,
          'en' // default locale 'en' not found in object
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source item not found at path: /translations. You must specify a source item where its key matches the default locale'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with error for invalid JSON file', () => {
      const malformedJson = '{ "key": value }';
      const targets = [{ translatedContent: '{}', targetLocale: 'es' }];

      expect(() => {
        mergeJson(
          malformedJson,
          'invalid.json',
          {
            jsonSchema: {
              '**/*.json': {
                include: ['$..*'],
              },
            },
          },
          targets,
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Invalid JSON file: invalid.json'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle malformed original JSON', () => {
      const malformedJson = '{ "key": value }';
      const targets = [{ translatedContent: '{}', targetLocale: 'es' }];

      expect(() => {
        mergeJson(
          malformedJson,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                include: ['$..*'],
              },
            },
          },
          targets,
          'en'
        );
      }).toThrow();
    });

    it('should handle malformed translated JSON', () => {
      const originalContent = JSON.stringify({
        items: [{ locale: 'en', title: 'English Title' }],
      });

      const targets = [
        {
          translatedContent: '{ "invalid": json }', // malformed JSON
          targetLocale: 'es',
        },
      ];

      expect(() => {
        mergeJson(
          originalContent,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.items': {
                    type: 'array',
                    include: ['$.title'],
                    key: '$.locale',
                  },
                },
              },
            },
          },
          targets,
          'en'
        );
      }).toThrow();
    });

    it('should exit when array index is not present in source json', () => {
      const originalContent = JSON.stringify({
        items: [{ locale: 'en', title: 'English Title' }],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': { '/title': 'Título Español' },
              '/1': { '/title': 'Another Item' }, // This index doesn't exist in source
            },
          }),
          targetLocale: 'es',
        },
      ];

      expect(() => {
        mergeJson(
          originalContent,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.items': {
                    type: 'array',
                    include: ['$.title'],
                    key: '$.locale',
                  },
                },
              },
            },
          },
          targets,
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Array index /1 is not present in the source json. It is possible that the source json has been modified since the translation was generated.'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when items to add is less than items to remove', () => {
      const originalContent = JSON.stringify({
        items: [
          { locale: 'en', title: 'English Title 1' },
          { locale: 'es', title: 'Spanish Title 1' },
          { locale: 'es', title: 'Spanish Title 2' },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': { '/title': 'Updated Spanish Title' },
              // Only providing 1 translated item but there are 2 Spanish items in source (indices 1 and 2)
              // This creates a scenario where items to add (1) < items to remove (2)
              // Using /0 which corresponds to the English item at index 0
            },
          }),
          targetLocale: 'es',
        },
      ];

      expect(() => {
        mergeJson(
          originalContent,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.items': {
                    type: 'array',
                    include: ['$.title'],
                    key: '$.locale',
                  },
                },
              },
            },
          },
          targets,
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Items to add is less than items to remove at path: /items. Please check your JSON schema key field.'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should call logWarning when there is no transform and translated content for array', () => {
      const originalContent = JSON.stringify({
        redirects: [
          {
            language: 'en',
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
          },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({}),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.redirects': {
                  type: 'array',
                  key: '$.language',
                  include: [],
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        `Translated JSON for locale: es does not have a valid sourceObjectPointer: /redirects. Skipping this target`
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed).toBeDefined();
      const expected = {
        redirects: [
          {
            language: 'en',
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
          },
        ],
      };
      expect(JSON.stringify(parsed)).toEqual(JSON.stringify(expected));
    });

    it('should call logWarning when there is no transform and translated content for object', () => {
      const originalContent = JSON.stringify({
        translations: {
          en: {
            title: 'English Title',
          },
        },
      });

      const targets = [
        {
          translatedContent: JSON.stringify({}),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.translations': {
                  type: 'object',
                  include: [],
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        `Translated JSON for locale: es does not have a valid sourceObjectPointer: /translations. Skipping this target`
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed).toBeDefined();
      const expected = {
        translations: {
          en: {
            title: 'English Title',
          },
        },
      };
      expect(JSON.stringify(parsed)).toEqual(JSON.stringify(expected));
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle complex navigation structure merge', () => {
      const originalContent = readFileSync(
        path.join(__dirname, '../__mocks__', 'test_file1.json'),
        'utf8'
      );

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/navigation/languages': {
              '/0': {
                '/global/anchors/0/anchor': 'Anuncios',
                '/global/anchors/1/anchor': 'Estado',
                '/tabs/0/tab': 'Introducción',
                '/tabs/1/tab': 'Características',
              },
            },
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test_file1.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.navigation.languages': {
                  type: 'array',
                  include: ['$.global.anchors[*].anchor', '$.tabs[*].tab'],
                  key: '$.language',
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      const englishNav = parsed.navigation.languages.find(
        (lang: any) => lang.language === 'en'
      );
      const spanishNav = parsed.navigation.languages.find(
        (lang: any) => lang.language === 'es'
      );

      expect(englishNav.global.anchors[0].anchor).toBe('Announcements');
      expect(englishNav.global.anchors[1].anchor).toBe('Status');
      expect(englishNav.tabs[0].tab).toBe('Introduction');
      expect(englishNav.tabs[1].tab).toBe('Features');

      expect(spanishNav.global.anchors[0].anchor).toBe('Anuncios');
      expect(spanishNav.global.anchors[1].anchor).toBe('Estado');
      expect(spanishNav.tabs[0].tab).toBe('Introducción');
      expect(spanishNav.tabs[1].tab).toBe('Características');
    });

    it('should handle multiple targets with different locales', () => {
      const originalContent = JSON.stringify({
        items: [
          { locale: 'en', title: 'English Title', desc: 'English Description' },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': {
                '/title': 'Título Español',
                '/desc': 'Descripción Española',
              },
            },
          }),
          targetLocale: 'es',
        },
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': {
                '/title': 'Titre Français',
                '/desc': 'Description Française',
              },
            },
          }),
          targetLocale: 'fr',
        },
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': {
                '/title': 'Deutscher Titel',
                '/desc': 'Deutsche Beschreibung',
              },
            },
          }),
          targetLocale: 'de',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.title', '$.desc'],
                  key: '$.locale',
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      expect(result).toHaveLength(1); // Composite returns single merged result

      const parsed = JSON.parse(result[0]);
      const englishItem = parsed.items.find(
        (item: any) => item.locale === 'en'
      );
      const germanItem = parsed.items.find((item: any) => item.locale === 'de');

      expect(englishItem.title).toBe('English Title');
      expect(englishItem.desc).toBe('English Description');
      expect(germanItem.title).toBe('Deutscher Titel');
      expect(germanItem.desc).toBe('Deutsche Beschreibung');
    });

    it('should preserve non-translatable fields during merge', () => {
      const originalContent = JSON.stringify({
        items: [
          {
            locale: 'en',
            title: 'English Title',
            metadata: {
              id: 'unique-id',
              created: '2023-01-01',
              author: 'John Doe',
            },
            settings: {
              published: true,
              priority: 5,
            },
          },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': {
                '/title': 'Título Español',
              },
            },
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.title'], // Only title is translatable
                  key: '$.locale',
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      const englishItem = parsed.items[0];
      const spanishItem = parsed.items[1];
      expect(spanishItem.title).toBe('Título Español');
      expect(englishItem.title).toBe('English Title');
      expect(englishItem.metadata.id).toBe('unique-id');
      expect(englishItem.metadata.created).toBe('2023-01-01');
      expect(englishItem.metadata.author).toBe('John Doe');
      expect(englishItem.settings.published).toBe(true);
      expect(englishItem.settings.priority).toBe(5);
    });

    it('should handle transformation only for array targets', () => {
      const originalContent = JSON.stringify({
        languages: [
          {
            language: 'en',
            tabs: [
              {
                pages: ['en/link-1/', 'en/link-2/'],
              },
              {
                pages: ['en/link-3/', 'en/link-4/'],
              },
            ],
          },
        ],
        redirects: [
          {
            // decoy
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
          },
          {
            language: 'en',
            source: '/en/path-1',
            destination: '/en/path-1#section-1',
          },
          {
            language: 'en',
            source: '/en/path-2',
            destination: '/en/path-2#section-2',
          },
          {
            language: 'en',
            source: '/en/path-3',
            destination: '/en/path-3#section-3',
          },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({}),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.languages': {
                  type: 'array',
                  key: '$.language',
                  include: [
                    '$..group',
                    '$..tab',
                    '$..item',
                    '$..anchor',
                    '$..dropdown',
                  ],
                  transform: {
                    '$..pages[*]': {
                      match: '^{locale}/(.*)$',
                      replace: '{locale}/$1',
                    },
                  },
                },
                '$.redirects': {
                  type: 'array',
                  key: '$.language',
                  include: [],
                  transform: {
                    '$.source': {
                      match: '^/{locale}/(.*)$',
                      replace: '/{locale}/$1',
                    },
                    '$.destination': {
                      match: '^/{locale}/(.*)$',
                      replace: '/{locale}/$1',
                    },
                  },
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed).toBeDefined();
      const expected = {
        languages: [
          {
            language: 'en',
            tabs: [
              {
                pages: ['en/link-1/', 'en/link-2/'],
              },
              {
                pages: ['en/link-3/', 'en/link-4/'],
              },
            ],
          },
          {
            language: 'es',
            tabs: [
              {
                pages: ['es/link-1/', 'es/link-2/'],
              },
              {
                pages: ['es/link-3/', 'es/link-4/'],
              },
            ],
          },
        ],
        redirects: [
          {
            // decoy
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
          },
          {
            language: 'en',
            source: '/en/path-1',
            destination: '/en/path-1#section-1',
          },
          {
            language: 'en',
            source: '/en/path-2',
            destination: '/en/path-2#section-2',
          },
          {
            language: 'en',
            source: '/en/path-3',
            destination: '/en/path-3#section-3',
          },
          {
            language: 'es',
            source: '/es/path-1',
            destination: '/es/path-1#section-1',
          },
          {
            language: 'es',
            source: '/es/path-2',
            destination: '/es/path-2#section-2',
          },
          {
            language: 'es',
            source: '/es/path-3',
            destination: '/es/path-3#section-3',
          },
        ],
      };

      expect(JSON.stringify(parsed, null, 2)).toEqual(
        JSON.stringify(expected, null, 2)
      );
    });

    it('should handle transformation and translation insertion for array targets', () => {
      const originalContent = JSON.stringify({
        languages: [
          {
            language: 'en',
            tabs: [
              {
                pages: ['en/link-1/', 'en/link-2/'],
              },
              {
                pages: ['en/link-3/', 'en/link-4/'],
              },
            ],
          },
        ],
        languagesWithTranslations: [
          {
            language: 'en',
            translation: 'hello',
            tabs: [
              {
                pages: ['en/link-1/', 'en/link-2/'],
              },
              {
                pages: ['en/link-3/', 'en/link-4/'],
              },
            ],
          },
          // decoy
          {
            translation: 'hello',
            tabs: [
              {
                pages: ['en/link-1/', 'en/link-2/'],
              },
              {
                pages: ['en/link-3/', 'en/link-4/'],
              },
            ],
          },
        ],
        redirects: [
          {
            // decoy
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
          },
          {
            language: 'en',
            source: '/en/path-1',
            destination: '/en/path-1#section-1',
          },
          {
            language: 'en',
            source: '/en/path-2',
            destination: '/en/path-2#section-2',
          },
          {
            language: 'en',
            source: '/en/path-3',
            destination: '/en/path-3#section-3',
          },
        ],
        redirectsWithTranslations: [
          // decoy
          {
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
            translation: 'hello',
          },
          {
            language: 'en',
            translation: 'hello',
            source: '/en/path-1',
            destination: '/en/path-1#section-1',
          },
          {
            language: 'en',
            translation: 'hello',
            source: '/en/path-2',
            destination: '/en/path-2#section-2',
          },
          {
            language: 'en',
            translation: 'hello',
            source: '/en/path-3',
            destination: '/en/path-3#section-3',
          },
        ],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/languagesWithTranslations': {
              '/0': {
                '/translation': 'hola',
              },
            },
            '/redirectsWithTranslations': {
              '/1': {
                '/translation': 'hola',
              },
              '/2': {
                '/translation': 'hola',
              },
              '/3': {
                '/translation': 'hola',
              },
            },
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.languages': {
                  type: 'array',
                  key: '$.language',
                  include: [
                    '$..group',
                    '$..tab',
                    '$..item',
                    '$..anchor',
                    '$..dropdown',
                  ],
                  transform: {
                    '$..pages[*]': {
                      match: '^{locale}/(.*)$',
                      replace: '{locale}/$1',
                    },
                  },
                },
                '$.redirects': {
                  type: 'array',
                  key: '$.language',
                  include: [],
                  transform: {
                    '$.source': {
                      match: '^/{locale}/(.*)$',
                      replace: '/{locale}/$1',
                    },
                    '$.destination': {
                      match: '^/{locale}/(.*)$',
                      replace: '/{locale}/$1',
                    },
                  },
                },
                '$.languagesWithTranslations': {
                  type: 'array',
                  key: '$.language',
                  include: ['$..translation'],
                  transform: {
                    '$..pages[*]': {
                      match: '^{locale}/(.*)$',
                      replace: '{locale}/$1',
                    },
                  },
                },
                '$.redirectsWithTranslations': {
                  type: 'array',
                  key: '$.language',
                  include: ['$..translation'],
                  transform: {
                    '$.source': {
                      match: '^/{locale}/(.*)$',
                      replace: '/{locale}/$1',
                    },
                    '$.destination': {
                      match: '^/{locale}/(.*)$',
                      replace: '/{locale}/$1',
                    },
                  },
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed).toBeDefined();
      const expected = {
        languages: [
          {
            language: 'en',
            tabs: [
              {
                pages: ['en/link-1/', 'en/link-2/'],
              },
              {
                pages: ['en/link-3/', 'en/link-4/'],
              },
            ],
          },
          {
            language: 'es',
            tabs: [
              {
                pages: ['es/link-1/', 'es/link-2/'],
              },
              {
                pages: ['es/link-3/', 'es/link-4/'],
              },
            ],
          },
        ],
        languagesWithTranslations: [
          {
            language: 'en',
            translation: 'hello',
            tabs: [
              {
                pages: ['en/link-1/', 'en/link-2/'],
              },
              {
                pages: ['en/link-3/', 'en/link-4/'],
              },
            ],
          },
          // decoy
          {
            translation: 'hello',
            tabs: [
              {
                pages: ['en/link-1/', 'en/link-2/'],
              },
              {
                pages: ['en/link-3/', 'en/link-4/'],
              },
            ],
          },
          {
            language: 'es',
            translation: 'hola',
            tabs: [
              {
                pages: ['es/link-1/', 'es/link-2/'],
              },
              {
                pages: ['es/link-3/', 'es/link-4/'],
              },
            ],
          },
        ],
        redirects: [
          {
            // decoy
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
          },
          {
            language: 'en',
            source: '/en/path-1',
            destination: '/en/path-1#section-1',
          },
          {
            language: 'en',
            source: '/en/path-2',
            destination: '/en/path-2#section-2',
          },
          {
            language: 'en',
            source: '/en/path-3',
            destination: '/en/path-3#section-3',
          },
          {
            language: 'es',
            source: '/es/path-1',
            destination: '/es/path-1#section-1',
          },
          {
            language: 'es',
            source: '/es/path-2',
            destination: '/es/path-2#section-2',
          },
          {
            language: 'es',
            source: '/es/path-3',
            destination: '/es/path-3#section-3',
          },
        ],
        redirectsWithTranslations: [
          {
            // decoy
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
            translation: 'hello',
          },
          {
            language: 'en',
            translation: 'hello',
            source: '/en/path-1',
            destination: '/en/path-1#section-1',
          },
          {
            language: 'en',
            translation: 'hello',
            source: '/en/path-2',
            destination: '/en/path-2#section-2',
          },
          {
            language: 'en',
            translation: 'hello',
            source: '/en/path-3',
            destination: '/en/path-3#section-3',
          },
          {
            language: 'es',
            translation: 'hola',
            source: '/es/path-1',
            destination: '/es/path-1#section-1',
          },
          {
            language: 'es',
            translation: 'hola',
            source: '/es/path-2',
            destination: '/es/path-2#section-2',
          },
          {
            language: 'es',
            translation: 'hola',
            source: '/es/path-3',
            destination: '/es/path-3#section-3',
          },
        ],
      };

      expect(JSON.stringify(parsed)).toEqual(
        JSON.stringify(JSON.parse(JSON.stringify(expected)))
      );
    });

    it('should handle transformation only for object targets', () => {
      const originalContent = JSON.stringify({
        languages: {
          en: {
            tabs: [
              {
                pages: ['en/link-1/', 'en/link-2/'],
              },
              {
                pages: ['en/link-3/', 'en/link-4/'],
              },
            ],
          },
        },
        redirects: {
          decoy: {
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
          },
          en: {
            source: '/en/path-1',
            destination: '/en/path-1#section-1',
          },
        },
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/redirectsWithTranslations': {
              '/0': {
                '/translation': 'hola',
              },
            },
            '/languagesWithTranslations': {
              '/1': {
                '/translation': 'hola',
              },
              '/2': {
                '/translation': 'hola',
              },
              '/3': {
                '/translation': 'hola',
              },
            },
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.languages': {
                  type: 'object',
                  include: [
                    '$..group',
                    '$..tab',
                    '$..item',
                    '$..anchor',
                    '$..dropdown',
                  ],
                  transform: {
                    '$..pages[*]': {
                      match: '^{locale}/(.*)$',
                      replace: '{locale}/$1',
                    },
                  },
                },
                '$.redirects': {
                  type: 'object',
                  include: [],
                  transform: {
                    '$.source': {
                      match: '^/{locale}/(.*)$',
                      replace: '/{locale}/$1',
                    },
                    '$.destination': {
                      match: '^/{locale}/(.*)$',
                      replace: '/{locale}/$1',
                    },
                  },
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed).toBeDefined();
      const expected = {
        languages: {
          en: {
            tabs: [
              {
                pages: ['en/link-1/', 'en/link-2/'],
              },
              {
                pages: ['en/link-3/', 'en/link-4/'],
              },
            ],
          },
          es: {
            tabs: [
              {
                pages: ['es/link-1/', 'es/link-2/'],
              },
              {
                pages: ['es/link-3/', 'es/link-4/'],
              },
            ],
          },
        },
        redirects: {
          decoy: {
            source: '/en/path-0',
            destination: '/en/path-0#section-0',
          },
          en: {
            source: '/en/path-1',
            destination: '/en/path-1#section-1',
          },
          es: {
            source: '/es/path-1',
            destination: '/es/path-1#section-1',
          },
        },
      };

      expect(JSON.stringify(parsed, null, 2)).toEqual(
        JSON.stringify(JSON.parse(JSON.stringify(expected)), null, 2)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty targets array', () => {
      const originalContent = JSON.stringify({ test: 'value' });
      const targets: any[] = [];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.test'],
            },
          },
        },
        targets,
        'en'
      );

      expect(result).toHaveLength(0);
    });

    it('should handle null source object value for object type', () => {
      const originalContent = JSON.stringify({
        translations: null,
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/translations': { '/title': 'Test' },
          }),
          targetLocale: 'es',
        },
      ];

      expect(() => {
        mergeJson(
          originalContent,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.translations': {
                    type: 'object',
                    include: ['$.title'],
                  },
                },
              },
            },
          },
          targets,
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object value is not an object at path: /translations'
      );
    });

    it('should handle empty translated content object', () => {
      const originalContent = JSON.stringify({
        items: [{ locale: 'en', title: 'English Title' }],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': {}, // Empty translations
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.title'],
                  key: '$.locale',
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.items[0].title).toBe('English Title'); // Should remain unchanged
    });

    it('should handle special JSON characters in translated values', () => {
      const originalContent = JSON.stringify({
        items: [{ locale: 'en', message: 'Simple message' }],
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items': {
              '/0': {
                '/message':
                  'Mensaje con "comillas", \'apostrofes\', y\nnuevas líneas\tcon tabs',
              },
            },
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.message'],
                  key: '$.locale',
                },
              },
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.items[1].message).toBe(
        'Mensaje con "comillas", \'apostrofes\', y\nnuevas líneas\tcon tabs'
      );
    });

    it('should ignore invalid JSON pointer paths silently', () => {
      const originalContent = JSON.stringify({
        title: 'English Title',
      });

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/title': 'Título Español',
            '/invalid[malformed': 'Bad Path', // Invalid JSON pointer
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeJson(
        originalContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.title'],
            },
          },
        },
        targets,
        'en'
      );

      const parsed = JSON.parse(result[0]);
      expect(parsed.title).toBe('Título Español');
      // Should not crash due to invalid JSON pointer
    });
  });

  describe('applyTransformations', () => {
    it('should apply basic string replacement transformation', () => {
      const sourceItem = {
        title: 'Welcome to our app',
        description: 'This is a great app',
      };

      applyTransformations(
        sourceItem,
        {
          '$.title': {
            replace: 'Bienvenido a nuestra aplicación',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.title).toBe('Bienvenido a nuestra aplicación');
      expect(sourceItem.description).toBe('This is a great app'); // unchanged
    });

    it('should apply match and replace transformation', () => {
      const sourceItem = {
        url: 'https://example.com/en/page',
        link: 'Visit our en site',
      };

      applyTransformations(
        sourceItem,
        {
          '$.url': {
            match: '/en/',
            replace: '/es/',
          },
          '$.link': {
            match: 'en site',
            replace: 'sitio es',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.url).toBe('https://example.com/es/page');
      expect(sourceItem.link).toBe('Visit our sitio es');
    });

    it('should replace locale placeholders in replace string', () => {
      const sourceItem = {
        message: 'Hello World',
        url: 'test.com',
      };

      applyTransformations(
        sourceItem,
        {
          '$.message': {
            replace: 'Hola from {locale}',
          },
          '$.url': {
            replace: '{locale}.example.com',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.message).toBe('Hola from es');
      expect(sourceItem.url).toBe('es.example.com');
    });

    it('should replace locale name placeholders', () => {
      const sourceItem = {
        title: 'Page Title',
      };

      applyTransformations(
        sourceItem,
        {
          '$.title': {
            replace: 'Página en {localeName}',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.title).toBe('Página en Spanish');
    });

    it('should replace locale native name placeholders', () => {
      const sourceItem = {
        title: 'Page Title',
      };

      applyTransformations(
        sourceItem,
        {
          '$.title': {
            replace: 'Página en {localeNativeName}',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.title).toBe('Página en español');
    });

    it('should replace locale placeholders in match string using default locale', () => {
      const sourceItem = {
        url: 'https://example.com/en/page',
        path: '/en/docs',
      };

      applyTransformations(
        sourceItem,
        {
          '$.url': {
            match: '/{locale}/',
            replace: '/es/',
          },
          '$.path': {
            match: '/{localeCode}/',
            replace: '/es/',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.url).toBe('https://example.com/es/page');
      expect(sourceItem.path).toBe('/es/docs');
    });

    it('should handle nested JSONPath expressions', () => {
      const sourceItem = {
        metadata: {
          info: {
            locale: 'en',
            name: 'English Name',
          },
        },
        config: {
          settings: {
            language: 'English',
          },
        },
      };

      applyTransformations(
        sourceItem,
        {
          '$.metadata.info.locale': {
            replace: 'es',
          },
          '$.metadata.info.name': {
            replace: 'Nombre Español',
          },
          '$.config.settings.language': {
            replace: 'Español',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.metadata.info.locale).toBe('es');
      expect(sourceItem.metadata.info.name).toBe('Nombre Español');
      expect(sourceItem.config.settings.language).toBe('Español');
    });

    it('should handle wildcard JSONPath expressions', () => {
      const sourceItem = {
        buttons: [
          { text: 'Save', url: '/en/save' },
          { text: 'Cancel', url: '/en/cancel' },
        ],
      };

      applyTransformations(
        sourceItem,
        {
          '$.buttons[*].url': {
            match: '/en/',
            replace: '/es/',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.buttons[0].url).toBe('/es/save');
      expect(sourceItem.buttons[1].url).toBe('/es/cancel');
      expect(sourceItem.buttons[0].text).toBe('Save'); // unchanged
      expect(sourceItem.buttons[1].text).toBe('Cancel'); // unchanged
    });

    it('should handle recursive JSONPath expressions', () => {
      const sourceItem = {
        navigation: {
          main: {
            links: [
              { href: '/en/home', label: 'Home' },
              { href: '/en/about', label: 'About' },
            ],
          },
          footer: {
            links: [{ href: '/en/contact', label: 'Contact' }],
          },
        },
      };

      applyTransformations(
        sourceItem,
        {
          '$..links[*].href': {
            match: '/en/',
            replace: '/es/',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.navigation.main.links[0].href).toBe('/es/home');
      expect(sourceItem.navigation.main.links[1].href).toBe('/es/about');
      expect(sourceItem.navigation.footer.links[0].href).toBe('/es/contact');
    });

    it('should skip transformation when replace is not a string', () => {
      const sourceItem = {
        title: 'Original Title',
        count: 42,
      };

      applyTransformations(
        sourceItem,
        {
          '$.title': {
            replace: null as any,
          },
          '$.count': {
            replace: 100 as any,
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.title).toBe('Original Title'); // unchanged
      expect(sourceItem.count).toBe(42); // unchanged
    });

    it('should skip transformation when path does not match any values', () => {
      const sourceItem = {
        title: 'Original Title',
      };

      applyTransformations(
        sourceItem,
        {
          '$.nonexistent': {
            replace: 'New Value',
          },
          '$.also.missing': {
            replace: 'Another Value',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.title).toBe('Original Title'); // unchanged
    });

    it('should skip transformation when target value is not a string', () => {
      const sourceItem = {
        title: 'String Title',
        count: 42,
        enabled: true,
        config: { setting: 'value' },
      };

      applyTransformations(
        sourceItem,
        {
          '$.title': {
            replace: 'Título',
          },
          '$.count': {
            replace: 'Cuarenta y dos',
          },
          '$.enabled': {
            replace: 'verdadero',
          },
          '$.config': {
            replace: 'configuración',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.title).toBe('Título'); // changed (string)
      expect(sourceItem.count).toBe(42); // unchanged (number)
      expect(sourceItem.enabled).toBe(true); // unchanged (boolean)
      expect(sourceItem.config).toEqual({ setting: 'value' }); // unchanged (object)
    });

    it('should handle global regex replacement', () => {
      const sourceItem = {
        text: 'The en language is en and en again',
      };

      applyTransformations(
        sourceItem,
        {
          '$.text': {
            match: 'en',
            replace: 'es',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.text).toBe('The es language is es and es again');
    });

    it('should handle empty transform object', () => {
      const sourceItem = {
        title: 'Original Title',
      };

      applyTransformations(sourceItem, {}, 'es', 'en');

      expect(sourceItem.title).toBe('Original Title'); // unchanged
    });

    it('should handle undefined transform', () => {
      const sourceItem = {
        title: 'Original Title',
      };

      applyTransformations(sourceItem, undefined, 'es', 'en');

      expect(sourceItem.title).toBe('Original Title'); // unchanged
    });

    it('should handle complex locale placeholder combinations', () => {
      const sourceItem = {
        message: 'Page in default language',
        url: 'example.com/path',
      };

      applyTransformations(
        sourceItem,
        {
          '$.message': {
            replace: 'Página en {localeName} ({locale})',
          },
          '$.url': {
            match: 'example.com',
            replace: '{locale}.example.com',
          },
        },
        'fr',
        'en'
      );

      expect(sourceItem.message).toBe('Página en French (fr)');
      expect(sourceItem.url).toBe('fr.example.com/path');
    });

    it('should preserve unknown placeholder format', () => {
      const sourceItem = {
        text: 'Hello {unknownProperty}',
      };

      applyTransformations(
        sourceItem,
        {
          '$.text': {
            replace: 'Hola {unknownProperty} from {locale}',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.text).toBe('Hola {unknownProperty} from es');
    });

    it('should handle match string with locale placeholders from default locale', () => {
      const sourceItem = {
        url: 'https://example.com/en/docs/English',
      };

      applyTransformations(
        sourceItem,
        {
          '$.url': {
            match: '/{locale}/docs/{localeName}',
            replace: '/es/documentos/Español',
          },
        },
        'es',
        'en'
      );

      expect(sourceItem.url).toBe('https://example.com/es/documentos/Español');
    });

    it('should apply multiple transformations to same field', () => {
      const sourceItem = {
        path: '/en/docs/tutorial/en/',
      };

      applyTransformations(
        sourceItem,
        {
          '$.path': {
            match: '/en/',
            replace: '/es/',
          },
        },
        'es',
        'en'
      );

      // Should replace all occurrences due to global flag
      expect(sourceItem.path).toBe('/es/docs/tutorial/es/');
    });
  });
});
