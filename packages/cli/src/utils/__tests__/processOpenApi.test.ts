import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import processOpenApi from '../processOpenApi.js';
import { Settings } from '../../types/index.js';

const ORIGINAL_CWD = process.cwd();

function createSettings(tmpDir: string, openapiFiles: string[]): Settings {
  return {
    config: path.join(tmpDir, 'gt.config.json'),
    configDirectory: path.join(tmpDir, '.gt'),
    baseUrl: '',
    dashboardUrl: '',
    defaultLocale: 'en',
    locales: ['es'],
    src: [],
    stageTranslations: false,
    publish: false,
    files: {
      resolvedPaths: { mdx: [], json: [] },
      placeholderPaths: { mdx: [], json: [] },
      transformPaths: {},
    },
    parsingOptions: { conditionNames: [] },
    branchOptions: { enabled: false, remoteName: 'origin' },
    options: {
      mintlify: {
        openapi: {
          files: openapiFiles,
        },
      },
    },
  } as Settings;
}

type Transform = { match: string; replace: string };

const GET_FOO = { openapi: '3.0.0', paths: { '/foo': { get: {} } } };
const POST_FOO = { openapi: '3.0.0', paths: { '/foo': { post: {} } } };

const frontmatter = (...lines: string[]) => `---\n${lines.join('\n')}\n---\n`;

/** A docs.json whose languages each hold one "API" tab with the given groups. */
const docsJson = (languages: Record<string, unknown[]>) => ({
  $schema: 'https://mintlify.com/docs.json',
  navigation: {
    languages: Object.entries(languages).map(([language, groups]) => ({
      language,
      tabs: [{ tab: 'API', groups }],
    })),
  },
});

describe('processOpenApi', () => {
  let tmpDir: string;

  const absolute = (file: string) => path.join(tmpDir, file);
  const read = (file: string) => fs.readFileSync(absolute(file), 'utf8');
  const readGroups = (language: number) =>
    JSON.parse(read('docs.json')).navigation.languages[language].tabs[0].groups;

  /**
   * Writes `files` (relative path -> content) into the project and runs
   * processOpenApi over it. `specs` are the source OpenAPI files, `pages` the
   * source MDX pages (translated to `es/<page>`), and `docs` adds docs.json to
   * the translated JSON files.
   */
  const run = async (
    {
      files,
      specs,
      transform,
      pages = [],
      docs = false,
      type = 'json',
    }: {
      files: Record<string, unknown>;
      specs: string[];
      transform: Transform | Transform[];
      pages?: string[];
      docs?: boolean;
      type?: 'json' | 'yaml';
    },
    includeFiles?: Set<string>
  ) => {
    for (const [file, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(absolute(file)), { recursive: true });
      fs.writeFileSync(
        absolute(file),
        typeof content === 'string' ? content : JSON.stringify(content, null, 2)
      );
    }
    const specFiles = [...specs, ...(docs ? ['docs.json'] : [])].map(absolute);
    const settings = createSettings(
      tmpDir,
      specs.map((spec) => `./${spec}`)
    );
    settings.files = {
      resolvedPaths: {
        ...(pages.length && { mdx: pages.map(absolute) }),
        [type]: specFiles,
      },
      placeholderPaths: {
        ...(pages.length && {
          mdx: pages.map((page) => path.join(tmpDir, '[locale]', page)),
        }),
        [type]: specFiles,
      },
      transformPaths: { [type]: transform },
    } as Settings['files'];

    await processOpenApi(settings, includeFiles);
  };

  /** Transform that prefixes each of the given files with the locale. */
  const localeDirectory = (...files: string[]): Transform => ({
    match: files.map((file) => `${file}$`).join('|'),
    replace: '{locale}/$&',
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-openapi-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('page frontmatter', () => {
    it.each([
      ['json', JSON.stringify(POST_FOO)],
      ['yaml', 'openapi: 3.0.0\npaths:\n  /foo:\n    post: {}\n'],
    ] as const)(
      'points source and translated pages at their own root-relative %s spec',
      async (type, spec) => {
        const specFile = `openapi.demo.${type}`;

        await run({
          files: {
            [specFile]: spec,
            [`es/${specFile}`]: spec,
            'page.mdx': frontmatter('openapi: POST /foo'),
            'es/page.mdx': frontmatter('openapi: POST /foo'),
          },
          specs: [specFile],
          pages: ['page.mdx'],
          transform: localeDirectory(specFile),
          type,
        });

        expect(read('page.mdx')).toContain(`/${specFile} POST /foo`);
        expect(read('es/page.mdx')).toContain(`/es/${specFile} POST /foo`);
      }
    );

    it('emits root-relative paths for nested specs and pages', async () => {
      const spec = 'openapi/dirA/dirAa/openapi.json';

      await run({
        files: {
          [spec]: POST_FOO,
          [`es/${spec}`]: POST_FOO,
          'nested/page.mdx': frontmatter('openapi: POST /foo'),
          'es/nested/page.mdx': frontmatter('openapi: POST /foo'),
        },
        specs: [spec],
        pages: ['nested/page.mdx'],
        transform: localeDirectory(spec),
      });

      expect(read('es/nested/page.mdx')).toContain(`/es/${spec} POST /foo`);
    });

    it('preserves flow-style frontmatter formatting', async () => {
      await run({
        files: {
          'openapi.demo.json': POST_FOO,
          'es/openapi.demo.json': POST_FOO,
          'page.mdx': frontmatter(
            'openapi: POST /foo',
            'keywords: ["agent job", "create"]'
          ),
          'es/page.mdx': frontmatter(
            'openapi: POST /foo',
            'keywords: ["tarea de agente", "crear"]'
          ),
        },
        specs: ['openapi.demo.json'],
        pages: ['page.mdx'],
        transform: localeDirectory('openapi.demo.json'),
      });

      expect(read('page.mdx')).toContain('/openapi.demo.json POST /foo');
      expect(read('page.mdx')).toMatch(
        /keywords:\s*\[\s*"agent job",\s*"create"\s*\]/
      );
      expect(read('es/page.mdx')).toContain('/es/openapi.demo.json POST /foo');
      expect(read('es/page.mdx')).toMatch(
        /keywords:\s*\[\s*"tarea de agente",\s*"crear"\s*\]/
      );
    });

    describe('with several specs', () => {
      const twoSpecs = async (
        specA: unknown,
        specB: unknown,
        openapi: string,
        localized = ['es/spec-a.json', 'es/spec-b.json']
      ) => {
        const contents: Record<string, unknown> = {
          'spec-a.json': specA,
          'spec-b.json': specB,
          'es/spec-a.json': specA,
          'es/spec-b.json': specB,
        };
        await run({
          files: {
            ...Object.fromEntries(
              ['spec-a.json', 'spec-b.json', ...localized].map((file) => [
                file,
                contents[file],
              ])
            ),
            'page.mdx': frontmatter(`openapi: ${openapi}`),
            'es/page.mdx': frontmatter(`openapi: ${openapi}`),
          },
          specs: ['spec-a.json', 'spec-b.json'],
          pages: ['page.mdx'],
          transform: localeDirectory('spec-a.json', 'spec-b.json'),
        });
      };

      it('leaves an operation that several specs define unchanged', async () => {
        const dup = { openapi: '3.0.0', paths: { '/dup': { get: {} } } };

        await twoSpecs(dup, dup, 'GET /dup', ['es/spec-a.json']);

        expect(read('page.mdx')).toContain('openapi: GET /dup');
        expect(read('es/page.mdx')).toContain('openapi: GET /dup');
        expect(read('es/page.mdx')).not.toContain('/es/spec-a.json');
      });

      it('repoints an explicit spec path when the operation lives in another spec', async () => {
        await twoSpecs(
          GET_FOO,
          { openapi: '3.0.0', paths: { '/bar': { get: {} } } },
          '/spec-a.json GET /bar'
        );

        expect(read('page.mdx')).toContain('/spec-b.json GET /bar');
        expect(read('es/page.mdx')).toContain('/es/spec-b.json GET /bar');
      });

      it('resolves an explicit spec name without an extension', async () => {
        const spec = {
          openapi: '3.0.0',
          paths: { '/batch/scrape/{id}': { delete: {} } },
        };
        const openapi = 'v2-openapi DELETE /batch/scrape/{id}';
        const specs = [
          'api-reference/v1-openapi.json',
          'api-reference/v2-openapi.json',
        ];

        await run({
          files: {
            ...Object.fromEntries(
              specs.flatMap((file) => [
                [file, spec],
                [`es/${file}`, spec],
              ])
            ),
            'page.mdx': frontmatter(`openapi: ${openapi}`),
            'es/page.mdx': frontmatter(`openapi: ${openapi}`),
          },
          specs,
          pages: ['page.mdx'],
          transform: localeDirectory(...specs),
        });

        expect(read('page.mdx')).toContain(
          '/api-reference/v2-openapi.json DELETE /batch/scrape/{id}'
        );
        expect(read('es/page.mdx')).toContain(
          '/es/api-reference/v2-openapi.json DELETE /batch/scrape/{id}'
        );
      });
    });

    it('resolves an explicit leading-slash spec path against the config directory', async () => {
      await run({
        files: {
          'openapi.demo.json': POST_FOO,
          'es/openapi.demo.json': POST_FOO,
          'page.mdx': frontmatter('openapi: /openapi.demo.json POST /foo'),
          'es/page.mdx': frontmatter('openapi: /openapi.demo.json POST /foo'),
        },
        specs: ['openapi.demo.json'],
        pages: ['page.mdx'],
        transform: localeDirectory('openapi.demo.json'),
      });

      expect(read('es/page.mdx')).toContain('/es/openapi.demo.json POST /foo');
    });

    it('resolves openapi-schema refs that use an extensionless spec name (e.g. "events-schema group.created")', async () => {
      // Components-only spec (no paths) referenced by file stem, Mintlify-style.
      const spec = {
        openapi: '3.1.0',
        info: { title: 'Events', version: '1' },
        components: {
          schemas: {
            'group.created': {
              type: 'object',
              description: 'A group was created',
            },
          },
        },
      };
      const ref = frontmatter('openapi-schema: events-schema group.created');

      await run({
        files: {
          'events-schema.json': spec,
          'es/events-schema.json': spec,
          'group.created.mdx': ref,
          'es/group.created.mdx': ref,
        },
        specs: ['events-schema.json'],
        pages: ['group.created.mdx'],
        transform: localeDirectory('events-schema.json'),
      });

      // The bare name resolves to the spec and the ref is rewritten per-locale.
      expect(read('group.created.mdx')).toContain(
        '/events-schema.json group.created'
      );
      expect(read('es/group.created.mdx')).toContain(
        '/es/events-schema.json group.created'
      );
    });
  });

  describe('docs.json', () => {
    const openapiJson = {
      files: { 'openapi.json': GET_FOO, 'es/openapi.json': GET_FOO },
      specs: ['openapi.json'],
      docs: true,
      transform: localeDirectory('openapi.json'),
    };

    it('localizes the openapi source and directory, and strips locale prefixes from openapi pages', async () => {
      const group = (pages: string[]) => ({
        group: 'Endpoints',
        openapi: { source: 'openapi.json', directory: 'api' },
        pages,
      });
      const project = {
        ...openapiJson,
        files: {
          ...openapiJson.files,
          'docs.json': docsJson({
            en: [group(['GET /foo'])],
            es: [group(['es/GET /foo'])],
          }),
        },
      };

      await run(project);

      const expected = {
        group: 'Endpoints',
        openapi: { source: 'es/openapi.json', directory: 'es/api' },
        pages: ['GET /foo'],
      };
      expect(readGroups(0)).toEqual([group(['GET /foo'])]);
      expect(readGroups(1)).toEqual([expected]);

      // A second run over its own output changes nothing.
      await run({ ...project, files: {} });

      expect(readGroups(1)).toEqual([expected]);
    });

    it('keeps default-locale registrations outside language blocks when only a target locale was downloaded', async () => {
      const registration = (directory: string) => ({
        source: 'openapi.json',
        directory,
      });
      const docs = {
        $schema: 'https://mintlify.com/docs.json',
        api: { openapi: registration('api-reference') },
        navigation: {
          groups: [
            { group: 'Shared API', openapi: registration('shared-api') },
          ],
          languages: [
            {
              language: 'en',
              groups: [{ group: 'API', openapi: registration('en/api') }],
            },
            {
              language: 'es',
              groups: [{ group: 'API', openapi: registration('es/api') }],
            },
          ],
        },
      };

      // Locadex writes target locales only, and a translate run postprocesses
      // just the files it downloaded: the composite docs.json itself.
      await run(
        { ...openapiJson, files: { ...openapiJson.files, 'docs.json': docs } },
        new Set([absolute('docs.json')])
      );

      const updated = structuredClone(docs);
      updated.navigation.languages[1].groups[0].openapi.source =
        'es/openapi.json';
      expect(JSON.parse(read('docs.json'))).toEqual(updated);
    });

    it('localizes string openapi fields for every spec', async () => {
      const reporting = {
        openapi: '3.0.0',
        paths: { '/reports': { get: {} } },
      };
      const groups = ['openapi.json', 'openapi-reporting.json'].map(
        (openapi) => ({ group: openapi, icon: 'square-terminal', openapi })
      );

      await run({
        files: {
          'openapi.json': GET_FOO,
          'es/openapi.json': GET_FOO,
          'openapi-reporting.json': reporting,
          'es/openapi-reporting.json': reporting,
          'docs.json': docsJson({ en: groups, es: groups }),
        },
        specs: ['openapi.json', 'openapi-reporting.json'],
        docs: true,
        transform: [
          { match: 'openapi\\.json$', replace: '{locale}/openapi.json' },
          {
            match: 'openapi-reporting\\.json$',
            replace: '{locale}/openapi-reporting.json',
          },
        ],
      });

      const sources = (language: number) =>
        readGroups(language).map((group: { openapi: string }) => group.openapi);
      expect(sources(0)).toEqual(['openapi.json', 'openapi-reporting.json']);
      expect(sources(1)).toEqual([
        'es/openapi.json',
        'es/openapi-reporting.json',
      ]);
    });

    it.each<
      [
        string,
        string[],
        Record<string, string>,
        Transform | Transform[],
        string,
      ]
    >([
      [
        'nests the locale inside the path and keeps the absolute style',
        ['api/specs/openapi.json', 'api/es/specs/openapi.json'],
        { source: '/api/specs/openapi.json', directory: 'api' },
        {
          match: 'api/specs/openapi\\.json$',
          replace: 'api/{locale}/specs/openapi.json',
        },
        '/api/es/specs/openapi.json',
      ],
      [
        'keeps the ./relative style',
        ['api/openapi.json', 'api/es/openapi.json'],
        { source: './api/openapi.json' },
        { match: 'api/openapi\\.json$', replace: 'api/{locale}/openapi.json' },
        './api/es/openapi.json',
      ],
      [
        'leaves the source unchanged when the localized spec is missing',
        ['openapi.json'],
        { source: 'openapi.json', directory: 'api' },
        { match: 'openapi.json$', replace: '{locale}/openapi.json' },
        'openapi.json',
      ],
      [
        'resolves a basename several specs share',
        [
          'api/a/openapi.json',
          'api/b/openapi.json',
          'api/es/a/openapi.json',
          'api/es/b/openapi.json',
        ],
        { source: 'openapi.json' },
        [
          {
            match: 'api/a/openapi\\.json$',
            replace: 'api/{locale}/a/openapi.json',
          },
          {
            match: 'api/b/openapi\\.json$',
            replace: 'api/{locale}/b/openapi.json',
          },
        ],
        'api/es/a/openapi.json',
      ],
    ])('%s', async (_name, specFiles, openapi, transform, source) => {
      await run({
        files: {
          ...Object.fromEntries(specFiles.map((file) => [file, GET_FOO])),
          'docs.json': docsJson({
            es: [{ group: 'Endpoints', openapi, pages: ['es/GET /foo'] }],
          }),
        },
        specs: specFiles.filter((file) => !file.includes('/es/')),
        docs: true,
        transform,
      });

      const [group] = readGroups(0);
      expect(group.openapi.source).toBe(source);
      expect(group.pages).toEqual(['GET /foo']);
    });
  });
});
