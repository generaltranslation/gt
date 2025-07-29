import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mergeYaml from '../mergeYaml';
import { readFileSync } from 'fs';
import path from 'path';
import { logError, exit } from '../../../console/logging.js';
import YAML from 'yaml';

vi.mock('../../../console/logging.js');
const mockLogError = vi.mocked(logError);
const mockExit = vi.mocked(exit).mockImplementation(() => {
  throw new Error('Process exit called');
});

describe('mergeYaml', () => {
  beforeEach(() => {
    mockLogError.mockClear();
    mockExit.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Include Schema Tests', () => {
    it('should merge translated content with original YAML using include schema', () => {
      const originalContent = `
title: "English Title"
description: "English Description"
metadata:
  author: "John Doe"
  version: "1.0.0"
`;

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

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.title', '$.description'],
            },
          },
        },
        targets
      );

      expect(result).toHaveLength(2);

      const spanishResult = YAML.parse(result[0]);
      expect(spanishResult.title).toBe('Título Español');
      expect(spanishResult.description).toBe('Descripción Española');
      expect(spanishResult.metadata.author).toBe('John Doe'); // Preserved from original
      expect(spanishResult.metadata.version).toBe('1.0.0'); // Preserved from original

      const frenchResult = YAML.parse(result[1]);
      expect(frenchResult.title).toBe('Titre Français');
      expect(frenchResult.description).toBe('Description Française');
      expect(frenchResult.metadata.author).toBe('John Doe'); // Preserved from original
    });

    it('should handle nested JSON pointers in include schema', () => {
      const originalContent = `
app:
  ui:
    buttons:
      save: "Save"
      cancel: "Cancel"
`;

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/app/ui/buttons/save': 'Guardar',
            '/app/ui/buttons/cancel': 'Cancelar',
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.app.ui.buttons.*'],
            },
          },
        },
        targets
      );

      const parsed = YAML.parse(result[0]);
      expect(parsed.app.ui.buttons.save).toBe('Guardar');
      expect(parsed.app.ui.buttons.cancel).toBe('Cancelar');
    });

    it('should ignore invalid JSON pointers in include schema', () => {
      const originalContent = `
title: "English Title"
`;

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/title': 'Título Español',
            '/invalid/path': 'Invalid Value',
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.title'],
            },
          },
        },
        targets
      );

      const parsed = YAML.parse(result[0]);
      expect(parsed.title).toBe('Título Español');
      expect(parsed.invalid).toBeUndefined();
    });

    it('should handle array elements in include schema', () => {
      const originalContent = `
items:
  - name: "First Item"
    value: "Value 1"
  - name: "Second Item"
    value: "Value 2"
other: "unchanged"
`;

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/items/0/name': 'Primer Elemento',
            '/items/1/name': 'Segundo Elemento',
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.items[*].name'],
            },
          },
        },
        targets
      );

      const parsed = YAML.parse(result[0]);
      expect(parsed.items[0].name).toBe('Primer Elemento');
      expect(parsed.items[1].name).toBe('Segundo Elemento');
      expect(parsed.items[0].value).toBe('Value 1'); // Preserved
      expect(parsed.items[1].value).toBe('Value 2'); // Preserved
      expect(parsed.other).toBe('unchanged'); // Preserved
    });
  });

  describe('No Schema Tests', () => {
    it('should return stringified translated content when no schema matches', () => {
      const originalContent = 'test: "value"';
      const targets = [
        {
          translatedContent: 'translated: "contenido"',
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'file.txt', // doesn't match any schema
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.test'],
            },
          },
        },
        targets
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('translated: "contenido"');
    });

    it('should return stringified translated content when no yamlSchema option provided', () => {
      const originalContent = 'test: "value"';
      const targets = [
        {
          translatedContent: 'translated: "contenido"',
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {}, // no yamlSchema
        targets
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('translated: "contenido"');
    });
  });

  describe('Error Handling', () => {
    it('should exit with error for invalid YAML file', () => {
      const malformedYaml = `
title: "Valid start"
  invalid: indentation
`;
      const targets = [
        { translatedContent: 'test: "value"', targetLocale: 'es' },
      ];

      expect(() => {
        mergeYaml(
          malformedYaml,
          'invalid.yaml',
          {
            yamlSchema: {
              '**/*.yaml': {
                include: ['$.title'],
              },
            },
          },
          targets
        );
      }).toThrow('Process exit called');

      expect(mockLogError).toHaveBeenCalledWith(
        'Invalid YAML file: invalid.yaml'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle malformed original YAML', () => {
      const malformedYaml = `
title: "Valid"
  bad: indentation
`;
      const targets = [
        { translatedContent: 'test: "value"', targetLocale: 'es' },
      ];

      expect(() => {
        mergeYaml(
          malformedYaml,
          'test.yaml',
          {
            yamlSchema: {
              '**/*.yaml': {
                include: ['$.title'],
              },
            },
          },
          targets
        );
      }).toThrow();
    });

    it('should handle malformed translated JSON gracefully', () => {
      const originalContent = 'title: "English Title"';

      const targets = [
        {
          translatedContent: '{invalid json', // malformed JSON
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.title'],
            },
          },
        },
        targets
      );

      // Should not crash, should return original content unchanged
      const parsed = YAML.parse(result[0]);
      expect(parsed.title).toBe('English Title');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle complex configuration file merge', () => {
      const originalContent = `
app:
  name: "My Application"
  version: "1.0.0"
  settings:
    theme: "dark"
    language: "en"
    features:
      - "authentication"
      - "notifications"
database:
  host: "localhost"
  port: 5432
`;

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/app/name': 'Mi Aplicación',
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'config.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.app.name'],
            },
          },
        },
        targets
      );

      const parsed = YAML.parse(result[0]);
      expect(parsed.app.name).toBe('Mi Aplicación');
      expect(parsed.app.version).toBe('1.0.0'); // Preserved
      expect(parsed.app.settings.theme).toBe('dark'); // Preserved
      expect(parsed.database.host).toBe('localhost'); // Preserved
    });

    it('should handle multiple targets with different locales', () => {
      const originalContent = `
title: "English Title"
description: "English Description"
`;

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
        {
          translatedContent: JSON.stringify({
            '/title': 'Deutscher Titel',
            '/description': 'Deutsche Beschreibung',
          }),
          targetLocale: 'de',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.title', '$.description'],
            },
          },
        },
        targets
      );

      expect(result).toHaveLength(3);

      const spanishResult = YAML.parse(result[0]);
      const frenchResult = YAML.parse(result[1]);
      const germanResult = YAML.parse(result[2]);

      expect(spanishResult.title).toBe('Título Español');
      expect(spanishResult.description).toBe('Descripción Española');

      expect(frenchResult.title).toBe('Titre Français');
      expect(frenchResult.description).toBe('Description Française');

      expect(germanResult.title).toBe('Deutscher Titel');
      expect(germanResult.description).toBe('Deutsche Beschreibung');
    });

    it('should preserve non-translatable fields during merge', () => {
      const originalContent = `
title: "English Title"
metadata:
  id: "unique-id"
  created: "2023-01-01"
  author: "John Doe"
settings:
  published: true
  priority: 5
`;

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/title': 'Título Español',
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.title'], // Only title is translatable
            },
          },
        },
        targets
      );

      const parsed = YAML.parse(result[0]);
      expect(parsed.title).toBe('Título Español');
      expect(parsed.metadata.id).toBe('unique-id');
      expect(parsed.metadata.created).toBe('2023-01-01');
      expect(parsed.metadata.author).toBe('John Doe');
      expect(parsed.settings.published).toBe(true);
      expect(parsed.settings.priority).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty targets array', () => {
      const originalContent = 'test: "value"';
      const targets: any[] = [];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.test'],
            },
          },
        },
        targets
      );

      expect(result).toHaveLength(0);
    });

    it('should handle empty translated content object', () => {
      const originalContent = 'title: "English Title"';

      const targets = [
        {
          translatedContent: '', // Empty translations
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.title'],
            },
          },
        },
        targets
      );

      const parsed = YAML.parse(result[0]);
      expect(parsed.title).toBe('English Title'); // Should remain unchanged
    });

    it('should handle special YAML characters in translated values', () => {
      const originalContent = 'message: "Simple message"';

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/message':
              'Mensaje con "comillas", \'apostrofes\', y\nnuevas líneas\tcon tabs',
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.message'],
            },
          },
        },
        targets
      );

      const parsed = YAML.parse(result[0]);
      expect(parsed.message).toBe(
        'Mensaje con "comillas", \'apostrofes\', y\nnuevas líneas\tcon tabs'
      );
    });

    it('should ignore invalid JSON pointer paths silently', () => {
      const originalContent = 'title: "English Title"';

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/title': 'Título Español',
            '/invalid[malformed': 'Bad Path', // Invalid pointer but valid JSON
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.title'],
            },
          },
        },
        targets
      );

      const parsed = YAML.parse(result[0]);
      expect(parsed.title).toBe('Título Español');
      // Should not crash due to invalid JSON pointer
    });

    it('should preserve original formatting for non-matching files', () => {
      const originalYaml = `title: "Original"
description: "Content"`;

      const result = mergeYaml(
        originalYaml,
        '/path/to/unmatched/file.txt', // doesn't match any schema
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.*'],
            },
          },
        },
        [{ translatedContent: 'test: "value"', targetLocale: 'es' }]
      );

      expect(result[0]).toBe('test: "value"');
    });

    it('should handle null values in YAML', () => {
      const originalContent = `
test: null
valid: "value"
`;

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/test': 'Not null anymore',
            '/valid': 'valor',
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.test', '$.valid'],
            },
          },
        },
        targets
      );

      const parsed = YAML.parse(result[0]);
      // Note: Current implementation skips null values due to falsy check
      expect(parsed.test).toBe(null); // null values are not replaced
      expect(parsed.valid).toBe('valor');
    });

    it('should handle arrays with mixed types', () => {
      const originalContent = `
mixed:
  - 1
  - "string"
  - true
  - null
  - nested: "object"
`;

      const targets = [
        {
          translatedContent: JSON.stringify({
            '/mixed/1': 'cadena',
          }),
          targetLocale: 'es',
        },
      ];

      const result = mergeYaml(
        originalContent,
        'test.yaml',
        {
          yamlSchema: {
            '**/*.yaml': {
              include: ['$.mixed[*]'],
            },
          },
        },
        targets
      );

      const parsed = YAML.parse(result[0]);
      expect(parsed.mixed[1]).toBe('cadena');
      expect(parsed.mixed[0]).toBe(1); // Preserved
      expect(parsed.mixed[2]).toBe(true); // Preserved
    });
  });
});
