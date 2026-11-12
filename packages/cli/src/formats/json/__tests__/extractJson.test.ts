import { readFileSync } from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractJson } from '../extractJson';
import { logger } from '../../../console/logger.js';
import { exitSync } from '../../../console/logging.js';
import { configureCustomMapping } from '../../../utils/api.js';
import type { AdditionalOptions } from '../../../types/index.js';

vi.mock('../../../console/logger.js');
vi.mock('../../../console/logging.js');

type Schema = NonNullable<AdditionalOptions['jsonSchema']>[string];

/** Extracts the `locale` values of `json` under `schema`, parsed. */
const extract = (
  json: unknown,
  schema: Schema,
  locale = 'es',
  options: AdditionalOptions = {}
) => {
  const result = extractJson(
    JSON.stringify(json),
    'test.json',
    { ...options, jsonSchema: { '**/*.json': schema } },
    locale,
    'en'
  );
  return result === null ? null : JSON.parse(result);
};

const localeArray = (include: string[], key = '$.locale'): Schema => ({
  composite: { '$.items': { type: 'array', include, key } },
});

const localeObject = (include: string[]): Schema => ({
  composite: { '$.translations': { type: 'object', include } },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(exitSync).mockImplementation(() => {
    throw new Error('Process exit called');
  });
});

describe('extractJson', () => {
  it.each<[string, string, AdditionalOptions]>([
    [
      'no glob matches the file',
      'file.txt',
      { jsonSchema: { '**/*.json': { include: ['$.title'] } } },
    ],
    ['no jsonSchema is configured', 'test.json', {}],
  ])('returns null when %s', (_name, file, options) => {
    expect(
      extractJson('{"title":"Hello"}', file, options, 'es', 'en')
    ).toBeNull();
  });

  it('returns null and logs an error for invalid JSON', () => {
    expect(
      extractJson(
        '{ invalid json }',
        'test.json',
        { jsonSchema: { '**/*.json': { include: ['$.title'] } } },
        'es',
        'en'
      )
    ).toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Invalid JSON file: test.json');
  });

  it('exits when the schema has neither include nor composite', () => {
    expect(() => extract({ title: 'Test' }, {})).toThrow('Process exit called');
    expect(logger.error).toHaveBeenCalledWith(
      'No include or composite property found in JSON schema'
    );
    expect(exitSync).toHaveBeenCalledWith(1);
  });

  it('flattens the included paths of an include schema', () => {
    expect(
      extract(
        {
          title: 'Título Español',
          app: { buttons: { save: 'Guardar', cancel: 'Cancelar' } },
          metadata: { author: 'John Doe', version: '1.0.0' },
        },
        { include: ['$.title', '$.app.buttons.*'] }
      )
    ).toEqual({
      '/title': 'Título Español',
      '/app/buttons/save': 'Guardar',
      '/app/buttons/cancel': 'Cancelar',
    });
  });

  describe('composite array schema', () => {
    it.each<[string, unknown[], unknown]>([
      [
        'keys target items by the position of the default-locale item',
        [
          { locale: 'en', title: 'English Title', desc: 'English Description' },
          { locale: 'es', title: 'Título Español', desc: 'Descripción' },
        ],
        { '/0': { '/title': 'Título Español', '/desc': 'Descripción' } },
      ],
      [
        'uses the default-locale position even when the target item comes first',
        [
          { locale: 'es', title: 'Título Español' },
          { locale: 'en', title: 'English Title' },
        ],
        { '/1': { '/title': 'Título Español' } },
      ],
      [
        'pairs several target items with the default-locale items in order',
        [
          { locale: 'en', title: 'English Title 1' },
          { locale: 'es', title: 'Título Español 1' },
          { locale: 'en', title: 'English Title 2' },
          { locale: 'es', title: 'Título Español 2' },
        ],
        {
          '/0': { '/title': 'Título Español 1' },
          '/2': { '/title': 'Título Español 2' },
        },
      ],
      [
        'falls back to the target position when there is no default-locale item',
        [{ title: 'No locale field' }, { locale: 'es', title: 'Spanish' }],
        { '/1': { '/title': 'Spanish' } },
      ],
    ])('%s', (_name, items, expected) => {
      expect(extract({ items }, localeArray(['$.title', '$.desc']))).toEqual({
        '/items': expected,
      });
    });

    it('supports nested source paths, key paths and include paths', () => {
      const page = (language: string, ...links: string[]) => ({
        meta: { language },
        sections: { nav: { links: links.map((text) => ({ text })) } },
      });

      expect(
        extract(
          {
            data: {
              pages: [
                page('en', 'Home', 'About'),
                page('es', 'Inicio', 'Acerca'),
              ],
            },
          },
          {
            composite: {
              '$.data.pages': {
                type: 'array',
                include: ['$.sections.nav.links[*].text'],
                key: '$.meta.language',
              },
            },
          }
        )
      ).toEqual({
        '/data/pages': {
          '/0': {
            '/sections/nav/links/0/text': 'Inicio',
            '/sections/nav/links/1/text': 'Acerca',
          },
        },
      });
    });

    it('matches the canonical locale when experimentalCanonicalLocaleKeys is set', () => {
      configureCustomMapping({ 'fr-ca': { code: 'fr-CA' } });

      const result = extract(
        {
          items: [
            { locale: 'en', title: 'English Title' },
            { locale: 'fr-CA', title: 'Titre Français Canadien' },
          ],
        },
        localeArray(['$.title']),
        'fr-ca',
        { experimentalCanonicalLocaleKeys: true }
      );
      configureCustomMapping(undefined);

      expect(result).toEqual({
        '/items': { '/0': { '/title': 'Titre Français Canadien' } },
      });
    });

    it.each([
      ['pt-BR', 'Anúncios', 'Introdução', 'Funcionalidades'],
      ['en', 'Announcements', 'Introduction', 'Features'],
    ])(
      'extracts the %s entries of a Mintlify navigation structure',
      (locale, anchor, firstTab, secondTab) => {
        const result = extractJson(
          readFileSync(
            path.join(__dirname, '../__mocks__', 'test_file1.json'),
            'utf8'
          ),
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
          locale,
          'en'
        );

        // Keyed by the position of the default-locale (en) entry.
        const languages = JSON.parse(result!)['/navigation/languages'];
        expect(Object.keys(languages)).toEqual(['/0']);
        expect(languages['/0']).toMatchObject({
          '/global/anchors/0/anchor': anchor,
          '/global/anchors/1/anchor': 'Status',
          '/tabs/0/tab': firstTab,
          '/tabs/1/tab': secondTab,
        });
      }
    );

    it.each<[string, unknown, string]>([
      [
        'no item has the target locale',
        [{ locale: 'en', title: 'English Title' }],
        'No matching items found for locale es at path: /items',
      ],
      [
        'the array is empty',
        [],
        'No matching items found for locale es at path: /items',
      ],
      [
        'the source is not an array',
        'not-an-array',
        'Source object value is not an array at path: /items',
      ],
    ])('warns and extracts nothing when %s', (_name, items, warning) => {
      expect(extract({ items }, localeArray(['$.title']))).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(warning);
    });
  });

  describe('composite object schema', () => {
    it('extracts the target-locale entry of every composite object', () => {
      expect(
        extract(
          {
            nav: {
              en: { home: 'Home', about: 'About' },
              es: { home: 'Inicio', about: 'Acerca de' },
            },
            content: {
              en: { title: 'Title', body: 'Body' },
              es: { title: 'Título', body: 'Cuerpo' },
            },
          },
          {
            composite: {
              '$.nav': { type: 'object', include: ['$.*'] },
              '$.content': { type: 'object', include: ['$.title'] },
            },
          }
        )
      ).toEqual({
        '/nav': { '/home': 'Inicio', '/about': 'Acerca de' },
        '/content': { '/title': 'Título' },
      });
    });

    it('uses a string target-locale entry directly', () => {
      expect(
        extract(
          {
            content: {
              en: 'Contact name, phone number, email, 2',
              es: 'Nombre del contacto, número de teléfono, email, 2',
            },
          },
          { composite: { '$.content': { type: 'object', include: ['$.*'] } } }
        )
      ).toEqual({
        '/content': 'Nombre del contacto, número de teléfono, email, 2',
      });
    });

    it.each<[string, unknown, string]>([
      [
        'no entry has the target locale',
        { en: { title: 'English Title' } },
        'No matching item found for locale es at path: /translations',
      ],
      [
        'the object is empty',
        {},
        'No matching item found for locale es at path: /translations',
      ],
      [
        'the source is not an object',
        'not-an-object',
        'Source object value is not an object at path: /translations',
      ],
      [
        'the source is null',
        null,
        'Source object value is not an object at path: /translations',
      ],
    ])('warns and extracts nothing when %s', (_name, translations, warning) => {
      expect(extract({ translations }, localeObject(['$.title']))).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(warning);
    });
  });
});
