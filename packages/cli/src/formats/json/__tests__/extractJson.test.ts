import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractJson } from '../extractJson';
import { readFileSync } from 'fs';
import path from 'path';
import { logger } from '../../../console/logger.js';
import { exitSync } from '../../../console/logging.js';
import { gt } from '../../../utils/gt.js';

vi.mock('../../../console/logger.js');
vi.mock('../../../console/logging.js');

const mockLogError = vi.spyOn(logger, 'error');
const mockLogWarning = vi.spyOn(logger, 'warn');
const mockExit = vi.mocked(exitSync).mockImplementation(() => {
  throw new Error('Process exit called');
});

describe('extractJson', () => {
  beforeEach(() => {
    mockLogError.mockClear();
    mockLogWarning.mockClear();
    mockExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('No Schema Tests', () => {
    it('should return null when no schema matches', () => {
      const localContent = JSON.stringify({ title: 'Hello', desc: 'World' });

      const result = extractJson(
        localContent,
        'file.txt', // doesn't match any schema
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.title'],
            },
          },
        },
        'es',
        'en'
      );

      expect(result).toBeNull();
    });

    it('should return null when no jsonSchema option provided', () => {
      const localContent = JSON.stringify({ title: 'Hello' });

      const result = extractJson(localContent, 'test.json', {}, 'es', 'en');

      expect(result).toBeNull();
    });
  });

  describe('Include Schema Tests', () => {
    it('should extract values using include schema', () => {
      const localContent = JSON.stringify({
        title: 'Título Español',
        description: 'Descripción Española',
        metadata: {
          author: 'John Doe',
          version: '1.0.0',
        },
      });

      const result = extractJson(
        localContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.title', '$.description'],
            },
          },
        },
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed['/title']).toBe('Título Español');
      expect(parsed['/description']).toBe('Descripción Española');
      expect(parsed['/metadata']).toBeUndefined();
    });

    it('should extract nested values using include schema', () => {
      const localContent = JSON.stringify({
        app: {
          ui: {
            buttons: {
              save: 'Guardar',
              cancel: 'Cancelar',
            },
          },
        },
      });

      const result = extractJson(
        localContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.app.ui.buttons.*'],
            },
          },
        },
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed['/app/ui/buttons/save']).toBe('Guardar');
      expect(parsed['/app/ui/buttons/cancel']).toBe('Cancelar');
    });
  });

  describe('Composite Schema Array Type Tests', () => {
    it('should extract array composite values for target locale', () => {
      const localContent = JSON.stringify({
        items: [
          { locale: 'en', title: 'English Title', desc: 'English Description' },
          {
            locale: 'es',
            title: 'Título Español',
            desc: 'Descripción Española',
          },
        ],
      });

      const result = extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      // Should extract Spanish values at index 1
      expect(parsed['/items']).toBeDefined();
      expect(parsed['/items']['/1']).toBeDefined();
      expect(parsed['/items']['/1']['/title']).toBe('Título Español');
      expect(parsed['/items']['/1']['/desc']).toBe('Descripción Española');
    });

    it('should extract array composite values when target locale is at index 0', () => {
      const localContent = JSON.stringify({
        items: [
          {
            locale: 'es',
            title: 'Título Español',
            desc: 'Descripción Española',
          },
          { locale: 'en', title: 'English Title', desc: 'English Description' },
        ],
      });

      const result = extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      // Should extract Spanish values at index 0
      expect(parsed['/items']).toBeDefined();
      expect(parsed['/items']['/0']).toBeDefined();
      expect(parsed['/items']['/0']['/title']).toBe('Título Español');
      expect(parsed['/items']['/0']['/desc']).toBe('Descripción Española');
    });

    it('should extract multiple matching items for same locale', () => {
      const localContent = JSON.stringify({
        items: [
          { locale: 'en', title: 'English Title 1' },
          { locale: 'es', title: 'Título Español 1' },
          { locale: 'en', title: 'English Title 2' },
          { locale: 'es', title: 'Título Español 2' },
        ],
      });

      const result = extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed['/items']['/1']['/title']).toBe('Título Español 1');
      expect(parsed['/items']['/3']['/title']).toBe('Título Español 2');
    });

    it('should handle nested key paths in array type', () => {
      const localContent = JSON.stringify({
        items: [
          { meta: { locale: 'en' }, title: 'English Title' },
          { meta: { locale: 'es' }, title: 'Título Español' },
        ],
      });

      const result = extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed['/items']['/1']['/title']).toBe('Título Español');
    });

    it('should warn when no matching items found for locale', () => {
      const localContent = JSON.stringify({
        items: [{ locale: 'en', title: 'English Title' }],
      });

      const result = extractJson(
        localContent,
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
        'fr', // French not present
        'en'
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        'No matching items found for locale fr at path: /items'
      );
    });

    it('should warn when source object value is not an array', () => {
      const localContent = JSON.stringify({
        items: 'not-an-array',
      });

      extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        'Source object value is not an array at path: /items'
      );
    });
  });

  describe('Composite Schema Object Type Tests', () => {
    it('should extract object composite values for target locale', () => {
      const localContent = JSON.stringify({
        translations: {
          en: { title: 'English Title', desc: 'English Description' },
          es: { title: 'Título Español', desc: 'Descripción Española' },
        },
      });

      const result = extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed['/translations']['/title']).toBe('Título Español');
      expect(parsed['/translations']['/desc']).toBe('Descripción Española');
    });

    it('should handle multiple composite objects', () => {
      const localContent = JSON.stringify({
        nav: {
          en: { home: 'Home', about: 'About' },
          es: { home: 'Inicio', about: 'Acerca de' },
        },
        content: {
          en: { title: 'Title', body: 'Body' },
          es: { title: 'Título', body: 'Cuerpo' },
        },
      });

      const result = extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed['/nav']['/home']).toBe('Inicio');
      expect(parsed['/nav']['/about']).toBe('Acerca de');
      expect(parsed['/content']['/title']).toBe('Título');
      expect(parsed['/content']['/body']).toBe('Cuerpo');
    });

    it('should warn when no matching item found for locale in object', () => {
      const localContent = JSON.stringify({
        translations: {
          en: { title: 'English Title' },
        },
      });

      extractJson(
        localContent,
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
        'fr', // French not present
        'en'
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        'No matching item found for locale fr at path: /translations'
      );
    });

    it('should warn when source object value is not an object', () => {
      const localContent = JSON.stringify({
        translations: 'not-an-object',
      });

      extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        'Source object value is not an object at path: /translations'
      );
    });

    it('should warn when source object value is null', () => {
      const localContent = JSON.stringify({
        translations: null,
      });

      extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        'Source object value is not an object at path: /translations'
      );
    });
  });

  describe('Error Handling', () => {
    it('should return null and log error for invalid JSON', () => {
      const result = extractJson(
        '{ invalid json }',
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.title'],
            },
          },
        },
        'es',
        'en'
      );

      expect(result).toBeNull();
      expect(mockLogError).toHaveBeenCalledWith('Invalid JSON file: test.json');
    });

    it('should exit when schema has no include or composite', () => {
      const localContent = JSON.stringify({ title: 'Test' });

      expect(() => {
        extractJson(
          localContent,
          'test.json',
          {
            jsonSchema: {
              '**/*.json': {
                // Missing both include and composite
              },
            },
          },
          'es',
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'No include or composite property found in JSON schema'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should extract navigation structure from merged file', () => {
      const localContent = readFileSync(
        path.join(__dirname, '../__mocks__', 'test_file1.json'),
        'utf8'
      );

      const result = extractJson(
        localContent,
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
        'pt-BR',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);

      // pt-BR is at index 1 in the test file
      expect(parsed['/navigation/languages']).toBeDefined();
      expect(parsed['/navigation/languages']['/1']).toBeDefined();
      expect(
        parsed['/navigation/languages']['/1']['/global/anchors/0/anchor']
      ).toBe('Anúncios');
      expect(
        parsed['/navigation/languages']['/1']['/global/anchors/1/anchor']
      ).toBe('Status');
      expect(parsed['/navigation/languages']['/1']['/tabs/0/tab']).toBe(
        'Introdução'
      );
      expect(parsed['/navigation/languages']['/1']['/tabs/1/tab']).toBe(
        'Funcionalidades'
      );
    });

    it('should extract English content from merged file', () => {
      const localContent = readFileSync(
        path.join(__dirname, '../__mocks__', 'test_file1.json'),
        'utf8'
      );

      const result = extractJson(
        localContent,
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
        'en',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);

      // en is at index 0 in the test file
      expect(parsed['/navigation/languages']['/0']).toBeDefined();
      expect(
        parsed['/navigation/languages']['/0']['/global/anchors/0/anchor']
      ).toBe('Announcements');
      expect(
        parsed['/navigation/languages']['/0']['/global/anchors/1/anchor']
      ).toBe('Status');
      expect(parsed['/navigation/languages']['/0']['/tabs/0/tab']).toBe(
        'Introduction'
      );
      expect(parsed['/navigation/languages']['/0']['/tabs/1/tab']).toBe(
        'Features'
      );
    });

    it('should handle special characters in extracted values', () => {
      const localContent = JSON.stringify({
        items: [
          { locale: 'en', message: 'Simple message' },
          {
            locale: 'es',
            message:
              'Mensaje con "comillas", \'apostrofes\', y\nnuevas líneas\tcon tabs',
          },
        ],
      });

      const result = extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed['/items']['/1']['/message']).toBe(
        'Mensaje con "comillas", \'apostrofes\', y\nnuevas líneas\tcon tabs'
      );
    });

    it('should handle deeply nested structures', () => {
      const localContent = JSON.stringify({
        data: {
          pages: [
            {
              language: 'en',
              sections: {
                header: {
                  nav: {
                    links: [{ text: 'Home' }, { text: 'About' }],
                  },
                },
              },
            },
            {
              language: 'es',
              sections: {
                header: {
                  nav: {
                    links: [{ text: 'Inicio' }, { text: 'Acerca de' }],
                  },
                },
              },
            },
          ],
        },
      });

      const result = extractJson(
        localContent,
        'test.json',
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.data.pages': {
                  type: 'array',
                  include: ['$.sections.header.nav.links[*].text'],
                  key: '$.language',
                },
              },
            },
          },
        },
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(
        parsed['/data/pages']['/1']['/sections/header/nav/links/0/text']
      ).toBe('Inicio');
      expect(
        parsed['/data/pages']['/1']['/sections/header/nav/links/1/text']
      ).toBe('Acerca de');
    });
  });

  describe('Canonical Locale Keys', () => {
    it('should use canonical locale when experimentalCanonicalLocaleKeys is enabled', () => {
      const localContent = JSON.stringify({
        items: [
          { locale: 'en', title: 'English Title' },
          { locale: 'fr-CA', title: 'Titre Français Canadien' },
        ],
      });

      const customMapping = {
        'fr-ca': { code: 'fr-CA' },
      };
      gt.setConfig({ sourceLocale: 'en', customMapping });

      const result = extractJson(
        localContent,
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
          experimentalCanonicalLocaleKeys: true,
        },
        'fr-ca',
        'en'
      );

      gt.setConfig({ sourceLocale: 'en', customMapping: undefined as any });

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      // Should match fr-CA in the data using canonical locale lookup
      expect(parsed['/items']['/1']['/title']).toBe('Titre Français Canadien');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty items array', () => {
      const localContent = JSON.stringify({
        items: [],
      });

      const result = extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      // Should return empty composite result
      expect(mockLogWarning).toHaveBeenCalledWith(
        'No matching items found for locale es at path: /items'
      );
    });

    it('should handle empty translations object', () => {
      const localContent = JSON.stringify({
        translations: {},
      });

      const result = extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      expect(mockLogWarning).toHaveBeenCalledWith(
        'No matching item found for locale es at path: /translations'
      );
    });

    it('should handle items without the key field', () => {
      const localContent = JSON.stringify({
        items: [
          { title: 'No locale field' },
          { locale: 'es', title: 'Spanish' },
        ],
      });

      const result = extractJson(
        localContent,
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
        'es',
        'en'
      );

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      // Should only extract the item that has the locale field
      expect(parsed['/items']['/1']['/title']).toBe('Spanish');
      expect(parsed['/items']['/0']).toBeUndefined();
    });

    it('should return empty result for composite with no matching locales', () => {
      const localContent = JSON.stringify({
        items: [
          { locale: 'de', title: 'German' },
          { locale: 'ja', title: 'Japanese' },
        ],
      });

      extractJson(
        localContent,
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
        'es', // Spanish not present
        'en'
      );

      expect(mockLogWarning).toHaveBeenCalledWith(
        'No matching items found for locale es at path: /items'
      );
    });
  });
});
