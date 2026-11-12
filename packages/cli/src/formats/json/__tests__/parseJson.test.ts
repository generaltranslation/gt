import { readFileSync } from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseJson } from '../parseJson';
import { logger } from '../../../console/logger.js';
import { exitSync } from '../../../console/logging.js';
import type { AdditionalOptions } from '../../../types/index.js';

vi.mock('../../../console/logger.js');
vi.mock('../../../console/logging.js');

type Schema = NonNullable<AdditionalOptions['jsonSchema']>[string];

/** Parses `json` under `schema` and returns the parsed source strings. */
const parse = (json: unknown, schema: Schema) =>
  JSON.parse(
    parseJson(
      JSON.stringify(json),
      'test.json',
      { jsonSchema: { '**/*.json': schema } },
      'en'
    )
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(exitSync).mockImplementation(() => {
    throw new Error('Process exit called');
  });
});

describe('parseJson', () => {
  describe('schema selection', () => {
    const formatted = `{
  "formatted": {
    "nicely": "yes"
  }
}`;

    it.each<[string, string, AdditionalOptions]>([
      [
        'no glob matches the file',
        '/path/to/unmatched/file.txt',
        { jsonSchema: { '**/*.json': { include: ['$..*'] } } },
      ],
      ['no jsonSchema is configured', 'test.json', {}],
    ])('returns the content untouched when %s', (_name, file, options) => {
      expect(parseJson(formatted, file, options, 'en')).toBe(formatted);
    });

    it('uses the schema whose glob matches the file', () => {
      expect(
        parseJson(
          '{"test":"value","other":"ignored"}',
          path.join(process.cwd(), 'config', 'specific.json'),
          {
            jsonSchema: {
              '**/unrelated.json': { include: ['$..*'] },
              '**/specific.json': { include: ['$.test'] },
            },
          },
          'en'
        )
      ).toBe('{"/test":"value"}');
    });
  });

  describe('include schema', () => {
    it('flattens every included string to a JSON pointer', () => {
      expect(
        parse(
          {
            object: { key1: 'value1', key2: 'value2' },
            array: ['value1', 'value2'],
          },
          { include: ['$..*'] }
        )
      ).toEqual({
        '/object/key1': 'value1',
        '/object/key2': 'value2',
        '/array/0': 'value1',
        '/array/1': 'value2',
      });
    });

    it('keeps only the included paths', () => {
      expect(
        parse(
          {
            level1: {
              level2: { target: 'found', ignore: 'ignored' },
              other: 'also ignored',
            },
            array: ['item1', 'item2'],
            items: { item1: 'value1', item2: 'value2' },
          },
          { include: ['$.level1.level2.target', '$.array[*]', '$.items.*'] }
        )
      ).toEqual({
        '/level1/level2/target': 'found',
        '/array/0': 'item1',
        '/array/1': 'item2',
        '/items/item1': 'value1',
        '/items/item2': 'value2',
      });
    });

    it('skips values that are not strings', () => {
      expect(
        parse(
          {
            test: null,
            mixed: [1, 'string', true, null, { nested: 'object' }],
          },
          { include: ['$.test', '$.mixed[*]'] }
        )
      ).toEqual({ '/mixed/1': 'string' });
      expect(parse({}, { include: ['$..*'] })).toEqual({});
    });

    it('builds pointers for keys with unusual characters', () => {
      expect(
        parse(
          {
            'weird-key': 'value1',
            '123': 'value2',
            '': 'empty key',
            $special: 'dollar sign',
            '@attribute': 'at sign',
            'space key': 'space value',
          },
          { include: ['$..*'] }
        )
      ).toEqual({
        '/weird-key': 'value1',
        '/123': 'value2',
        '/': 'empty key',
        '/$special': 'dollar sign',
        '/@attribute': 'at sign',
        '/space key': 'space value',
      });
    });
  });

  describe('composite schema', () => {
    it('extracts the default-locale entry of objects and every default-locale item of arrays', () => {
      const en = { key1: 'value1', key2: 'value2' };
      const fr = { key1: 'valeur1', key2: 'valeur2' };

      expect(
        parse(
          {
            object: { en, fr },
            array: [
              { locale: 'en', ...en },
              { locale: 'fr', ...fr },
              { locale: 'en', key1: 'value3' },
            ],
          },
          {
            composite: {
              '$.object': { type: 'object', include: ['$..*'] },
              '$.array': { type: 'array', include: ['$.*'], key: '$.locale' },
            },
          }
        )
      ).toEqual({
        '/object': { '/key1': 'value1', '/key2': 'value2' },
        // The key itself is never sent for translation.
        '/array': {
          '/0': { '/key1': 'value1', '/key2': 'value2' },
          '/2': { '/key1': 'value3' },
        },
      });
    });

    it('supports nested source paths, key paths and include paths', () => {
      expect(
        parse(
          {
            deep: {
              structure: {
                en: { content: 'English content', meta: { author: 'John' } },
                fr: { content: 'Contenu français', meta: { author: 'Jean' } },
              },
            },
            items: [
              { meta: { locale: 'en' }, title: 'English Title' },
              { meta: { locale: 'fr' }, title: 'Titre Français' },
            ],
          },
          {
            composite: {
              '$.deep.structure': {
                type: 'object',
                include: ['$.content', '$.meta.author'],
              },
              '$.items': {
                type: 'array',
                include: ['$.title'],
                key: '$.meta.locale',
              },
            },
          }
        )
      ).toEqual({
        '/deep/structure': {
          '/content': 'English content',
          '/meta/author': 'John',
        },
        '/items': { '/0': { '/title': 'English Title' } },
      });
    });

    it('matches locales by the configured localeProperty', () => {
      expect(
        parse(
          {
            translations: {
              English: { title: 'English Title' },
              Français: { title: 'Titre Français' },
            },
            items: [
              { lang: 'English', title: 'English Title' },
              { lang: 'Français', title: 'Titre Français' },
              { lang: 'English', title: 'English Title 2' },
            ],
          },
          {
            composite: {
              '$.translations': {
                type: 'object',
                include: ['$.title'],
                localeProperty: 'name',
              },
              '$.items': {
                type: 'array',
                include: ['$.title'],
                key: '$.lang',
                localeProperty: 'name',
              },
            },
          }
        )
      ).toEqual({
        '/translations': { '/title': 'English Title' },
        '/items': {
          '/0': { '/title': 'English Title' },
          '/2': { '/title': 'English Title 2' },
        },
      });
    });

    it('uses a string default-locale entry directly', () => {
      expect(
        parse(
          {
            content: {
              en: 'Contact name, phone number, email, 2',
              fr: 'Nom du contact, numéro de téléphone, email, 2',
            },
          },
          { composite: { '$.content': { type: 'object', include: ['$.*'] } } }
        )
      ).toEqual({ '/content': 'Contact name, phone number, email, 2' });
    });

    it('extracts nothing from transform-only composites', () => {
      const transform = {
        '$.source': { match: '^/{locale}/(.*)$', replace: '/{locale}/$1' },
      };

      expect(
        parse(
          {
            redirects: [{ language: 'en', source: '/en/path-1' }],
            aliases: { en: { source: '/en/path-1' } },
          },
          {
            composite: {
              '$.redirects': {
                type: 'array',
                include: [],
                key: '$.language',
                transform,
              },
              '$.aliases': { type: 'object', include: [], transform },
            },
          }
        )
      ).toEqual({});
    });

    it('extracts a Mintlify navigation structure', () => {
      const file = path.join(__dirname, '../__mocks__', 'test_file1.json');

      const result = parseJson(
        readFileSync(file, 'utf8'),
        file,
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

      const languages = JSON.parse(result)['/navigation/languages'];
      expect(Object.keys(languages)).toEqual(['/0']);
      expect(languages['/0']).toMatchObject({
        '/global/anchors/0/anchor': 'Announcements',
        '/global/anchors/1/anchor': 'Status',
        '/tabs/0/tab': 'Introduction',
        '/tabs/1/tab': 'Features',
      });
    });
  });

  describe('fatal errors', () => {
    const object = (extra = {}): Schema => ({
      composite: { '$.test': { type: 'object', include: ['$..*'], ...extra } },
    });
    const array = (extra = {}): Schema => ({
      composite: { '$.test': { type: 'array', include: ['$..*'], ...extra } },
    });

    it.each<[string, unknown, Schema, string]>([
      [
        'include and composite are both provided',
        { test: 'value' },
        { include: ['$..*'], ...object() },
        'include and composite cannot be used together in the same JSON schema',
      ],
      [
        'neither include nor composite is provided',
        { test: 'value' },
        {},
        'No include or composite property found in JSON schema',
      ],
      [
        'an array composite points at a non-array',
        { test: 'not-an-array' },
        array({ key: '$.locale' }),
        'Source object value is not an array at path: /test',
      ],
      [
        'an object composite points at a non-object',
        { test: 'not-an-object' },
        object(),
        'Source object value is not an object at path: /test',
      ],
      [
        'an array composite has no key',
        { test: [{ locale: 'en', value: 'test' }] },
        array(),
        'Source object options key is required for array at path: /test',
      ],
      [
        'an object composite has a key',
        { test: { en: 'value' } },
        object({ key: '$.locale' }),
        'Source object options key is not allowed for object at path: /test',
      ],
      [
        'no array item has the default locale',
        { test: [{ locale: 'fr', value: 'test' }] },
        array({ key: '$.locale' }),
        'Matching sourceItem not found at path: /test for locale: en. Check your JSON schema',
      ],
      [
        'no object entry has the default locale',
        { test: { fr: 'value' } },
        object(),
        'Source item not found at path: /test. You must specify a source item where its key matches the default locale',
      ],
      [
        'the key matches several fields of an array item',
        { test: [{ locale: 'en', nested: { locale: 'en' }, value: 'test' }] },
        array({ key: '$..locale' }),
        'Source item at path: /test has multiple matching keys with path: $..locale',
      ],
    ])('exits when %s', (_name, json, schema, message) => {
      expect(() => parse(json, schema)).toThrow('Process exit called');
      expect(logger.error).toHaveBeenCalledWith(message);
      expect(exitSync).toHaveBeenCalledWith(1);
    });

    it.each(['{ "key": value }', ''])(
      'exits when the content is not valid JSON: %j',
      (content) => {
        expect(() =>
          parseJson(
            content,
            'invalid.json',
            { jsonSchema: { '**/*.json': { include: ['$..*'] } } },
            'en'
          )
        ).toThrow('Process exit called');
        expect(logger.error).toHaveBeenCalledWith(
          'Invalid JSON file: invalid.json'
        );
        expect(exitSync).toHaveBeenCalledWith(1);
      }
    );
  });
});
