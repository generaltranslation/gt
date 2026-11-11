import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';
import { extractYaml } from '../extractYaml.js';
import mergeYaml from '../mergeYaml';
import parseYaml from '../parseYaml';
import { validateYamlSchema } from '../utils';
import { exitSync } from '../../../console/logging.js';
import { logger } from '../../../console/logger.js';
import type { AdditionalOptions } from '../../../types/index.js';

vi.mock('../../../console/logger.js');
vi.mock('../../../console/logging.js');

const schema = (...include: string[]): AdditionalOptions => ({
  yamlSchema: { '**/*.yaml': { include } },
});

const INVALID_YAML = `
title: "Valid start"
  invalid: indentation
bad: structure
`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(exitSync).mockImplementation(() => {
    throw new Error('Process exit called');
  });
});

describe('validateYamlSchema', () => {
  const title = { include: ['$.title'] };
  const content = { include: ['$.content'] };

  it.each<[string, Record<string, unknown>, string, unknown]>([
    ['a recursive glob', { '**/*.yaml': title }, 'path/to/test.yaml', title],
    ['a file name glob', { '*.yaml': title }, 'test.yaml', title],
    [
      'a ./ relative path',
      { '**/*.yaml': title },
      './relative/file.yaml',
      title,
    ],
    [
      'an absolute path under the working directory',
      { 'src/**/*.yaml': title },
      path.join(process.cwd(), 'src/components/Button.yaml'),
      title,
    ],
    [
      'paths with spaces and symbols',
      { '**/*.yaml': title },
      'path/with spaces/file@2023 name.yaml',
      title,
    ],
    [
      'brace expansion',
      { '**/*.{yaml,yml}': title },
      'path/to/file.yml',
      title,
    ],
    [
      'an empty include list',
      { '**/*.yaml': { include: [] } },
      'a.yaml',
      { include: [] },
    ],
    [
      'the first glob that matches',
      { 'config/**/*.yaml': title, '**/*.yaml': content, '**/app.yaml': title },
      'other/app.yaml',
      content,
    ],
    [
      'no schema for another extension',
      { '**/*.yaml': title },
      'path/to/file.json',
      null,
    ],
    [
      'no schema for a path without an extension',
      { '**/*.yaml': title },
      'path/to/file',
      null,
    ],
    ['no schema for an empty path', { '**/*.yaml': title }, '', null],
    [
      'no schema for a null entry',
      { '**/*.yaml': null },
      'path/to/test.yaml',
      null,
    ],
    ['no schema for an empty yamlSchema', {}, 'path/to/test.yaml', null],
  ])('resolves %s', (_name, yamlSchema, file, expected) => {
    expect(
      validateYamlSchema({ yamlSchema } as AdditionalOptions, file)
    ).toEqual(expected);
  });

  it('returns null when no yamlSchema is configured', () => {
    expect(validateYamlSchema({}, '/path/to/test.yaml')).toBeNull();
  });

  it('exits when the matching schema has no include', () => {
    expect(() =>
      validateYamlSchema(
        { yamlSchema: { '**/*.yaml': {} } },
        'path/to/test.yaml'
      )
    ).toThrow('Process exit called');
    expect(logger.error).toHaveBeenCalledWith(
      'No include property found in YAML schema'
    );
    expect(exitSync).toHaveBeenCalledWith(1);
  });
});

describe('parseYaml', () => {
  it('flattens the included strings to JSON pointers', () => {
    const yaml = `
title: 'Sample YAML Title'
metadata:
  author: 'John Doe'
settings:
  theme: "dark"
  notifications: true
  retries: 3
  nothing: null
items:
  - 'item1'
  - 'item2'
content:
  sections:
    - name: 'Introduction'
      body: 'Welcome to our application'
    - name: 'Features'
  sidebar:
    links:
      - text: 'Home'
        url: '/home'
`;

    const result = parseYaml(
      yaml,
      'test.yaml',
      schema(
        '$.title',
        '$.settings.*',
        '$.items[*]',
        '$.content.sections[*].name',
        '$..text'
      )
    );

    expect(result.fileFormat).toBe('JSON');
    expect(JSON.parse(result.content)).toEqual({
      '/title': 'Sample YAML Title',
      '/settings/theme': 'dark',
      '/items/0': 'item1',
      '/items/1': 'item2',
      '/content/sections/0/name': 'Introduction',
      '/content/sections/1/name': 'Features',
      '/content/sidebar/links/0/text': 'Home',
    });
  });

  it.each([
    ['empty content', ''],
    ['an empty object', '{}'],
  ])('extracts nothing from %s', (_name, yaml) => {
    expect(parseYaml(yaml, 'test.yaml', schema('$.*'))).toEqual({
      content: '{}',
      fileFormat: 'JSON',
    });
  });

  it.each<[string, string, AdditionalOptions]>([
    ['no glob matches the file', '/path/to/unmatched/file.txt', schema('$.*')],
    ['no yamlSchema is configured', 'test.yaml', {}],
  ])('returns the content untouched when %s', (_name, file, options) => {
    const yaml = `title: "Original"\ndescription: "Content"`;

    expect(parseYaml(yaml, file, options)).toEqual({
      content: yaml,
      fileFormat: 'YAML',
    });
  });

  it('exits when the file is not valid YAML', () => {
    expect(() =>
      parseYaml(INVALID_YAML, 'invalid.yaml', schema('$.title'))
    ).toThrow('Process exit called');
    expect(logger.error).toHaveBeenCalledWith(
      'Invalid YAML file: invalid.yaml'
    );
    expect(exitSync).toHaveBeenCalledWith(1);
  });
});

describe('mergeYaml', () => {
  const original = `
title: "English Title"
app:
  buttons:
    save: "Save"
items:
  - name: "First Item"
    value: "Value 1"
mixed:
  - 1
  - "string"
  - true
empty: null
settings:
  published: true
  priority: 5
`;
  const parsedOriginal = YAML.parse(original);

  const merge = (...translations: Array<[string, unknown]>) =>
    mergeYaml(
      original,
      'test.yaml',
      schema('$.title', '$.app.buttons.*', '$.items[*].name', '$.mixed[*]'),
      translations.map(([targetLocale, translated]) => ({
        targetLocale,
        translatedContent:
          typeof translated === 'string'
            ? translated
            : JSON.stringify(translated),
      })),
      'en'
    ).map((merged) => YAML.parse(merged));

  it('writes one merged document per target, keeping untranslated fields', () => {
    expect(
      merge(
        [
          'es',
          {
            '/title': 'Título Español',
            '/app/buttons/save': 'Guardar',
            '/items/0/name': 'Primer Elemento',
            '/mixed/1': 'cadena',
          },
        ],
        ['fr', { '/title': 'Titre Français' }]
      )
    ).toEqual([
      {
        ...parsedOriginal,
        title: 'Título Español',
        app: { buttons: { save: 'Guardar' } },
        items: [{ name: 'Primer Elemento', value: 'Value 1' }],
        mixed: [1, 'cadena', true],
      },
      { ...parsedOriginal, title: 'Titre Français' },
    ]);
  });

  it('ignores pointers that do not resolve, including null values', () => {
    expect(
      merge([
        'es',
        {
          '/title': 'Título Español',
          '/invalid/path': 'Invalid Value',
          '/invalid[malformed': 'Bad Path',
          '/empty': 'Not null anymore',
        },
      ])
    ).toEqual([{ ...parsedOriginal, title: 'Título Español' }]);
  });

  it.each([
    ['malformed', '{invalid json'],
    ['empty', ''],
  ])(
    'leaves the document unchanged when translated content is %s',
    (_name, translated) => {
      expect(merge(['es', translated])).toEqual([parsedOriginal]);
    }
  );

  it('returns the original content when there are no targets', () => {
    expect(
      mergeYaml('test: "value"', 'test.yaml', schema('$.test'), [], 'en')
    ).toEqual(['test: "value"']);
  });

  it.each<[string, string, AdditionalOptions]>([
    ['no glob matches the file', 'file.txt', schema('$.test')],
    ['no yamlSchema is configured', 'test.yaml', {}],
  ])('returns the translated content as is when %s', (_name, file, options) => {
    expect(
      mergeYaml(
        'test: "value"',
        file,
        options,
        [{ translatedContent: 'translated: "contenido"', targetLocale: 'es' }],
        'en'
      )
    ).toEqual(['translated: "contenido"']);
  });

  it('exits when the original file is not valid YAML', () => {
    expect(() =>
      mergeYaml(
        INVALID_YAML,
        'invalid.yaml',
        schema('$.title'),
        [{ translatedContent: '{}', targetLocale: 'es' }],
        'en'
      )
    ).toThrow('Process exit called');
    expect(logger.error).toHaveBeenCalledWith(
      'Invalid YAML file: invalid.yaml'
    );
    expect(exitSync).toHaveBeenCalledWith(1);
  });
});

describe('extractYaml', () => {
  it('extracts the included strings of a merged YAML file as JSON pointers', () => {
    const mergedYaml = `
ui:
  buttons:
    submit: Enviar
    cancel: Cancelar
  labels:
    name: Nombre
    enabled: true
    count: 42
navigation:
  links:
    - text: Inicio
      url: /home
config:
  maxRetries: 5
`;

    const result = extractYaml(
      mergedYaml,
      'test.yaml',
      schema('$.ui.buttons.*', '$.ui.labels.*', '$..text')
    );

    // The same shape mergeYaml takes as translated content.
    expect(JSON.parse(result!)).toEqual({
      '/ui/buttons/submit': 'Enviar',
      '/ui/buttons/cancel': 'Cancelar',
      '/ui/labels/name': 'Nombre',
      '/navigation/links/0/text': 'Inicio',
    });
  });

  it.each<[string, string, string, AdditionalOptions]>([
    [
      'no glob matches the file',
      'title: "Test"',
      '/unmatched/path.txt',
      schema('$.title'),
    ],
    ['no yamlSchema is configured', 'title: "Test"', 'test.yaml', {}],
    [
      'every matched value is a non-string',
      'config:\n  debug: true\n  retries: 3',
      'test.yaml',
      schema('$.config.*'),
    ],
  ])('returns null when %s', (_name, yaml, file, options) => {
    expect(extractYaml(yaml, file, options)).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns null and logs an error for invalid YAML', () => {
    expect(
      extractYaml(INVALID_YAML, 'test.yaml', schema('$.title'))
    ).toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Invalid YAML file: test.yaml');
  });
});
