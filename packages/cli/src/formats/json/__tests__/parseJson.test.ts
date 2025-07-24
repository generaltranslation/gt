import { describe, it, expect } from 'vitest';
import { parseJson } from '../parseJson';
import { readFileSync } from 'fs';
import path from 'path';

describe('parseJson', () => {
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
      }
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
      '{"/object":{"/key1":"value1","/key2":"value2","/key3":"value3"},"/array":{"/key1":"value1","/key2":"value2","/key3":"value3"}}'
    );
  });

  describe('Error Handling', () => {
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
          }
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
          }
        );
      }).toThrow();
    });

    it('should exit when include and composite are both provided', () => {
      const json = JSON.stringify({ test: 'value' });
      
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
        }
      );

      expect(mockLogError).toHaveBeenCalledWith(
        'include and composite cannot be used together in the same JSON schema'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when defaultLocale is missing for composite schemas', () => {
      const json = JSON.stringify({ test: { en: 'value' } });
      
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
        }
      );

      expect(mockLogError).toHaveBeenCalledWith(
        'defaultLocale is required for composite JSON schemas'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when array source object is not actually an array', () => {
      const json = JSON.stringify({ test: 'not-an-array' });
      
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

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object value is not an array at path: /test'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when object source object is not actually an object', () => {
      const json = JSON.stringify({ test: 'not-an-object' });
      
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

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object value is not an object at path: /test'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when array type is missing key property', () => {
      const json = JSON.stringify({ test: [{ locale: 'en', value: 'test' }] });
      
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
                },
              },
            },
          },
        },
        'en'
      );

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object options key is required for array at path: /test'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when object type has key property (not allowed)', () => {
      const json = JSON.stringify({ test: { en: 'value' } });
      
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

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object options key is not allowed for object at path: /test'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when source item not found in array', () => {
      const json = JSON.stringify({ test: [{ locale: 'fr', value: 'test' }] });
      
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

      expect(mockLogError).toHaveBeenCalledWith(
        'Source item not found at path: /test. You must specify a source item that contains a key matching the source locale'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when source item not found in object', () => {
      const json = JSON.stringify({ test: { fr: 'value' } });
      
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

      expect(mockLogError).toHaveBeenCalledWith(
        'Source item not found at path: /test. You must specify a source item where its key matches the source locale'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should exit when key is not unique in array item', () => {
      const json = JSON.stringify({
        test: [{ locale: 'en', nested: { locale: 'en' }, value: 'test' }]
      });
      
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
                  key: '$..*["locale"]',
                },
              },
            },
          },
        },
        'en'
      );

      expect(mockLogError).toHaveBeenCalledWith(
        'Source object key is not unique at path: /test'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
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
        }
      );
      
      expect(result).toBe(json);
    });

    it('should return original content when no jsonSchema option provided', () => {
      const json = JSON.stringify({ test: 'value' });
      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {}
      );
      
      expect(result).toBe(json);
    });

    it('should return original content when schema has no include or composite', () => {
      const json = JSON.stringify({ test: 'value' });
      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {}
          },
        }
      );
      
      expect(result).toBe(json);
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
        }
      );
      
      expect(result).toBe('{"\/test":"value"}');
    });
  });

  describe('Array Type Composite Schemas', () => {
    it('should handle array composite schema with valid key', () => {
      const json = JSON.stringify({
        items: [
          { locale: 'en', title: 'English Title', desc: 'English Description' },
          { locale: 'fr', title: 'Titre Français', desc: 'Description Française' }
        ]
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
      expect(parsed["/items"]).toBeDefined();
      expect(parsed["/items"]["/title"]).toBe('English Title');
      expect(parsed["/items"]["/desc"]).toBe('English Description');
    });

    it('should handle array with nested key path', () => {
      const json = JSON.stringify({
        items: [
          { meta: { locale: 'en' }, title: 'English Title' },
          { meta: { locale: 'fr' }, title: 'Titre Français' }
        ]
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
      expect(parsed["/items"]["/title"]).toBe('English Title');
    });
  });

  describe('Object Type Composite Schemas', () => {
    it('should handle object composite schema with locale keys', () => {
      const json = JSON.stringify({
        translations: {
          en: { title: 'English Title', desc: 'English Description' },
          fr: { title: 'Titre Français', desc: 'Description Française' }
        }
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
      expect(parsed["/translations"]["/title"]).toBe('English Title');
      expect(parsed["/translations"]["/desc"]).toBe('English Description');
    });

    it('should handle multiple composite objects', () => {
      const json = JSON.stringify({
        nav: {
          en: { home: 'Home', about: 'About' },
          fr: { home: 'Accueil', about: 'À propos' }
        },
        content: {
          en: { title: 'Title', body: 'Body' },
          fr: { title: 'Titre', body: 'Corps' }
        }
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
      expect(parsed["/nav"]["/home"]).toBe('Home');
      expect(parsed["/nav"]["/about"]).toBe('About');
      expect(parsed["/content"]["/title"]).toBe('Title');
      expect(parsed["/content"]["/body"]).toBe('Body');
    });
  });

  describe('Include Schema Tests', () => {
    it('should handle complex nested includes', () => {
      const json = JSON.stringify({
        level1: {
          level2: {
            target: 'found',
            ignore: 'ignored'
          },
          other: 'also ignored'
        },
        array: ['item1', 'item2']
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
        }
      );
      
      const parsed = JSON.parse(result);
      expect(parsed["/level1/level2/target"]).toBe('found');
      expect(parsed["/array/0"]).toBe('item1');
      expect(parsed["/array/1"]).toBe('item2');
      expect(parsed["/level1/level2/ignore"]).toBeUndefined();
    });

    it('should handle wildcard includes', () => {
      const json = JSON.stringify({
        items: {
          item1: 'value1',
          item2: 'value2',
          item3: 'value3'
        }
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
        }
      );
      
      const parsed = JSON.parse(result);
      expect(parsed["/items/item1"]).toBe('value1');
      expect(parsed["/items/item2"]).toBe('value2');
      expect(parsed["/items/item3"]).toBe('value3');
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
        }
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
        }
      );
      
      const parsed = JSON.parse(result);
      expect(parsed["/test"]).toBeNull();
      expect(parsed["/valid"]).toBe('value');
    });

    it('should handle arrays with mixed types', () => {
      const json = JSON.stringify({ mixed: [1, 'string', true, null, { nested: 'object' }] });
      const result = parseJson(
        json,
        path.join(__dirname, '../__mocks__', 'test.json'),
        {
          jsonSchema: {
            '**/*.json': {
              include: ['$.mixed[*]'],
            },
          },
        }
      );
      
      const parsed = JSON.parse(result);
      expect(parsed["/mixed/0"]).toBe(1);
      expect(parsed["/mixed/1"]).toBe('string');
      expect(parsed["/mixed/2"]).toBe(true);
      expect(parsed["/mixed/3"]).toBeNull();
      expect(parsed["/mixed/4/nested"]).toBe('object');
    });
  });
});
