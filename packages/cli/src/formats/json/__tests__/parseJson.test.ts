import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseJson } from '../parseJson';
import { readFileSync } from 'fs';
import path from 'path';
import { logError, exit } from '../../../console/logging.js';

vi.mock('../../../console/logging.js');
const mockLogError = vi.mocked(logError);
const mockExit = vi.mocked(exit).mockImplementation(() => {
  throw new Error('Process exit called');
});

describe('parseJson', () => {
  beforeEach(() => {
    mockLogError.mockClear();
    mockExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  it('should parse a JSON file', () => {
    const json = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file4.json'),
      'utf8'
    );
    const result = parseJson(
      json,
      path.join(__dirname, '../__mocks__', 'test_file4.json'),
      {
        jsonSchema: {
          '**/*.json': {
            include: ['$..*'],
          },
        },
      },
      'en'
    );
    expect(result).toBeDefined();
    expect(result).toBe(
      '{"/object/key1":"value1","/object/key2":"value2","/object/key3":"value3","/array/0":"value1","/array/1":"value2","/array/2":"value3"}'
    );
  });
  it('should parse a JSON file with a composite schema', () => {
    const json = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file5.json'),
      'utf8'
    );
    const result = parseJson(
      json,
      path.join(__dirname, '../__mocks__', 'test_file5.json'),
      {
        jsonSchema: {
          '**/*.json': {
            composite: {
              '$.object': {
                type: 'object',
                include: ['$..*'],
              },
              '$.array': {
                type: 'array',
                include: ['$.*'],
                key: '$.locale',
              },
            },
          },
        },
      },
      'en'
    );
    expect(result).toBeDefined();
    expect(result).toBe(
      '{"/object":{"/key1":"value1","/key2":"value2","/key3":"value3"},"/array":{"/0":{"/key1":"value1","/key2":"value2","/key3":"value3"}}}'
    );
  });

  describe('Error Handling', () => {
    it('should exit with error for invalid JSON file', () => {
      const malformedJson = '{ "key": value }';

      expect(() => {
        parseJson(
          malformedJson,
          path.join(__dirname, '../__mocks__', 'invalid.json'),
          {
            jsonSchema: {
              '**/*.json': {
                include: ['$..*'],
              },
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        `Invalid JSON file: ${path.join(__dirname, '../__mocks__', 'invalid.json')}`
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should throw error for malformed JSON', () => {
      const malformedJson = '{ "key": value }';

      expect(() => {
        parseJson(
          malformedJson,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                include: ['$..*'],
              },
            },
          },
          'en'
        );
      }).toThrow();
    });

    it('should throw error for empty JSON content', () => {
      expect(() => {
        parseJson(
          '',
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                include: ['$..*'],
              },
            },
          },
          'en'
        );
      }).toThrow();
    });

    it('should exit when include and composite are both provided', () => {
      const json = JSON.stringify({ test: 'value' });

      expect(() => {
        parseJson(
          json,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                include: ['$..*'],
                composite: {
                  '$.test': {
                    type: 'object',
                    include: ['$..*'],
                  },
                },
              },
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'include and composite cannot be used together in the same JSON schema'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when array source object is not actually an array', () => {
      const json = JSON.stringify({ test: 'not-an-array' });

      expect(() => {
        parseJson(
          json,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.test': {
                    type: 'array',
                    include: ['$..*'],
                    key: '$.locale',
                  },
                },
              },
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object value is not an array at path: /test'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when object source object is not actually an object', () => {
      const json = JSON.stringify({ test: 'not-an-object' });

      expect(() => {
        parseJson(
          json,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.test': {
                    type: 'object',
                    include: ['$..*'],
                  },
                },
              },
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object value is not an object at path: /test'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when array type is missing key property', () => {
      const json = JSON.stringify({ test: [{ locale: 'en', value: 'test' }] });

      expect(() => {
        parseJson(
          json,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.test': {
                    type: 'array',
                    include: ['$..*'],
                    // Missing key property
                  },
                },
              },
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object options key is required for array at path: /test'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when object type has key property (not allowed)', () => {
      const json = JSON.stringify({ test: { en: 'value' } });

      expect(() => {
        parseJson(
          json,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.test': {
                    type: 'object',
                    include: ['$..*'],
                    key: '$.locale',
                  },
                },
              },
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object options key is not allowed for object at path: /test'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when source item not found in array', () => {
      const json = JSON.stringify({ test: [{ locale: 'fr', value: 'test' }] });

      expect(() => {
        parseJson(
          json,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.test': {
                    type: 'array',
                    include: ['$..*'],
                    key: '$.locale',
                  },
                },
              },
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Matching sourceItem not found at path: /test for locale: en. Please check your JSON schema'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when source item not found in object', () => {
      const json = JSON.stringify({ test: { fr: 'value' } });

      expect(() => {
        parseJson(
          json,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.test': {
                    type: 'object',
                    include: ['$..*'],
                  },
                },
              },
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source item not found at path: /test. You must specify a source item where its key matches the default locale'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when key is not unique in array item', () => {
      const json = JSON.stringify({
        test: [{ locale: 'en', nested: { locale: 'en' }, value: 'test' }],
      });

      expect(() => {
        parseJson(
          json,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.test': {
                    type: 'array',
                    include: ['$..*'],
                    key: '$..locale', // This should match both locale fields
                  },
                },
              },
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source item at path: /test has multiple matching keys with path: $..locale'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Schema Pattern Matching', () => {
    it('should return original content when no schema matches file path', () => {
      const json = JSON.stringify({ test: 'value' });
      const result = parseJson(
        json,
        '/different/path/file.txt',
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$..*'],
            },
          },
        },
        'en'
      );

      expect(result).toBe(json);
    });

    it('should return original content when no jsonSchema option provided', () => {
      const json = JSON.stringify({ test: 'value' });
      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {},
        'en'
      );

      expect(result).toBe(json);
    });

    it('should return original content when schema has no include or composite', () => {
      const json = JSON.stringify({ test: 'value' });
      const result = expect(() => {
        parseJson(
          json,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {},
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'No include or composite property found in JSON schema'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should match specific file patterns', () => {
      const json = JSON.stringify({ test: 'value' });
      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'specific.json'),
        {
          jsonSchema: {
            '**/specific.json': {
              include: ['$.test'],
            },
          },
        },
        'en'
      );

      expect(result).toBe('{"\/test":"value"}');
    });
  });

  describe('Array Type Composite Schemas', () => {
    it('should handle multiple array items with same locale', () => {
      const json = JSON.stringify({
        redirects: [
          {
            locale: 'en',
            source: '/en/ai-review',
            destination: '/en/agent/modes#agent',
          },
          {
            locale: 'en',
            source: '/en/background-agents',
            destination: '/en/background-agent',
          },
          {
            locale: 'fr',
            source: '/fr/ai-review',
            destination: '/fr/agent/modes#agent',
          },
        ],
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.redirects': {
                  type: 'array',
                  include: ['$.source', '$.destination'],
                  key: '$.locale',
                },
              },
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/redirects']).toBeDefined();

      // Should have multiple entries for 'en' locale
      const redirectKeys = Object.keys(parsed['/redirects']);
      const enRedirects = redirectKeys.filter((key) => key.startsWith('/'));
      expect(enRedirects.length).toBeGreaterThan(1);

      // Should capture both English redirect entries
      expect(
        enRedirects.some(
          (key) => parsed['/redirects'][key]['/source'] === '/en/ai-review'
        )
      ).toBe(true);
      expect(
        enRedirects.some(
          (key) =>
            parsed['/redirects'][key]['/source'] === '/en/background-agents'
        )
      ).toBe(true);
    });

    it('should handle array composite schema with valid key', () => {
      const json = JSON.stringify({
        items: [
          { locale: 'en', title: 'English Title', desc: 'English Description' },
          {
            locale: 'fr',
            title: 'Titre Français',
            desc: 'Description Française',
          },
        ],
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
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
        'en'
      );

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed['/items']).toBeDefined();
      expect(parsed['/items']['/0']).toBeDefined();
      expect(parsed['/items']['/0']['/title']).toBe('English Title');
      expect(parsed['/items']['/0']['/desc']).toBe('English Description');
    });

    it('should handle array with nested key path', () => {
      const json = JSON.stringify({
        items: [
          { meta: { locale: 'en' }, title: 'English Title' },
          { meta: { locale: 'fr' }, title: 'Titre Français' },
        ],
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
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
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/items']['/0']['/title']).toBe('English Title');
    });

    it('should not include transformations for array items', () => {
      const json = JSON.stringify({
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

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.redirects': {
                  type: 'array',
                  include: [],
                  key: '$.language',
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
        'en'
      );

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({});
    });

    it('should not include transformations for object items', () => {
      const json = JSON.stringify({
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

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
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
        'en'
      );

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({});
    });
  });

  describe('Object Type Composite Schemas', () => {
    it('should handle object composite schema with locale keys', () => {
      const json = JSON.stringify({
        translations: {
          en: { title: 'English Title', desc: 'English Description' },
          fr: { title: 'Titre Français', desc: 'Description Française' },
        },
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
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
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/translations']['/title']).toBe('English Title');
      expect(parsed['/translations']['/desc']).toBe('English Description');
    });

    it('should handle multiple composite objects', () => {
      const json = JSON.stringify({
        nav: {
          en: { home: 'Home', about: 'About' },
          fr: { home: 'Accueil', about: 'À propos' },
        },
        content: {
          en: { title: 'Title', body: 'Body' },
          fr: { title: 'Titre', body: 'Corps' },
        },
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
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
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/nav']['/home']).toBe('Home');
      expect(parsed['/nav']['/about']).toBe('About');
      expect(parsed['/content']['/title']).toBe('Title');
      expect(parsed['/content']['/body']).toBe('Body');
    });
  });

  describe('Include Schema Tests', () => {
    it('should handle complex nested includes', () => {
      const json = JSON.stringify({
        level1: {
          level2: {
            target: 'found',
            ignore: 'ignored',
          },
          other: 'also ignored',
        },
        array: ['item1', 'item2'],
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.level1.level2.target', '$.array[*]'],
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/level1/level2/target']).toBe('found');
      expect(parsed['/array/0']).toBe('item1');
      expect(parsed['/array/1']).toBe('item2');
      expect(parsed['/level1/level2/ignore']).toBeUndefined();
    });

    it('should handle wildcard includes', () => {
      const json = JSON.stringify({
        items: {
          item1: 'value1',
          item2: 'value2',
          item3: 'value3',
        },
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.items.*'],
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/items/item1']).toBe('value1');
      expect(parsed['/items/item2']).toBe('value2');
      expect(parsed['/items/item3']).toBe('value3');
    });
  });

  describe('Locale Properties', () => {
    it('should handle different locale properties for object type', () => {
      const json = JSON.stringify({
        translations: {
          English: { title: 'English Title' },
          Français: { title: 'Titre Français' },
        },
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.translations': {
                  type: 'object',
                  include: ['$.title'],
                  localeProperty: 'name',
                },
              },
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/translations']['/title']).toBe('English Title');
    });

    it('should handle different locale properties for array type', () => {
      const json = JSON.stringify({
        items: [
          { lang: 'English', title: 'English Title' },
          { lang: 'Français', title: 'Titre Français' },
        ],
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.title'],
                  key: '$.lang',
                  localeProperty: 'name',
                },
              },
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/items']['/0']['/title']).toBe('English Title');
    });

    it('should handle multiple different locale entries for array type with same key', () => {
      const json = JSON.stringify({
        items: [
          { lang: 'English', title: 'English Title' },
          { lang: 'Français', title: 'Titre Français' },
          { lang: 'English', title: 'English Title 2' },
          { lang: 'Français', title: 'Titre Français 2' },
        ],
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.items': {
                  type: 'array',
                  include: ['$.title'],
                  key: '$.lang',
                  localeProperty: 'name',
                },
              },
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/items']['/0']['/title']).toBe('English Title');
      expect(parsed['/items']['/2']['/title']).toBe('English Title 2');
    });

    it('should use default localeProperty (code) when not specified', () => {
      const json = JSON.stringify({
        translations: {
          en: { title: 'English Title' },
          fr: { title: 'Titre Français' },
        },
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
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
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/translations']['/title']).toBe('English Title');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle navigation structure like test_file1.json', () => {
      const json = readFileSync(
        path.join(__dirname, '../__mocks__', 'test_file1.json'),
        'utf8'
      );

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test_file1.json'),
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
        'en'
      );

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed['/navigation/languages']).toBeDefined();

      // Should extract anchor text (first matching item with 'en' locale)
      const firstMatch = Object.keys(parsed['/navigation/languages'])[0];
      expect(
        parsed['/navigation/languages'][firstMatch]['/global/anchors/0/anchor']
      ).toBe('Announcements');
      expect(
        parsed['/navigation/languages'][firstMatch]['/global/anchors/1/anchor']
      ).toBe('Status');

      // Should extract tab names
      expect(parsed['/navigation/languages'][firstMatch]['/tabs/0/tab']).toBe(
        'Introduction'
      );
      expect(parsed['/navigation/languages'][firstMatch]['/tabs/1/tab']).toBe(
        'Features'
      );
    });

    it('should handle deeply nested JSON paths', () => {
      const json = JSON.stringify({
        deep: {
          nesting: {
            structure: {
              en: { content: 'English content', meta: { author: 'John' } },
              fr: { content: 'Contenu français', meta: { author: 'Jean' } },
            },
          },
        },
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              composite: {
                '$.deep.nesting.structure': {
                  type: 'object',
                  include: ['$.content', '$.meta.author'],
                },
              },
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/deep/nesting/structure']['/content']).toBe(
        'English content'
      );
      expect(parsed['/deep/nesting/structure']['/meta/author']).toBe('John');
    });

    it('should handle multiple file glob patterns', () => {
      const json = JSON.stringify({ content: 'test content' });

      // Test that more specific patterns take precedence
      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'specific-config.json'),
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.content'],
            },
            '**/specific-*.json': {
              include: ['$..*'], // More inclusive for specific files
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/content']).toBe('test content');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects', () => {
      const json = JSON.stringify({});
      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$..*'],
            },
          },
        },
        'en'
      );

      expect(result).toBe('{}');
    });

    it('should handle null values in JSON', () => {
      const json = JSON.stringify({ test: null, valid: 'value' });
      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$..*'],
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/test']).toBeUndefined();
      expect(parsed['/valid']).toBe('value');
    });

    it('should handle arrays with mixed types', () => {
      const json = JSON.stringify({
        mixed: [1, 'string', true, null, { nested: 'object' }],
      });
      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.mixed[*]'],
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/mixed/1']).toBe('string');
    });

    it('should handle very large JSON objects efficiently', () => {
      const largeObject: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }
      const json = JSON.stringify({ data: largeObject });

      const start = Date.now();
      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.data.*'],
            },
          },
        },
        'en'
      );
      const end = Date.now();

      expect(end - start).toBeLessThan(1000); // Should complete in under 1 second
      const parsed = JSON.parse(result);
      expect(parsed['/data/key0']).toBe('value0');
      expect(parsed['/data/key999']).toBe('value999');
    });

    it('should handle special JSON characters properly', () => {
      const json = JSON.stringify({
        quotes: 'Text with "quotes" and \'apostrophes\'',
        backslashes: 'Path\\to\\file',
        unicode: 'Unicode: \u00E9\u00F1\u4E00',
        newlines: 'Line 1\nLine 2\r\nLine 3',
        tabs: 'Column 1\tColumn 2',
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$..*'],
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/quotes']).toBe('Text with "quotes" and \'apostrophes\'');
      expect(parsed['/backslashes']).toBe('Path\\to\\file');
      expect(parsed['/unicode']).toBe('Unicode: éñ一');
      expect(parsed['/newlines']).toBe('Line 1\nLine 2\r\nLine 3');
      expect(parsed['/tabs']).toBe('Column 1\tColumn 2');
    });

    it('should handle JSONPath edge cases', () => {
      const json = JSON.stringify({
        'weird-key': 'value1',
        '123': 'value2',
        '': 'empty key',
        $special: 'dollar sign',
        '@attribute': 'at sign',
        'space key': 'space value',
      });

      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$..*'],
            },
          },
        },
        'en'
      );

      const parsed = JSON.parse(result);
      expect(parsed['/weird-key']).toBe('value1');
      expect(parsed['/123']).toBe('value2');
      expect(parsed['/']).toBe('empty key');
      expect(parsed['/$special']).toBe('dollar sign');
      expect(parsed['/@attribute']).toBe('at sign');
      expect(parsed['/space key']).toBe('space value');
    });

    it('should exit when trying to process empty object in composite schemas', () => {
      const json = JSON.stringify({
        emptyArray: [],
        emptyObject: {},
      });

      expect(() => {
        parseJson(
          json,
          path.join(__dirname, '../__mocks__', 'test.json'),
          {
            jsonSchema: {
              '**/*.json': {
                composite: {
                  '$.emptyObject': {
                    type: 'object',
                    include: ['$.*'],
                  },
                },
              },
            },
          },
          'en'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Source item not found at path: /emptyObject. You must specify a source item where its key matches the default locale'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should preserve original formatting for non-matching files', () => {
      const originalJson = `{
  "formatted": {
    "nicely": "yes"
  }
}`;

      const result = parseJson(
        originalJson,
        '/path/to/unmatched/file.txt', // doesn't match any schema
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$..*'],
            },
          },
        },
        'en'
      );

      expect(result).toBe(originalJson);
    });
  });
});
