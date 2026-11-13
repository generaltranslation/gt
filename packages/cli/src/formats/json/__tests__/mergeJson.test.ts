import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeJson, applyTransformations } from '../mergeJson';
import { logger } from '../../../console/logger.js';
import { exitSync } from '../../../console/logging.js';
import { configureApiClient } from '../../../utils/api.js';
import type { AdditionalOptions } from '../../../types/index.js';

vi.mock('../../../console/logger.js');
vi.mock('../../../console/logging.js');

type Schema = NonNullable<AdditionalOptions['jsonSchema']>[string];
type Transform = Parameters<typeof applyTransformations>[1];

/**
 * Merges per-locale translated content into `original` under `schema` and
 * returns the parsed outputs.
 */
function merge(
  original: unknown,
  schema: Schema,
  translations: Record<string, unknown>,
  {
    defaultLocale = 'en',
    localeOrder,
    options = {},
  }: {
    defaultLocale?: string;
    localeOrder?: string[];
    options?: AdditionalOptions;
  } = {}
) {
  return mergeJson(
    JSON.stringify(original),
    'test.json',
    { ...options, jsonSchema: { '**/*.json': schema } },
    Object.entries(translations).map(([targetLocale, translated]) => ({
      targetLocale,
      translatedContent: JSON.stringify(translated),
    })),
    defaultLocale,
    localeOrder
  ).map((merged) => JSON.parse(merged));
}

const localeArray = (include: string[], extra = {}): Schema => ({
  composite: {
    '$.items': { type: 'array', include, key: '$.locale', ...extra },
  },
});

const localeObject = (include: string[], extra = {}): Schema => ({
  composite: { '$.translations': { type: 'object', include, ...extra } },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(exitSync).mockImplementation(() => {
    throw new Error('Process exit called');
  });
});

describe('mergeJson', () => {
  describe('without a matching schema', () => {
    it.each<[string, string, AdditionalOptions]>([
      [
        'no glob matches the file',
        'file.txt',
        { jsonSchema: { '**/*.json': { include: ['$.test'] } } },
      ],
      ['no jsonSchema is configured', 'test.json', {}],
    ])(
      'returns the translated content as is when %s',
      (_name, file, options) => {
        expect(
          mergeJson(
            '{"test":"value"}',
            file,
            options,
            [
              {
                translatedContent: '{"translated":"contenido"}',
                targetLocale: 'es',
              },
            ],
            'en'
          )
        ).toEqual(['{"translated":"contenido"}']);
      }
    );
  });

  describe('include schema', () => {
    const original = {
      title: 'English Title',
      app: { buttons: { save: 'Save' } },
      metadata: { author: 'John Doe', version: '1.0.0' },
    };

    it('writes one merged document per target, keeping untranslated fields', () => {
      expect(
        merge(
          original,
          { include: ['$.title', '$.app.buttons.*'] },
          {
            es: { '/title': 'Título Español', '/app/buttons/save': 'Guardar' },
            fr: { '/title': 'Titre Français' },
          }
        )
      ).toEqual([
        {
          ...original,
          title: 'Título Español',
          app: { buttons: { save: 'Guardar' } },
        },
        { ...original, title: 'Titre Français' },
      ]);
    });

    it('ignores translated pointers that do not resolve in the source', () => {
      expect(
        merge(
          original,
          { include: ['$.title'] },
          {
            es: {
              '/title': 'Título Español',
              '/invalid/path': 'Invalid Value',
              '/invalid[malformed': 'Bad Path',
            },
          }
        )
      ).toEqual([{ ...original, title: 'Título Español' }]);
    });

    it('returns nothing when there are no targets', () => {
      expect(merge(original, { include: ['$.title'] }, {})).toEqual([]);
    });
  });

  describe('composite array schema', () => {
    it('appends an item per target locale, keeping other locales and untranslated fields', () => {
      const en = {
        locale: 'en',
        title: 'English Title',
        desc: 'English Description',
        settings: { published: true, priority: 5 },
      };
      const es = { locale: 'es', title: 'Título Español', desc: 'Descripción' };

      const result = merge(
        { items: [en, es] },
        localeArray(['$.title', '$.desc']),
        {
          fr: {
            '/items': { '/0': { '/title': 'Titre', '/desc': 'Description' } },
          },
          de: { '/items': { '/0': { '/title': 'Titel' } } },
        }
      );

      // Composite schemas produce a single document holding every locale.
      expect(result).toEqual([
        {
          items: [
            en,
            es,
            { ...en, locale: 'fr', title: 'Titre', desc: 'Description' },
            { ...en, locale: 'de', title: 'Titel' },
          ],
        },
      ]);
    });

    it('replaces every existing item of the target locale', () => {
      const [merged] = merge(
        {
          items: [
            { locale: 'en', title: 'English Title' },
            { locale: 'fr', title: 'Titre Français Original' },
            { locale: 'en', title: 'English Phrase' },
            { locale: 'fr', title: 'Titre Français Phrase1' },
          ],
        },
        localeArray(['$.title']),
        {
          fr: {
            '/items': {
              '/0': { '/title': 'Titre Français Traduit' },
              '/2': { '/title': 'Titre Français Phrase2' },
            },
          },
        }
      );

      expect(merged.items).toEqual([
        { locale: 'en', title: 'English Title' },
        { locale: 'en', title: 'English Phrase' },
        { locale: 'fr', title: 'Titre Français Traduit' },
        { locale: 'fr', title: 'Titre Français Phrase2' },
      ]);
    });

    it('supports nested key paths', () => {
      const [merged] = merge(
        { items: [{ meta: { locale: 'en' }, title: 'English Title' }] },
        {
          composite: {
            '$.items': {
              type: 'array',
              include: ['$.title'],
              key: '$.meta.locale',
            },
          },
        },
        { fr: { '/items': { '/0': { '/title': 'Titre Français' } } } }
      );

      expect(merged.items).toEqual([
        { meta: { locale: 'en' }, title: 'English Title' },
        { meta: { locale: 'fr' }, title: 'Titre Français' },
      ]);
    });

    it('omits configured properties from generated locale entries', () => {
      // Mintlify language entries support `default: true` on the default
      // language; cloning it into every locale would declare multiple defaults
      const en = {
        language: 'en',
        default: true,
        hidden: false,
        tabs: [{ tab: 'Guides' }],
      };

      const [merged] = merge(
        { navigation: { languages: [en] } },
        {
          composite: {
            '$.navigation.languages': {
              type: 'array',
              include: ['$..tab'],
              key: '$.language',
              omitProperties: ['default'],
            },
          },
        },
        {
          es: { '/navigation/languages': { '/0': { '/tabs/0/tab': 'Guías' } } },
        }
      );

      expect(merged.navigation.languages).toEqual([
        en,
        { language: 'es', hidden: false, tabs: [{ tab: 'Guías' }] },
      ]);
    });

    it('applies transforms to generated items, with or without translations', () => {
      const original = {
        redirects: [
          // No key, so not a default-locale item
          { source: '/en/path-0', destination: '/en/path-0#section-0' },
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
        ],
        languages: [
          {
            language: 'en',
            translation: 'hello',
            tabs: [{ pages: ['en/link-1/', 'en/link-2/'] }],
          },
          { translation: 'hello', tabs: [{ pages: ['en/link-1/'] }] },
        ],
      };
      const localizePath = {
        match: '^/{locale}/(.*)$',
        replace: '/{locale}/$1',
      };

      const [merged] = merge(
        original,
        {
          composite: {
            '$.redirects': {
              type: 'array',
              key: '$.language',
              include: [],
              transform: {
                '$.source': localizePath,
                '$.destination': localizePath,
              },
            },
            '$.languages': {
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
          },
        },
        { es: { '/languages': { '/0': { '/translation': 'hola' } } } }
      );

      expect(merged).toEqual({
        redirects: [
          ...original.redirects,
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
        ],
        languages: [
          ...original.languages,
          {
            language: 'es',
            translation: 'hola',
            tabs: [{ pages: ['es/link-1/', 'es/link-2/'] }],
          },
        ],
      });
    });

    describe('locale keys', () => {
      const original = {
        navigation: {
          languages: [
            { language: 'en', tabs: [{ tab: 'Home', pages: ['docs/index'] }] },
          ],
        },
      };
      const languages = (extra = {}): Schema => ({
        composite: {
          '$.navigation.languages': {
            type: 'array',
            include: ['$.tabs[*].tab', '$.tabs[*].pages[*]'],
            key: '$.language',
            ...extra,
          },
        },
      });

      it('uses the canonical locale as the key when experimentalCanonicalLocaleKeys is set', () => {
        configureApiClient({
          baseUrl: 'https://api.example.com',
          customMapping: { 'fr-ca': { code: 'fr-CA' } },
        });

        const [merged] = merge(
          original,
          languages(),
          {
            'fr-ca': {
              '/navigation/languages': {
                '/0': {
                  '/language': 'fr-ca',
                  '/tabs/0/tab': 'Accueil',
                  '/tabs/0/pages/0': 'docs/fr-ca/index',
                },
              },
            },
          },
          {
            localeOrder: ['fr-ca'],
            options: { experimentalCanonicalLocaleKeys: true },
          }
        );
        configureApiClient({ baseUrl: 'https://api.example.com' });

        expect(merged.navigation.languages).toEqual([
          ...original.navigation.languages,
          {
            language: 'fr-CA',
            tabs: [{ tab: 'Accueil', pages: ['docs/fr-ca/index'] }],
          },
        ]);
      });

      it('uses the configured locale tag for keys and transforms by default', () => {
        // Without experimentalCanonicalLocaleKeys, the locale key and any
        // {locale} in a transform must both use the tag exactly as configured.
        // Canonicalizing here would emit a "fr-CA" key and docs/fr-CA/ paths
        // while the files on disk and the localized URLs both use "fr-ca".
        const [merged] = merge(
          original,
          languages({
            transform: {
              '$..pages[*]': {
                match: '^docs/(.*)$',
                replace: 'docs/{locale}/$1',
              },
            },
          }),
          {
            'fr-ca': {
              '/navigation/languages': {
                '/0': {
                  '/tabs/0/tab': 'Accueil',
                  '/tabs/0/pages/0': 'docs/index',
                },
              },
            },
          },
          { localeOrder: ['fr-ca'] }
        );

        expect(merged.navigation.languages).toEqual([
          ...original.navigation.languages,
          {
            language: 'fr-ca',
            tabs: [{ tab: 'Accueil', pages: ['docs/fr-ca/index'] }],
          },
        ]);
      });
    });

    describe('experimentalSort', () => {
      const sorted = (
        experimentalSort: string,
        languages: string[],
        targetLocale: string,
        defaultLocale: string,
        localeOrder: string[]
      ): string[] => {
        const index = languages.indexOf(defaultLocale);
        const [merged] = merge(
          { languages: languages.map((language) => ({ language, tab: 'x' })) },
          {
            composite: {
              '$.languages': {
                type: 'array',
                include: ['$.tab'],
                key: '$.language',
                experimentalSort,
              },
            },
          } as Schema,
          {
            [targetLocale]: {
              '/languages': { [`/${index}`]: { '/tab': 'y' } },
            },
          },
          { defaultLocale, localeOrder }
        );
        return merged.languages.map(
          (item: { language: string }) => item.language
        );
      };

      it.each([
        [
          'orders items like the locales list',
          'locales',
          ['ja', 'en'],
          'es',
          'en',
          ['en', 'es', 'ja'],
          ['en', 'es', 'ja'],
        ],
        [
          'puts the default locale first when the locales list omits it',
          'locales',
          ['ja', 'en'],
          'es',
          'en',
          ['es', 'ja'],
          ['en', 'es', 'ja'],
        ],
        [
          'orders alphabetically after the default locale',
          'localesAlphabetical',
          ['en', 'ja'],
          'de',
          'ja',
          ['en', 'de', 'ja'],
          ['ja', 'de', 'en'],
        ],
      ])(
        '%s',
        (_name, sort, languages, target, defaultLocale, order, expected) => {
          expect(sorted(sort, languages, target, defaultLocale, order)).toEqual(
            expected
          );
        }
      );
    });

    describe('items that cannot be merged', () => {
      it('warns and leaves the file alone when no item has the default locale', () => {
        const original = { items: [{ locale: 'fr', title: 'Titre Français' }] };

        expect(
          merge(original, localeArray(['$.title']), {
            es: { '/items': { '/0': { '/title': 'Test' } } },
          })
        ).toEqual([original]);
        expect(logger.warn).toHaveBeenCalledWith(
          'Matching sourceItems not found at path: /items. Check that your JSON file includes the key field. Skipping this target'
        );
      });

      it.each([
        ['has no entry for the array', { '/different/path': {} }],
        ['has an empty entry for the array', { '/items': {} }],
      ])(
        'warns and skips a target that %s when there is no transform',
        (_name, translated) => {
          const original = {
            items: [{ locale: 'en', title: 'English Title' }],
          };

          expect(
            merge(original, localeArray(['$.title']), { es: translated })
          ).toEqual([original]);
          expect(logger.warn).toHaveBeenCalledWith(
            'Translated JSON for locale: es does not have a valid sourceObjectPointer: /items. Skipping this target'
          );
        }
      );

      it('remaps a mismatched positional key onto a lone source item', () => {
        // Translated content has key /1 (wrong — from save-local bug)
        // instead of /0 (correct — default locale position)
        const [merged] = merge(
          { items: [{ locale: 'en', title: 'Hello' }] },
          localeArray(['$.title']),
          { es: { '/items': { '/1': { '/title': 'Hola' } } } }
        );

        expect(merged.items).toEqual([
          { locale: 'en', title: 'Hello' },
          { locale: 'es', title: 'Hola' },
        ]);
      });

      it('warns and skips a positional key that maps to no source item', () => {
        const [merged] = merge(
          { items: [{ locale: 'en', title: 'English Title' }] },
          localeArray(['$.title']),
          {
            es: {
              '/items': {
                '/0': { '/title': 'Título Español' },
                '/1': { '/title': 'Another Item' },
              },
            },
          }
        );

        expect(merged.items).toEqual([
          { locale: 'en', title: 'English Title' },
          { locale: 'es', title: 'Título Español' },
        ]);
        expect(logger.warn).toHaveBeenCalledWith(
          'Skipping translated item at /1: cannot map to source item at path /items'
        );
      });

      it('warns when fewer items are added than removed', () => {
        const [merged] = merge(
          {
            items: [
              { locale: 'en', title: 'English Title 1' },
              { locale: 'es', title: 'Spanish Title 1' },
              { locale: 'es', title: 'Spanish Title 2' },
            ],
          },
          localeArray(['$.title']),
          { es: { '/items': { '/0': { '/title': 'Updated Spanish Title' } } } }
        );

        expect(merged.items).toEqual([
          { locale: 'en', title: 'English Title 1' },
          { locale: 'es', title: 'Updated Spanish Title' },
        ]);
        expect(logger.warn).toHaveBeenCalledWith(
          'Items to add (1) is less than items to remove (2) at path: /items. Some translated items may have been skipped.'
        );
      });
    });
  });

  describe('composite object schema', () => {
    it('adds or replaces the entry keyed by the target locale', () => {
      const en = { title: 'English Title', desc: 'English Description' };
      const es = { title: 'Título Español', desc: 'Descripción Española' };

      const [merged] = merge(
        { translations: { en, es, fr: { title: 'Titre Original' } } },
        localeObject(['$.title', '$.desc']),
        {
          fr: { '/translations': { '/title': 'Titre Français' } },
          de: {
            '/translations': { '/title': 'Titel', '/desc': 'Beschreibung' },
          },
        }
      );

      expect(merged.translations).toEqual({
        en,
        es,
        fr: { ...en, title: 'Titre Français' },
        de: { title: 'Titel', desc: 'Beschreibung' },
      });
    });

    it('merges string values keyed by locale', () => {
      const [merged] = merge(
        { content: { en: 'Contact name, phone number, email, 2' } },
        { composite: { '$.content': { type: 'object', include: ['$.*'] } } },
        {
          es: {
            '/content': 'Nombre del contacto, número de teléfono, email, 2',
          },
        }
      );

      expect(merged.content).toEqual({
        en: 'Contact name, phone number, email, 2',
        es: 'Nombre del contacto, número de teléfono, email, 2',
      });
    });

    it('merges every composite object in the schema', () => {
      const [merged] = merge(
        {
          nav: { en: { home: 'Home' } },
          content: { en: { title: 'Title' } },
        },
        {
          composite: {
            '$.nav': { type: 'object', include: ['$.*'] },
            '$.content': { type: 'object', include: ['$.*'] },
          },
        },
        {
          es: {
            '/nav': { '/home': 'Inicio' },
            '/content': { '/title': 'Título' },
          },
        }
      );

      expect(merged).toEqual({
        nav: { en: { home: 'Home' }, es: { home: 'Inicio' } },
        content: { en: { title: 'Title' }, es: { title: 'Título' } },
      });
    });

    it('applies transforms to generated entries without translations', () => {
      const original = {
        redirects: {
          decoy: { source: '/en/path-0', destination: '/en/path-0#section-0' },
          en: { source: '/en/path-1', destination: '/en/path-1#section-1' },
        },
      };
      const localizePath = {
        match: '^/{locale}/(.*)$',
        replace: '/{locale}/$1',
      };

      const [merged] = merge(
        original,
        {
          composite: {
            '$.redirects': {
              type: 'object',
              include: [],
              transform: {
                '$.source': localizePath,
                '$.destination': localizePath,
              },
            },
          },
        },
        { es: {} }
      );

      expect(merged.redirects).toEqual({
        ...original.redirects,
        es: { source: '/es/path-1', destination: '/es/path-1#section-1' },
      });
    });

    it('warns and skips a target with no translations when there is no transform', () => {
      const original = { translations: { en: { title: 'English Title' } } };

      expect(merge(original, localeObject([]), { es: {} })).toEqual([original]);
      expect(logger.warn).toHaveBeenCalledWith(
        'Translated JSON for locale: es does not have a valid sourceObjectPointer: /translations. Skipping this target'
      );
    });
  });

  describe('fatal errors', () => {
    it.each<[string, unknown, Schema, string]>([
      [
        'the schema has neither include nor composite',
        { test: 'value' },
        {},
        'No include or composite property found in JSON schema',
      ],
      [
        'an array composite points at a non-array',
        { items: 'not-an-array' },
        localeArray(['$.title']),
        'Source object value is not an array at path: /items',
      ],
      [
        'an object composite points at a non-object',
        { translations: 'not-an-object' },
        localeObject(['$.title']),
        'Source object value is not an object at path: /translations',
      ],
      [
        'an object composite points at null',
        { translations: null },
        localeObject(['$.title']),
        'Source object value is not an object at path: /translations',
      ],
      [
        'an object composite has no default-locale entry',
        { translations: { fr: { title: 'Titre Français' } } },
        localeObject(['$.title']),
        'Source item not found at path: /translations. You must specify a source item where its key matches the default locale',
      ],
    ])('exits when %s', (_name, original, schema, message) => {
      expect(() => merge(original, schema, { es: {} })).toThrow(
        'Process exit called'
      );
      expect(logger.error).toHaveBeenCalledWith(message);
      expect(exitSync).toHaveBeenCalledWith(1);
    });

    it('exits when the original file is not valid JSON', () => {
      expect(() =>
        mergeJson(
          '{ "key": value }',
          'invalid.json',
          { jsonSchema: { '**/*.json': { include: ['$..*'] } } },
          [{ translatedContent: '{}', targetLocale: 'es' }],
          'en'
        )
      ).toThrow('Process exit called');
      expect(logger.error).toHaveBeenCalledWith(
        'Invalid JSON file: invalid.json'
      );
      expect(exitSync).toHaveBeenCalledWith(1);
    });

    it('throws when translated content is not valid JSON', () => {
      expect(() =>
        mergeJson(
          JSON.stringify({ items: [{ locale: 'en', title: 'English Title' }] }),
          'test.json',
          { jsonSchema: { '**/*.json': localeArray(['$.title']) } },
          [{ translatedContent: '{ "invalid": json }', targetLocale: 'es' }],
          'en'
        )
      ).toThrow(SyntaxError);
    });
  });
});

describe('applyTransformations', () => {
  it.each<[string, Transform, unknown, unknown]>([
    [
      'replaces the whole value when there is no match',
      { '$.title': { replace: 'Bienvenido' } },
      { title: 'Welcome', description: 'This is a great app' },
      { title: 'Bienvenido', description: 'This is a great app' },
    ],
    [
      'replaces every occurrence of a match',
      { '$.path': { match: '/en/', replace: '/es/' } },
      { path: '/en/docs/tutorial/en/' },
      { path: '/es/docs/tutorial/es/' },
    ],
    [
      'fills locale placeholders in replace from the target locale',
      {
        '$.code': { replace: '{locale}.example.com' },
        '$.name': { replace: 'Página en {localeName} ({locale})' },
        '$.native': { replace: 'Página en {localeNativeName}' },
        '$.unknown': { replace: 'Hola {unknownProperty} from {locale}' },
      },
      { code: 'a', name: 'b', native: 'c', unknown: 'd' },
      {
        code: 'es.example.com',
        name: 'Página en Spanish (es)',
        native: 'Página en español',
        unknown: 'Hola {unknownProperty} from es',
      },
    ],
    [
      'fills locale placeholders in match from the default locale',
      {
        '$.url': { match: '/{locale}/', replace: '/es/' },
        '$.path': { match: '/{localeCode}/', replace: '/{locale}/' },
        '$.docs': {
          match: '/{locale}/docs/{localeName}',
          replace: '/es/documentos/Español',
        },
      },
      {
        url: 'https://example.com/en/page',
        path: '/en/docs',
        docs: 'https://example.com/en/docs/English',
      },
      {
        url: 'https://example.com/es/page',
        path: '/es/docs',
        docs: 'https://example.com/es/documentos/Español',
      },
    ],
    [
      'follows nested, wildcard and recursive JSONPaths',
      {
        '$.metadata.info.name': { replace: 'Nombre' },
        '$.buttons[*].url': { match: '/en/', replace: '/es/' },
        '$..links[*].href': { match: '/en/', replace: '/es/' },
      },
      {
        metadata: { info: { name: 'Name' } },
        buttons: [
          { text: 'Save', url: '/en/save' },
          { text: 'Cancel', url: '/en/cancel' },
        ],
        navigation: {
          main: { links: [{ href: '/en/home', label: 'Home' }] },
          footer: { links: [{ href: '/en/contact', label: 'Contact' }] },
        },
      },
      {
        metadata: { info: { name: 'Nombre' } },
        buttons: [
          { text: 'Save', url: '/es/save' },
          { text: 'Cancel', url: '/es/cancel' },
        ],
        navigation: {
          main: { links: [{ href: '/es/home', label: 'Home' }] },
          footer: { links: [{ href: '/es/contact', label: 'Contact' }] },
        },
      },
    ],
    [
      'skips transforms whose replace is not a string',
      {
        '$.title': { replace: null as unknown as string },
        '$.count': { replace: 100 as unknown as string },
      },
      { title: 'Original Title', count: 42 },
      { title: 'Original Title', count: 42 },
    ],
    [
      'skips paths that match nothing and values that are not strings',
      {
        '$.nonexistent': { replace: 'New Value' },
        '$.title': { replace: 'Título' },
        '$.count': { replace: 'Cuarenta y dos' },
        '$.enabled': { replace: 'verdadero' },
        '$.config': { replace: 'configuración' },
      },
      {
        title: 'Title',
        count: 42,
        enabled: true,
        config: { setting: 'value' },
      },
      {
        title: 'Título',
        count: 42,
        enabled: true,
        config: { setting: 'value' },
      },
    ],
    [
      'does nothing for an empty transform',
      {},
      { title: 'Title' },
      { title: 'Title' },
    ],
    [
      'does nothing without a transform',
      undefined,
      { title: 'Title' },
      { title: 'Title' },
    ],
  ])('%s', (_name, transform, item, expected) => {
    applyTransformations(item as never, transform, 'es', 'en');

    expect(item).toEqual(expected);
  });
});
