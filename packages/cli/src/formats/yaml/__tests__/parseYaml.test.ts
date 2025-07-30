import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import parseYaml from '../parseYaml';
import { readFileSync } from 'fs';
import path from 'path';
import { logError, exit } from '../../../console/logging.js';

vi.mock('../../../console/logging.js');
const mockLogError = vi.mocked(logError);
const mockExit = vi.mocked(exit).mockImplementation(() => {
  throw new Error('Process exit called');
});

describe('parseYaml', () => {
  beforeEach(() => {
    mockLogError.mockClear();
    mockExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should parse a YAML file with include schema', () => {
    const yaml = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file1.yaml'),
      'utf8'
    );
    const result = parseYaml(
      yaml,
      path.join(__dirname, '../__mocks__', 'test_file1.yaml'),
      {
        yamlSchema: {
          '**/*.yaml': {
            include: ['$.title', '$.description', '$.content.sections[*].name'],
          },
        },
      }
    );
    expect(result).toBeDefined();
    const { content: resultContent, fileFormat } = result;

    // parseYaml returns JSON.stringify of the flattened result
    const parsedResult = JSON.parse(resultContent);
    expect(parsedResult['/title']).toBe('Sample YAML Title');
    expect(parsedResult['/description']).toBe('This is a sample YAML file');
    expect(parsedResult['/content/sections/0/name']).toBe('Introduction');
    expect(parsedResult['/content/sections/1/name']).toBe('Features');
    expect(fileFormat).toBe('JSON');
  });

  it('should parse a simple YAML file with nested paths', () => {
    const yaml = readFileSync(
      path.join(__dirname, '../__mocks__', 'test_file2.yaml'),
      'utf8'
    );
    const result = parseYaml(
      yaml,
      path.join(__dirname, '../__mocks__', 'test_file2.yaml'),
      {
        yamlSchema: {
          '**/*.yaml': {
            include: ['$.name', '$.items[*]', '$.nested.deep.value'],
          },
        },
      }
    );
    expect(result).toBeDefined();
    const { content: resultContent, fileFormat } = result;
    // parseYaml returns JSON.stringify of the flattened result
    const parsedResult = JSON.parse(resultContent);
    expect(parsedResult['/name']).toBe('Simple Test');
    expect(parsedResult['/items/0']).toBe('item1');
    expect(parsedResult['/items/1']).toBe('item2');
    expect(parsedResult['/items/2']).toBe('item3');
    expect(parsedResult['/nested/deep/value']).toBe('found me');
    expect(fileFormat).toBe('JSON');
  });

  it('should handle wildcard includes', () => {
    const yaml = `
config:
  settings:
    theme: "dark"
    language: "en"
    notifications: true
    advanced:
      debug: false
      cache: true
`;
    const result = parseYaml(yaml, 'test.yaml', {
      yamlSchema: {
        '**/*.yaml': {
          include: ['$.config.settings.*'],
        },
      },
    });

    expect(result).toBeDefined();
    const { content: resultContent, fileFormat } = result;
    // parseYaml returns JSON.stringify of the flattened result using flattenJsonWithStringFilter
    // which only includes string values, not booleans
    const parsedResult = JSON.parse(resultContent);
    expect(parsedResult['/config/settings/theme']).toBe('dark');
    expect(parsedResult['/config/settings/language']).toBe('en');
    // notifications is boolean so it's filtered out by flattenJsonWithStringFilter
    expect(parsedResult['/config/settings/notifications']).toBeUndefined();
    expect(fileFormat).toBe('JSON');
  });

  it('should handle recursive includes', () => {
    const yaml = `
navigation:
  main:
    links:
      - text: "Home"
        url: "/home"
      - text: "About"
        url: "/about"
  footer:
    links:
      - text: "Contact"
        url: "/contact"
`;
    const result = parseYaml(yaml, 'test.yaml', {
      yamlSchema: {
        '**/*.yaml': {
          include: ['$..text'],
        },
      },
    });

    expect(result).toBeDefined();
    const { content: resultContent, fileFormat } = result;
    // parseYaml returns JSON.stringify of the flattened result
    const parsedResult = JSON.parse(resultContent);
    expect(parsedResult['/navigation/main/links/0/text']).toBe('Home');
    expect(parsedResult['/navigation/main/links/1/text']).toBe('About');
    expect(parsedResult['/navigation/footer/links/0/text']).toBe('Contact');
    expect(fileFormat).toBe('JSON');
  });

  describe('Error Handling', () => {
    it('should exit with error for invalid YAML file', () => {
      const malformedYaml = `
title: "Valid start"
  invalid: indentation
    bad: structure
`;

      expect(() => {
        parseYaml(
          malformedYaml,
          path.join(__dirname, '../__mocks__', 'invalid.yaml'),
          {
            yamlSchema: {
              '**/*.yaml': {
                include: ['$.title'],
              },
            },
          }
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        `Invalid YAML file: ${path.join(__dirname, '../__mocks__', 'invalid.yaml')}`
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should throw error for malformed YAML', () => {
      const malformedYaml = `
title: "Start"
  bad indentation: true
    worse: structure
`;

      expect(() => {
        parseYaml(
          malformedYaml,
          path.join(__dirname, '../__mocks__', 'test.yaml'),
          {
            yamlSchema: {
              '**/*.yaml': {
                include: ['$.title'],
              },
            },
          }
        );
      }).toThrow();
    });

    it('should handle empty YAML content gracefully', () => {
      const result = parseYaml(
        '',
        path.join(__dirname, '../__mocks__', 'test.yaml'),
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.title'],
            },
          },
        }
      );

      // Empty YAML should return empty result
      expect(result).toBeDefined();
    });
  });

  describe('Schema Pattern Matching', () => {
    it('should return original content when no schema matches file path', () => {
      const yaml = 'title: "Test Content"';
      const result = parseYaml(yaml, '/different/path/file.txt', {
        yamlSchema: {
          '**/*.yaml': {
            include: ['$.title'],
          },
        },
      });

      expect(result).toBeDefined();
      const { content: resultContent, fileFormat } = result;
      expect(resultContent).toBe(yaml);
      expect(fileFormat).toBe('YAML');
    });

    it('should return original content when no yamlSchema option provided', () => {
      const yaml = 'title: "Test Content"';
      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'test.yaml'),
        {}
      );

      expect(result).toBeDefined();
      const { content: resultContent, fileFormat } = result;
      expect(resultContent).toBe(yaml);
      expect(fileFormat).toBe('YAML');
    });

    it('should match specific file patterns', () => {
      const yaml = 'title: "Specific Content"';
      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'specific.yaml'),
        {
          yamlSchema: {
            '**/specific.yaml': {
              include: ['$.title'],
            },
          },
        }
      );

      expect(result).toBeDefined();
      const { content: resultContent, fileFormat } = result;
      const parsedResult = JSON.parse(resultContent);
      expect(parsedResult['/title']).toBe('Specific Content');
      expect(fileFormat).toBe('JSON');
    });
  });

  describe('Include Schema Tests', () => {
    it('should handle complex nested includes', () => {
      const yaml = `
level1:
  level2:
    target: "found"
    ignore: "ignored"
  other: "also ignored"
array:
  - "item1"
  - "item2"
`;

      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'test.yaml'),
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.level1.level2.target', '$.array[*]'],
            },
          },
        }
      );

      expect(result).toBeDefined();
      const { content: resultContent, fileFormat } = result;
      const parsedResult = JSON.parse(resultContent);
      expect(parsedResult['/level1/level2/target']).toBe('found');
      expect(parsedResult['/array/0']).toBe('item1');
      expect(parsedResult['/array/1']).toBe('item2');
      expect(parsedResult['/level1/level2/ignore']).toBeUndefined();
      expect(fileFormat).toBe('JSON');
    });

    it('should handle array wildcard includes', () => {
      const yaml = `
items:
  item1: "value1"
  item2: "value2"
  item3: "value3"
`;

      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'test.yaml'),
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.items.*'],
            },
          },
        }
      );

      const { content: resultContent, fileFormat } = result;
      const parsedResult = JSON.parse(resultContent);
      expect(parsedResult['/items/item1']).toBe('value1');
      expect(parsedResult['/items/item2']).toBe('value2');
      expect(parsedResult['/items/item3']).toBe('value3');
      expect(fileFormat).toBe('JSON');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty objects', () => {
      const yaml = '{}';
      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'test.yaml'),
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.*'],
            },
          },
        }
      );

      expect(result).toBeDefined();
      const { content: resultContent, fileFormat } = result;
      expect(resultContent.trim()).toBe('{}');
      expect(fileFormat).toBe('JSON');
    });

    it('should handle null values in YAML', () => {
      const yaml = `
test: null
valid: "value"
`;
      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'test.yaml'),
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.*'],
            },
          },
        }
      );

      expect(result).toBeDefined();
      const { content: resultContent, fileFormat } = result;
      const parsedResult = resultContent
        .split('\n')
        .filter((line) => line.trim());
      expect(parsedResult.some((line) => line.includes('value'))).toBe(true);
      expect(fileFormat).toBe('JSON');
    });

    it('should handle arrays with mixed types', () => {
      const yaml = `
mixed:
  - 1
  - "string"
  - true
  - null
  - nested: "object"
`;
      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'test.yaml'),
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.mixed[*]'],
            },
          },
        }
      );

      const { content: resultContent, fileFormat } = result;
      const parsedResult = JSON.parse(resultContent);
      expect(parsedResult['/mixed/1']).toBe('string');
      expect(fileFormat).toBe('JSON');
    });

    it('should handle special YAML characters properly', () => {
      const yaml = `
quotes: "Text with quotes and apostrophes"
unicode: "Unicode: éñ中"
special: "Special chars: @#$%"
`;

      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'test.yaml'),
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.*'],
            },
          },
        }
      );

      expect(result).toBeDefined();
      const { content: resultContent, fileFormat } = result;
      const parsedResult = JSON.parse(resultContent);
      expect(parsedResult['/quotes']).toBe('Text with quotes and apostrophes');
      expect(parsedResult['/unicode']).toBe('Unicode: éñ中');
      expect(fileFormat).toBe('JSON');
    });

    it('should handle YAML edge cases with special keys', () => {
      const yaml = `
"weird-key": "value1"
"123": "value2"
"": "empty key"
"$special": "dollar sign"
"@attribute": "at sign"
"space key": "space value"
`;

      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'test.yaml'),
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.*'],
            },
          },
        }
      );

      const { content: resultContent, fileFormat } = result;
      const parsedResult = JSON.parse(resultContent);
      expect(parsedResult['/weird-key']).toBe('value1');
      expect(parsedResult['/123']).toBe('value2');
      expect(parsedResult['/']).toBe('empty key');
      expect(parsedResult['/$special']).toBe('dollar sign');
      expect(parsedResult['/@attribute']).toBe('at sign');
      expect(parsedResult['/space key']).toBe('space value');
      expect(fileFormat).toBe('JSON');
    });

    it('should preserve original formatting for non-matching files', () => {
      const originalYaml = `title: "Original"
description: "Content"`;

      const result = parseYaml(
        originalYaml,
        '/path/to/unmatched/file.txt', // doesn't match any schema
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.*'],
            },
          },
        }
      );

      expect(result).toBeDefined();
      const { content: resultContent, fileFormat } = result;
      expect(resultContent).toBe(originalYaml);
      expect(fileFormat).toBe('YAML');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle configuration file structure', () => {
      const yaml = `
app:
  name: "My Application"
  version: "1.2.3"
  settings:
    debug: false
    theme: "dark"
    features:
      - "authentication"
      - "notifications"
      - "analytics"
database:
  host: "localhost"
  port: 5432
  name: "myapp_db"
`;

      const result = parseYaml(yaml, 'config.yaml', {
        yamlSchema: {
          '**/*.yaml': {
            include: [
              '$.app.name',
              '$.app.settings.theme',
              '$.app.settings.features[*]',
            ],
          },
        },
      });

      const { content: resultContent, fileFormat } = result;
      const parsedResult = JSON.parse(resultContent);
      expect(parsedResult['/app/name']).toBe('My Application');
      expect(parsedResult['/app/settings/theme']).toBe('dark');
      expect(parsedResult['/app/settings/features/0']).toBe('authentication');
      expect(parsedResult['/app/settings/features/1']).toBe('notifications');
      expect(parsedResult['/app/settings/features/2']).toBe('analytics');
      expect(fileFormat).toBe('JSON');
    });

    it('should handle deeply nested YAML paths', () => {
      const yaml = `
deep:
  nesting:
    structure:
      content: "English content"
      meta:
        author: "John"
        tags:
          - "important"
          - "documentation"
`;

      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'test.yaml'),
        {
          yamlSchema: {
            '**/*.yaml': {
              include: [
                '$.deep.nesting.structure.content',
                '$.deep.nesting.structure.meta.author',
                '$.deep.nesting.structure.meta.tags[*]',
              ],
            },
          },
        }
      );

      const { content: resultContent, fileFormat } = result;
      const parsedResult = JSON.parse(resultContent);
      expect(parsedResult['/deep/nesting/structure/content']).toBe(
        'English content'
      );
      expect(parsedResult['/deep/nesting/structure/meta/author']).toBe('John');
      expect(parsedResult['/deep/nesting/structure/meta/tags/0']).toBe(
        'important'
      );
      expect(parsedResult['/deep/nesting/structure/meta/tags/1']).toBe(
        'documentation'
      );
      expect(fileFormat).toBe('JSON');
    });

    it('should handle multiple file glob patterns', () => {
      const yaml = 'content: "test content"';

      // Test that more specific patterns take precedence
      const result = parseYaml(
        yaml,
        path.join(__dirname, '../__mocks__', 'specific-config.yaml'),
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.content'],
            },
            '**/specific-*.yaml': {
              include: ['$.*'], // More inclusive for specific files
            },
          },
        }
      );

      expect(result).toBeDefined();
      const { content: resultContent, fileFormat } = result;
      const parsedResult = JSON.parse(resultContent);
      expect(parsedResult['/content']).toBe('test content');
      expect(fileFormat).toBe('JSON');
    });
  });
});
