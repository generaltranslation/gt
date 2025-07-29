import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateYamlSchema } from '../utils';
import { logError, exit } from '../../../console/logging.js';
import path from 'path';

vi.mock('../../../console/logging.js');
const mockLogError = vi.mocked(logError);
const mockExit = vi.mocked(exit).mockImplementation(() => {
  throw new Error('Process exit called');
});

describe('validateYamlSchema', () => {
  beforeEach(() => {
    mockLogError.mockClear();
    mockExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('should return null when no yamlSchema option is provided', () => {
      const result = validateYamlSchema({}, '/path/to/test.yaml');
      expect(result).toBeNull();
    });

    it('should return null when file path does not match any glob pattern', () => {
      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.json': {
              include: ['$.title'],
            },
          },
        },
        'path/to/test.yaml'
      );
      expect(result).toBeNull();
    });

    it('should return schema when file path matches glob pattern', () => {
      const schema = {
        include: ['$.title', '$.description'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': schema,
          },
        },
        'path/to/test.yaml'
      );

      expect(result).toEqual(schema);
    });

    it('should match specific file patterns', () => {
      const schema = {
        include: ['$.content'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/config.yaml': schema,
          },
        },
        'app/config/config.yaml'
      );

      expect(result).toEqual(schema);
    });

    it('should match nested directory patterns', () => {
      const schema = {
        include: ['$.data'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            'src/**/*.yaml': schema,
          },
        },
        path.join(process.cwd(), 'src/components/Button.yaml')
      );

      expect(result).toEqual(schema);
    });

    it('should return first matching pattern when multiple patterns match', () => {
      const schema1 = {
        include: ['$.title'],
      };
      const schema2 = {
        include: ['$.description'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': schema1,
            '**/test.yaml': schema2,
          },
        },
        'path/to/test.yaml'
      );

      // Should return the first matching pattern found
      expect(result).toEqual(schema1);
    });
  });

  describe('Include Validation', () => {
    it('should return schema when include property is present', () => {
      const schema = {
        include: ['$.title', '$.body'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': schema,
          },
        },
        'path/to/test.yaml'
      );

      expect(result).toEqual(schema);
    });

    it('should exit when include property is missing', () => {
      expect(() => {
        validateYamlSchema(
          {
            yamlSchema: {
              '**/*.yaml': {
                // Missing include property
              },
            },
          },
          'path/to/test.yaml'
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'No include property found in YAML schema'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle empty include array', () => {
      const schema = {
        include: [],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': schema,
          },
        },
        'path/to/test.yaml'
      );

      expect(result).toEqual(schema);
    });

    it('should handle include with various JSONPath patterns', () => {
      const schema = {
        include: [
          '$.title',
          '$.items[*]',
          '$.config.*',
          '$..recursive',
          '$.nested.deep.value',
        ],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': schema,
          },
        },
        'path/to/test.yaml'
      );

      expect(result).toEqual(schema);
    });
  });

  describe('File Path Matching', () => {
    it('should handle absolute file paths', () => {
      const schema = {
        include: ['$.content'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': schema,
          },
        },
        'absolute/path/to/file.yaml'
      );

      expect(result).toEqual(schema);
    });

    it('should handle relative file paths', () => {
      const schema = {
        include: ['$.content'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': schema,
          },
        },
        './relative/path/file.yaml'
      );

      expect(result).toEqual(schema);
    });

    it('should handle file paths with spaces', () => {
      const schema = {
        include: ['$.content'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': schema,
          },
        },
        'path/with spaces/file name.yaml'
      );

      expect(result).toEqual(schema);
    });

    it('should handle file paths with special characters', () => {
      const schema = {
        include: ['$.content'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': schema,
          },
        },
        'path/with-dashes_and_underscores/file@2023.yaml'
      );

      expect(result).toEqual(schema);
    });
  });

  describe('Glob Pattern Matching', () => {
    it('should match simple wildcard patterns', () => {
      const schema = {
        include: ['$.data'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '*.yaml': schema,
          },
        },
        'test.yaml'
      );

      expect(result).toEqual(schema);
    });

    it('should match double wildcard patterns', () => {
      const schema = {
        include: ['$.data'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': schema,
          },
        },
        'deep/nested/path/test.yaml'
      );

      expect(result).toEqual(schema);
    });

    it('should match brace expansion patterns', () => {
      const schema = {
        include: ['$.data'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.{yaml,yml}': schema,
          },
        },
        'path/to/file.yml'
      );

      expect(result).toEqual(schema);
    });

    it('should not match when extension differs', () => {
      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.data'],
            },
          },
        },
        'path/to/file.json'
      );

      expect(result).toBeNull();
    });

    it('should handle multiple glob patterns', () => {
      const schema1 = {
        include: ['$.title'],
      };
      const schema2 = {
        include: ['$.description'],
      };
      const schema3 = {
        include: ['$.content'],
      };

      const options = {
        yamlSchema: {
          'config/**/*.yaml': schema1,
          'docs/**/*.yaml': schema2,
          '**/*.yaml': schema3,
        },
      };

      // Should match most specific pattern first
      expect(validateYamlSchema(options, 'config/app.yaml')).toEqual(schema1);
      expect(validateYamlSchema(options, 'docs/readme.yaml')).toEqual(schema2);
      expect(validateYamlSchema(options, 'other/file.yaml')).toEqual(schema3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty yamlSchema object', () => {
      const result = validateYamlSchema(
        {
          yamlSchema: {},
        },
        'path/to/test.yaml'
      );

      expect(result).toBeNull();
    });

    it('should handle yamlSchema with null values', () => {
      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': null as any,
          },
        },
        'path/to/test.yaml'
      );

      expect(result).toBeNull();
    });

    it('should handle file paths with no extension', () => {
      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.data'],
            },
          },
        },
        'path/to/file'
      );

      expect(result).toBeNull();
    });

    it('should handle empty file path', () => {
      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.data'],
            },
          },
        },
        ''
      );

      expect(result).toBeNull();
    });

    it('should handle file path that is just a filename', () => {
      const schema = {
        include: ['$.data'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '*.yaml': schema,
          },
        },
        'test.yaml'
      );

      expect(result).toEqual(schema);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical configuration file patterns', () => {
      const configSchema = {
        include: ['$.app.name', '$.app.version', '$.database.host'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            '**/config/*.yaml': configSchema,
          },
        },
        'project/config/database.yaml'
      );

      expect(result).toEqual(configSchema);
    });

    it('should handle i18n file patterns', () => {
      const i18nSchema = {
        include: ['$.**'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            'locales/**/*.yaml': i18nSchema,
          },
        },
        path.join(process.cwd(), 'locales/en/common.yaml')
      );

      expect(result).toEqual(i18nSchema);
    });

    it('should handle component documentation patterns', () => {
      const docsSchema = {
        include: ['$.title', '$.description', '$.examples[*].name'],
      };

      const result = validateYamlSchema(
        {
          yamlSchema: {
            'src/components/**/*.yaml': docsSchema,
          },
        },
        path.join(process.cwd(), 'src/components/Button/Button.yaml')
      );

      expect(result).toEqual(docsSchema);
    });

    it('should handle multiple project structures', () => {
      const options = {
        yamlSchema: {
          'apps/*/config.yaml': {
            include: ['$.app.*'],
          },
          'packages/*/package.yaml': {
            include: ['$.name', '$.description'],
          },
          'docs/**/*.yaml': {
            include: ['$.title', '$.content'],
          },
        },
      };

      expect(validateYamlSchema(options, 'apps/web/config.yaml')).toEqual({
        include: ['$.app.*'],
      });

      expect(validateYamlSchema(options, 'packages/ui/package.yaml')).toEqual({
        include: ['$.name', '$.description'],
      });

      expect(validateYamlSchema(options, 'docs/api/endpoints.yaml')).toEqual({
        include: ['$.title', '$.content'],
      });
    });
  });
});
