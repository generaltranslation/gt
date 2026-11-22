/**
 * experimentalSplitTranslations: a production build writes the translations
 * of each chunk into a file per locale, which call sites read through
 * `gt-react/chunk-translations`. How those files load in a browser is checked
 * by tests/apps/vite-chunk-translations.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import MagicString from 'magic-string';
import type { UnpluginContextMeta, UnpluginOptions } from 'unplugin';
import gtUnplugin from '../index';
import type { GTUnpluginOptions, SplitTranslationsHost } from '../index';
import { locate, trace } from './sourcePositions';
import {
  assignTranslationsByChunk,
  findChunkHashes,
  findImportedChunks,
  findUncoveredChunkMessages,
  findUngatedImports,
  MIN_SHARED_CHUNK_MESSAGES,
  passPreloads,
  readImportedFiles,
  renderImportedFiles,
  replaceImportedChunks,
  type AssignedChunk,
  type TranslationAssignment,
} from '../transform/chunk-translations/assignTranslations';
import {
  describeChunks,
  getChunkImportMapOptions,
  readChunkImportMap,
} from '../transform/chunk-translations/chunkImportMap';
import {
  generateReplacementsMap,
  moveMappings,
  trackReplacements,
} from '../transform/chunk-translations/chunkSourceMap';
import { wrapDynamicImports } from '../transform/chunk-translations/chunkTranslationsModule';
import {
  CHUNK_TRANSLATIONS_IMPORTS,
  chunkTranslationsNamings,
  getChunkTranslations,
  getMinifyHashes,
  getChunkTranslationsNaming,
  getChunkTranslationsSplit,
  getEntryExport,
  getRegionSplit,
  IMPORTED_CHUNKS_PLACEHOLDER,
  type ChunkTranslationsImport,
  resolveChunkTranslations,
  UNSPLIT_LOADER_PLACEHOLDER,
} from '../transform/chunk-translations/resolveChunkTranslations';
import {
  renderRegionTranslations,
  writeRegionTranslations,
  type RegionTranslationsManifest,
} from '../transform/chunk-translations/writeRegionTranslations';
import {
  createIdPlaceholder,
  findChunkIds,
  getListName,
  getMessageShape,
  minifyChunk,
  minifyHashes,
  pickMinifiedTranslations,
  readMinifiedIds,
  type MinifiedIds,
  type MinifiedTranslations,
} from '../transform/chunk-translations/hashMinification';
import {
  getPageBase,
  renderStartupScript,
} from '../transform/chunk-translations/startupScript';
import {
  createUnsplitTranslationsMessage,
  getUnsplitTranslations,
  replaceUnsplitLoader,
} from '../transform/chunk-translations/unsplitTranslations';
import {
  getAssignmentHash,
  getUnsplitHashes,
  renderChunkTranslations,
} from '../transform/chunk-translations/writeChunkTranslations';

const GT_FILES = { gt: { output: 'translations/[locale].json' } };
const GT_CONFIG = {
  defaultLocale: 'en',
  locales: ['fr', 'de'],
  files: GT_FILES,
};

const SAVE = '002c822e1ceb12f7';
const HELLO = 'b785eb9d5af50191';

type RawPlugin = UnpluginOptions & {
  vite?: Record<string, unknown>;
  rollup?: Record<string, unknown>;
};

/** The plugins the unplugin creates, from a directory that holds `files`. */
function createPlugins(
  options: GTUnpluginOptions,
  framework = 'vite',
  files: Record<string, string> = {}
): { plugins: RawPlugin[]; cwd: string } {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-chunk-translations-'));
  onTestFinished(() => fs.rmSync(cwd, { force: true, recursive: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), content);
  }
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  return {
    plugins: [
      gtUnplugin.raw(options, { framework } as UnpluginContextMeta),
    ].flat() as RawPlugin[],
    cwd,
  };
}

const ON: GTUnpluginOptions = {
  gtConfig: GT_CONFIG,
  experimentalSplitTranslations: {},
  // The files compiled here resolve no GT runtime, which a build would say
  precomputeMessages: false,
};

async function transform(
  code: string,
  options: GTUnpluginOptions = ON,
  { plugins, cwd } = createPlugins(options)
): Promise<string | null> {
  const hook = plugins[0].transform as (
    this: unknown,
    code: string,
    id: string
  ) => Promise<{ code: string } | string | null>;
  const result = await hook.call(
    { addWatchFile() {} },
    code,
    path.join(cwd, 'App.jsx')
  );
  return result && typeof result === 'object' ? result.code : result;
}

/**
 * A file of a build with hash minification as a page reads it: an entry
 * for each id, as gt-react's `register()` makes them.
 */
function unpack([held, lists]: MinifiedTranslations): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  for (const [name, runs] of Object.entries(lists)) {
    for (let run = 0; run < runs.length; run += 3) {
      for (let next = 0; next < runs[run + 2]; next++) {
        entries[`${name}.${runs[run] + next}`] = held[runs[run + 1] + next];
      }
    }
  }
  return entries;
}

/**
 * What the translation files a build emitted for `fr` hold, each by what a
 * call site passes: the files of chunks and of entries, and the unsplit file.
 */
function readTranslationFiles(
  emitted: Record<string, string>
): Record<string, unknown>[] {
  return Object.entries(emitted)
    .filter(
      ([file]) =>
        /\.fr(\.|$)/.test(file) && !path.basename(file).startsWith('gt-map.')
    )
    .map(([, source]) => {
      const content = JSON.parse(source);
      const held = content.t ?? content;
      return Array.isArray(held) ? unpack(held as MinifiedTranslations) : held;
    });
}

/**
 * What a page reads for each id its call sites pass, from files it holds
 * together in one cache, as gt-react holds them: undefined where no file
 * has the id, which renders the source.
 */
function readAsPage(
  ids: ReadonlyMap<string, string>,
  files: Record<string, unknown>[]
): Map<string, unknown> {
  const cache: Record<string, unknown> = Object.assign({}, ...files);
  return new Map([...ids.keys()].map((id) => [id, cache[id]]));
}

const MODULE = `import { jsx } from 'react/jsx-runtime';
import { initializeGTSPA, T, t } from 'gt-react';
export const ready = initializeGTSPA({ defaultLocale: 'en', locales: ['fr'] });
export const save = () => t\`Save\`;
export const hello = (name) => t\`Hello, \${{ name }}!\`;
export const short = () => t({ maxChars: 4 })\`Save\`;
export const Shared = () => jsx(T, { children: 'Shared by every route' });`;

describe('experimentalSplitTranslations', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GT_SPLIT_TRANSLATIONS', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('the option', () => {
    it.each([
      // Without the option, the variable decides, and off is the default
      [undefined, 'true', true],
      [undefined, '1', true],
      [undefined, 'false', false],
      [undefined, undefined, false],
      [undefined, '', false],
      // With the option and no enabled, the variable decides, and on is the default
      [{}, 'true', true],
      [{}, 'false', false],
      [{}, '0', false],
      [{}, undefined, true],
      [{}, '', true],
      [{ naming: 'map' }, 'false', false],
      [{ naming: 'map' }, undefined, true],
      [{ enabled: undefined, by: 'module' }, 'false', false],
      [{ enabled: undefined, by: 'module' }, '', true],
      // enabled overrides the variable
      [{ enabled: true }, 'true', true],
      [{ enabled: true }, 'false', true],
      [{ enabled: true }, undefined, true],
      [{ enabled: true }, '', true],
      [{ enabled: false }, 'true', false],
      [{ enabled: false }, 'false', false],
      [{ enabled: false }, undefined, false],
      [{ enabled: false }, '', false],
      // Not an object, as an untyped config can write: the option left out
      [false as never, undefined, false],
      [null as never, undefined, false],
      [false as never, 'true', true],
    ] as const)(
      'is %j with GT_SPLIT_TRANSLATIONS=%j: %s',
      (option, env, expected) => {
        vi.stubEnv('GT_SPLIT_TRANSLATIONS', env as never);
        expect(getChunkTranslations(option)).toBe(expected);
      }
    );

    it('rejects an environment value that is not a boolean, which it reads only when enabled is left out', () => {
      vi.stubEnv('GT_SPLIT_TRANSLATIONS', 'yes');
      const error =
        'GT_SPLIT_TRANSLATIONS is set to "yes", which is not a boolean. Set GT_SPLIT_TRANSLATIONS to true or false.';
      expect(() => getChunkTranslations(undefined)).toThrow(error);
      expect(() => getChunkTranslations({ naming: 'map' })).toThrow(error);
      expect(getChunkTranslations({ enabled: true })).toBe(true);
      expect(getChunkTranslations({ enabled: false })).toBe(false);
    });

    const BUILD = {
      framework: 'vite',
      compileTimeHash: true,
    };

    it('writes files for every configured locale but the default one', () => {
      expect(
        resolveChunkTranslations(
          { ...GT_CONFIG, locales: ['en', 'fr', 'de', 'fr'] },
          BUILD
        )
      ).toEqual({
        source: 'gt-react/chunk-translations',
        defaultLocale: 'en',
        locales: ['fr', 'de'],
        hashes: new Set(),
        starts: 0,
        unsplit: new Set(),
        naming: 'token',
      });
    });

    it.each([
      ['webpack', GT_CONFIG, { ...BUILD, framework: 'webpack' }, 'webpack'],
      [
        'Rollup without Vite',
        GT_CONFIG,
        { ...BUILD, framework: 'rollup' },
        'which it does not do with rollup',
      ],
      [
        'Rolldown without Vite',
        GT_CONFIG,
        { ...BUILD, framework: 'rolldown' },
        'which it does not do with rolldown',
      ],
      [
        'compileTimeHash: false',
        GT_CONFIG,
        { ...BUILD, compileTimeHash: false },
        'compileTimeHash is false',
      ],
      [
        'no translation files',
        { ...GT_CONFIG, files: undefined },
        BUILD,
        'files.gt.output does not say',
      ],
      [
        'no locale to translate into',
        { ...GT_CONFIG, locales: ['en'] },
        BUILD,
        'lists no locale other than the default',
      ],
      [
        'a locale that is no file name',
        { ...GT_CONFIG, locales: ['fr/CA'] },
        BUILD,
        '"fr/CA" cannot be part of a file name',
      ],
    ])('cannot be used with %s', (_name, gtConfig, build, reason) => {
      const resolved = resolveChunkTranslations(gtConfig, build);
      expect('error' in resolved && resolved.error).toContain(reason);
    });

    it('fails a production build it cannot be used in, and leaves a dev build alone', () => {
      const { plugins } = createPlugins({
        gtConfig: { ...GT_CONFIG, locales: [] },
        experimentalSplitTranslations: {},
      });
      const buildStart = plugins[0].buildStart as () => void;
      expect(buildStart).toThrow('lists no locale other than the default');
      vi.stubEnv('NODE_ENV', 'development');
      expect(buildStart).not.toThrow();
    });

    it('adds its hooks and its second plugin only when it is on', () => {
      const off = createPlugins({ gtConfig: GT_CONFIG }).plugins;
      expect(off).toHaveLength(1);
      // Off, it only reads whether Vite writes source maps
      expect(Object.keys(off[0].vite ?? {})).toEqual(['configResolved']);
      expect(off[0].rollup).toBeUndefined();

      const on = createPlugins({
        gtConfig: GT_CONFIG,
        experimentalSplitTranslations: {},
      }).plugins;
      expect(on.map(({ name, enforce }) => [name, enforce])).toEqual([
        ['@generaltranslation/GT_PLUGIN', undefined],
        ['@generaltranslation/GT_PLUGIN:chunk-translations', 'post'],
      ]);
      expect(Object.keys(on[0].vite ?? {})).toEqual([
        'configResolved',
        'renderChunk',
        'generateBundle',
        'transformIndexHtml',
      ]);

      vi.stubEnv('GT_SPLIT_TRANSLATIONS', 'true');
      expect(createPlugins({ gtConfig: GT_CONFIG }).plugins).toHaveLength(2);
      expect(
        createPlugins({
          gtConfig: GT_CONFIG,
          experimentalSplitTranslations: { enabled: false },
        }).plugins
      ).toHaveLength(1);

      vi.stubEnv('GT_SPLIT_TRANSLATIONS', 'false');
      expect(
        createPlugins({
          gtConfig: GT_CONFIG,
          experimentalSplitTranslations: { naming: 'map' },
        }).plugins
      ).toHaveLength(1);
      expect(
        createPlugins({
          gtConfig: GT_CONFIG,
          experimentalSplitTranslations: { enabled: true },
        }).plugins
      ).toHaveLength(2);
    });
  });

  describe('a module', () => {
    it('reads each message from its chunk and starts with the entry file', async () => {
      expect(await transform(MODULE, { ...ON, precomputeMessages: true }))
        .toMatchInlineSnapshot(`
        "import { initializeChunkTranslations as __gt_chunk_initialize } from "gt-react/chunk-translations";import { jsx } from 'react/jsx-runtime';
        import { initializeGTSPA as __gt_chunk_initialize_spa, T, t } from 'gt-react';
        export const ready = initializeGTSPA({ defaultLocale: 'en', locales: ['fr'] });
        export const save = () => t({ $_hash: "ab72d114d0d156a9", $_tree: "Save" });
        export const hello = (name) => t({ $_hash: "b785eb9d5af50191", $_tree: ["Hello, ", ["name"], "!"] }, { name });
        export const short = () => t({ $_hash: "957bff241ed9ed44", $_tree: "Save", maxChars: 4 });
        export const Shared = () => jsx(T, { children: 'Shared by every route', _hash: "0a9725453707110e" });function initializeGTSPA(config) {return __gt_chunk_initialize(__gt_chunk_initialize_spa, config, "__GT_CHUNK_TRANSLATIONS_UNSPLIT__");}"
      `);
    });

    it('keeps the tagged templates of a build that does not precompute messages', async () => {
      expect(await transform(MODULE, { ...ON, precomputeMessages: false }))
        .toMatchInlineSnapshot(`
        "import { initializeChunkTranslations as __gt_chunk_initialize } from "gt-react/chunk-translations";import { jsx } from 'react/jsx-runtime';
        import { initializeGTSPA as __gt_chunk_initialize_spa, T, t } from 'gt-react';
        export const ready = initializeGTSPA({ defaultLocale: 'en', locales: ['fr'] });
        export const save = () => t({ $_hash: "ab72d114d0d156a9" })\`Save\`;
        export const hello = (name) => t({ $_hash: "b785eb9d5af50191" })\`Hello, \${{ name }}!\`;
        export const short = () => t({ maxChars: 4, $_hash: "957bff241ed9ed44" })\`Save\`;
        export const Shared = () => jsx(T, { children: 'Shared by every route', _hash: "0a9725453707110e" });function initializeGTSPA(config) {return __gt_chunk_initialize(__gt_chunk_initialize_spa, config, "__GT_CHUNK_TRANSLATIONS_UNSPLIT__");}"
      `);
    });

    it.each([
      ['the name of a function', `{ ...config, loadTranslations }`],
      [
        'a function',
        `{ loadTranslations: (locale) => import(\`./\${locale}.json\`), ...config }`,
      ],
      ['a method', `{ ...config, async 'loadTranslations'(locale) {} }`],
    ])(
      "takes the app's loadTranslations out when it is %s, so the bundler drops the catalogs it imports",
      async (_name, options) => {
        const output = await transform(
          `import { initializeGTSPA } from 'gt-react';
const loadTranslations = (locale) => import(\`./_gt/\${locale}.json\`);
export const start = (config) => initializeGTSPA(${options});`
        );
        expect(output).toContain('initializeGTSPA({ ...config })');
      }
    );

    it.each([
      ['a call, which may do more', `{ loadTranslations: createLoader() }`],
      ['inside another object', `config`],
    ])(
      "leaves the app's loadTranslations where it is %s",
      async (_name, options) => {
        const output = await transform(
          `import { initializeGTSPA } from 'gt-react';
const config = { loadTranslations: () => ({}) };
export const start = (createLoader) => initializeGTSPA(${options});`
        );
        expect(output).toContain(`initializeGTSPA(${options})`);
      }
    );

    it('leaves the options of another function of the same name', async () => {
      const output = await transform(
        `import { initializeGTSPA } from 'gt-react';
export const ready = initializeGTSPA({});
export const other = (initializeGTSPA, loadTranslations) => initializeGTSPA({ loadTranslations });`
      );
      expect(output).toContain('initializeGTSPA({ loadTranslations })');
    });

    it.each([
      ['a development build', () => vi.stubEnv('NODE_ENV', 'development')],
      ['a module that declares one of its names', () => {}],
    ])('is compiled as without the option in %s', async (name, prepare) => {
      prepare();
      const code = name.startsWith('a module')
        ? `${MODULE}\nexport const __gt_chunk_translation = 1;`
        : MODULE;
      expect(await transform(code)).toBe(
        await transform(code, { gtConfig: GT_CONFIG })
      );
    });

    it('wraps dynamic imports of a literal path, after other plugins have written theirs', () => {
      const wrapped = wrapDynamicImports(
        `import { lazy } from 'react';
export const Home = lazy(() => import('./Home'));
export const load = (name) => import(name);
export const { a } = await import(\`./a.js\`);`,
        '/app/routes.js'
      );
      expect(wrapped?.code).toMatchInlineSnapshot(`
        "import { loadChunk as __gt_chunk_load } from "gt-react/chunk-translations";import { lazy } from 'react';
        export const Home = lazy(() => __gt_chunk_load(() => import('./Home'), "__GT_CHUNK_TRANSLATIONS_IMPORT__"));
        export const load = (name) => import(name);
        export const { a } = await __gt_chunk_load(() => import(\`./a.js\`), "__GT_CHUNK_TRANSLATIONS_IMPORT__");"
      `);
      expect(wrapped?.map).toMatchObject({ sources: ['/app/routes.js'] });
    });

    it.each([
      ['no dynamic import', `export const a = 1;`],
      [
        'only imports of computed paths',
        `export const load = (name) => import(name);`,
      ],
      ['a CommonJS module', `module.exports = () => import('./a.js');`],
      [
        'a module wrapped already',
        `__gt_chunk_load(() => import('./a.js'), '');`,
      ],
      ['code that does not parse', `import('./a.js'`],
    ])('leaves %s as it is', (_name, code) => {
      expect(wrapDynamicImports(code, '/app/a.js')).toBeUndefined();
    });

    it('wraps the dynamic imports of a production build in its second plugin', async () => {
      const { plugins, cwd } = createPlugins({
        gtConfig: GT_CONFIG,
        experimentalSplitTranslations: {},
      });
      const [, { transform: hook, transformInclude }] = plugins as [
        RawPlugin,
        {
          transform: (
            this: unknown,
            code: string,
            id: string
          ) => Promise<{ code: string } | null>;
          transformInclude: (id: string) => boolean;
        },
      ];
      const code = `export const load = () => import('./a.js');`;
      const id = path.join(cwd, 'a.js');
      expect(transformInclude(id)).toBe(true);
      expect(transformInclude('/app/node_modules/lib/index.js')).toBe(false);
      expect((await hook.call({}, code, id))?.code).toContain(
        '__gt_chunk_load('
      );
      // A module the entry cannot be imported from keeps its imports
      expect(
        await hook.call({ resolve: async () => null }, code, id)
      ).toBeNull();
      vi.stubEnv('NODE_ENV', 'development');
      expect(await hook.call({}, code, id)).toBeNull();
    });
  });

  describe('the files', () => {
    const HASHES = new Set([SAVE, HELLO]);

    it('finds the hashes call sites pass, in the quotes of any minifier', () => {
      expect(
        findChunkHashes(
          `t({$_hash:\`${HELLO}\`})\`Hello, \${{name:n}}!\`;e(T,{children:"Save",_hash:'${SAVE}'})`,
          HASHES
        )
      ).toEqual([SAVE, HELLO]);
    });

    it.each([
      [
        'minified',
        `t({$_hash:\`${SAVE}\`,$_tree:\`Save\`,context:\`button\`});t({$_hash:\`${HELLO}\`,$_tree:[\`Hello, \`,[\`name\`],\`!\`]},{name:e})`,
      ],
      [
        'as the compiler writes them',
        `t({ $_hash: "${SAVE}", $_tree: "Save" });\nt({\n\t$_hash: "${HELLO}",\n\t$_tree: ["Hello, ", ["name"], "!"]\n}, { name });`,
      ],
    ])(
      'finds the hashes of precomputed messages, with and without values, %s',
      (_name, code) => {
        expect(findChunkHashes(code, HASHES)).toEqual([SAVE, HELLO]);
      }
    );

    it.each([
      [
        'a translations file bundled as a module',
        `var fr={"${SAVE}":"Enregistrer"};`,
      ],
      ['a hash that is not a call site option', `var ids={save:"${SAVE}"};`],
      ['a string no call site passed', `r("0123456789abcdef")`],
    ])('finds none in %s', (_name, code) => {
      expect(findChunkHashes(code, HASHES)).toEqual([]);
    });

    const chunk = (
      fileName: string,
      hashes: string[],
      rest: Partial<AssignedChunk> = {}
    ): AssignedChunk => ({
      fileName,
      hashes,
      imports: [],
      dynamicImports: [],
      isEntry: false,
      ...rest,
    });
    const many = (prefix: string, length = MIN_SHARED_CHUNK_MESSAGES) =>
      Array.from({ length }, (_, index) => `${prefix}${index}`);

    // An entry with its vendor chunk, two routes that share a small and a
    // large chunk, and a dialog one of the routes opens.
    const BUNDLE = [
      chunk('assets/index.js', ['title', 'nav'], {
        isEntry: true,
        imports: ['assets/vendor.js'],
        dynamicImports: ['assets/Home.js', 'assets/Orders.js'],
      }),
      chunk('assets/vendor.js', ['vendor']),
      chunk('assets/Home.js', ['home', 'title'], {
        imports: ['assets/vendor.js', 'assets/Badge.js'],
      }),
      chunk('assets/Orders.js', ['orders'], {
        imports: ['assets/Badge.js', 'assets/Glossary.js'],
        dynamicImports: ['assets/Dialog.js'],
      }),
      chunk('assets/Badge.js', ['badge']),
      chunk('assets/Glossary.js', many('term')),
      chunk('assets/Dialog.js', ['dialog', 'nav'], {
        imports: ['assets/Glossary.js', 'assets/Badge.js', 'assets/Empty.js'],
      }),
      chunk('assets/Empty.js', []),
    ];

    it('assigns the messages of each chunk to the file of what loads it', () => {
      const assignment = assignTranslationsByChunk(BUNDLE);
      expect(Object.fromEntries(assignment.entries)).toEqual({
        'assets/index.js': ['nav', 'title', 'vendor'],
      });
      expect(Object.fromEntries(assignment.files)).toEqual({
        // Without the message the entry's file holds, with the small chunk's
        'assets/Home': ['badge', 'home'],
        'assets/Orders': ['badge', 'orders'],
        'assets/Glossary': many('term').sort(),
        'assets/Dialog': ['badge', 'dialog'],
      });
      expect(Object.fromEntries(assignment.imports)).toEqual({
        'assets/Home.js': ['assets/Home'],
        'assets/Orders.js': ['assets/Glossary', 'assets/Orders'],
        'assets/Dialog.js': ['assets/Dialog', 'assets/Glossary'],
      });
    });

    it('lists nothing for a chunk that is loaded already or has no messages', () => {
      const assignment = assignTranslationsByChunk([
        chunk('index.js', ['title'], {
          isEntry: true,
          imports: ['shared.js'],
          dynamicImports: ['shared.js', 'empty.js'],
        }),
        chunk('shared.js', many('shared')),
        chunk('empty.js', []),
      ]);
      expect(Object.fromEntries(assignment.files)).toEqual({});
      expect(Object.fromEntries(assignment.imports)).toEqual({
        'shared.js': [],
        'empty.js': [],
      });
    });

    it.each([10, 40])(
      'goes through the messages of a shared chunk and of the entry a set number of times, also with %i imports that load them',
      (routes) => {
        const reads = { entry: 0, shared: 0 };
        const counted = (hashes: string[], of: keyof typeof reads) =>
          Object.assign([...hashes], {
            [Symbol.iterator]() {
              reads[of]++;
              return hashes[Symbol.iterator]();
            },
          });
        const names = Array.from({ length: routes }, (_, i) => `r${i}.js`);
        const assignment = assignTranslationsByChunk([
          chunk('index.js', counted(['title'], 'entry'), {
            isEntry: true,
            dynamicImports: names,
          }),
          chunk('shared.js', counted(many('shared'), 'shared')),
          ...names.map((name) =>
            chunk(name, [name], { imports: ['shared.js'] })
          ),
        ]);
        expect(assignment.imports.get('r0.js')).toEqual(['r0', 'shared']);
        expect(reads).toEqual({ entry: 2, shared: 1 });
      }
    );

    it('keeps what only some pages have loaded when a build has several entries', () => {
      const assignment = assignTranslationsByChunk([
        chunk('a.js', ['a'], {
          isEntry: true,
          imports: ['shared.js'],
          dynamicImports: ['route.js'],
        }),
        chunk('b.js', ['b'], { isEntry: true, dynamicImports: ['route.js'] }),
        chunk('shared.js', many('shared')),
        chunk('route.js', ['route'], { imports: ['shared.js'] }),
      ]);
      expect(assignment.imports.get('route.js')).toEqual(['route', 'shared']);
      expect(assignment.files.get('shared')).toEqual(many('shared').sort());
    });

    const needsFiles = (target: string) => target !== 'assets/Help.js';
    const replace = (code: string, fileName = 'assets/index.js') =>
      replaceImportedChunks({ fileName, code }, needsFiles).code;
    const P = IMPORTED_CHUNKS_PLACEHOLDER;
    // The chunks Vite's lists name by their place, as it writes them
    const DEPS = `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/Home.js","assets/Help.js","assets/shared.js"])))=>i.map(i=>d[i]);\n`;

    it.each([
      [
        'an import Vite lists the chunk of first',
        `${DEPS}e(()=>import(\`./Home.js\`),\`${P}\`,a,__vite__mapDeps([0,2]))`,
        `${DEPS}e(()=>import(\`./Home.js\`),0,a,__vite__mapDeps([0,2]))`,
      ],
      [
        'an import that needs no file',
        `e(()=>import("./Help.js"),"${P}",a,[])`,
        `e(()=>import("./Help.js"),0,a,[])`,
      ],
      [
        'what is not an import of a chunk',
        `x(import("./Other.js"));e(()=>Promise.resolve().then(()=>ns),"${P}")`,
        `x(import("./Other.js"));e(()=>Promise.resolve().then(()=>ns),0)`,
      ],
    ])('names no chunk for %s', (_name, code, expected) => {
      expect(replace(code)).toBe(expected);
    });

    it.each([
      [
        'an import Vite lists nothing for',
        `e(()=>import('./Home.js'),'${P}',a,[],import.meta.url)`,
        `e(()=>import('./Home.js'),"assets/Home.js",a,[],import.meta.url)`,
      ],
      [
        'an import Vite lists another chunk for first',
        `${DEPS}e(()=>import("./Home.js"),"${P}",a,__vite__mapDeps([2,0]))`,
        `${DEPS}e(()=>import("./Home.js"),"assets/Home.js",a,__vite__mapDeps([2,0]))`,
      ],
      [
        'an import whose chunks Vite names in another form',
        `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=[cdn("assets/Home.js")])))=>i.map(i=>d[i]);e(()=>import("./Home.js"),"${P}",a,__vite__mapDeps([0]))`,
        `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=[cdn("assets/Home.js")])))=>i.map(i=>d[i]);e(()=>import("./Home.js"),"assets/Home.js",a,__vite__mapDeps([0]))`,
      ],
      [
        'an import no bundler preloads',
        `e(()=>import("./Home.js"),"${P}")`,
        `e(()=>import("./Home.js"),"assets/Home.js")`,
      ],
      [
        'code that is not minified',
        `load(function () {\n  return import("../assets/Home.js");\n}, "${P}")`,
        `load(function () {\n  return import("../assets/Home.js");\n}, "assets/Home.js")`,
      ],
      [
        "an import of a chunk whose exports are not the module's, which the bundler reads one of",
        `e(()=>import("./Home.js").then(n=>n.t),"${P}")`,
        `e(()=>import("./Home.js").then(n=>n.t),"assets/Home.js")`,
      ],
      [
        'the import of a chunk that other chunks import too, as Rolldown writes it where modules run in order',
        `${DEPS}n(()=>import(\`./Home.js\`).then(e=>(e.t(),e.n)),"${P}",i,__vite__mapDeps([0,2]),import.meta.url)`,
        `${DEPS}n(()=>import(\`./Home.js\`).then(e=>(e.t(),e.n)),0,i,__vite__mapDeps([0,2]),import.meta.url)`,
      ],
      [
        "such an import still inside Vite's preload call",
        `n(()=>i(()=>import(\`./Home.js\`).then(e=>(e.t(),e.n)),__vite__mapDeps([24,25]),import.meta.url),"${P}")`,
        `n(()=>i(()=>import(\`./Home.js\`).then(e=>(e.t(),e.n)),__vite__mapDeps([24,25]),import.meta.url),"assets/Home.js")`,
      ],
      [
        'such an import as a function',
        `e(()=>import("./Home.js").then(function(n){return n.Home_exports}),"${P}",a,[])`,
        `e(()=>import("./Home.js").then(function(n){return n.Home_exports}),"assets/Home.js",a,[])`,
      ],
    ])('names the chunk of %s', (_name, code, expected) => {
      expect(replace(code)).toBe(expected);
    });

    it('reads the chunks the wrapped imports of a chunk load from its code, and counts those it cannot', () => {
      const code = `${DEPS}e(()=>import("./Home.js"),"${P}",a,__vite__mapDeps([0,2]));e(()=>import("../chunks/Orders.js").then(n=>n.t),"${P}");x(import("./Other.js"));e(()=>Promise.resolve().then(()=>(init(),ns)),"${P}")`;
      const chunk = { fileName: 'assets/index.js', code };
      expect(findImportedChunks(chunk)).toEqual([
        'assets/Home.js',
        'chunks/Orders.js',
      ]);
      // The last one loads no chunk: its module is in one the page has
      expect(replaceImportedChunks(chunk, needsFiles)).toEqual({
        code: `${DEPS}e(()=>import("./Home.js"),0,a,__vite__mapDeps([0,2]));e(()=>import("../chunks/Orders.js").then(n=>n.t),"chunks/Orders.js");x(import("./Other.js"));e(()=>Promise.resolve().then(()=>(init(),ns)),0)`,
        unread: 0,
      });
      // One whose function still imports a chunk, in a form that is not read
      expect(
        replaceImportedChunks(
          {
            fileName: 'assets/index.js',
            code: `e(()=>Promise.resolve().then(()=>ns),"${P}");e(()=>import(pick("./Home.js")),"${P}")`,
          },
          needsFiles
        )
      ).toEqual({
        code: `e(()=>Promise.resolve().then(()=>ns),0);e(()=>import(pick("./Home.js")),0)`,
        unread: 1,
      });
    });

    it.each([
      ['one of its wrapped imports loads it', ['assets/Home.js'], undefined],
      ['one loads a chunk that loads it', ['assets/facade.js'], undefined],
      ['it needs no file', [], undefined],
      ['nothing asks for its files', [], ['assets/Home.js']],
      ['another chunk is asked for', ['assets/Other.js'], ['assets/Home.js']],
    ])(
      'finds no ungated import of a chunk when %s',
      (name, gates, expected) => {
        const target =
          name === 'it needs no file' ? 'assets/Help.js' : 'assets/Home.js';
        expect(
          findUngatedImports(
            { fileName: 'assets/index.js', dynamicImports: [target] },
            gates,
            needsFiles,
            (gate, other) =>
              gate === 'assets/facade.js' && other === 'assets/Home.js'
          )
        ).toEqual(expected && { chunk: 'assets/index.js', targets: expected });
      }
    );

    it('finds no ungated import where a chunk imports one of its own modules, which a bundler reports as an import of the chunk itself', () => {
      expect(
        findUngatedImports(
          { fileName: 'assets/Home.js', dynamicImports: ['assets/Home.js'] },
          [],
          needsFiles,
          () => false
        )
      ).toBeUndefined();
    });

    describe('with a chunk import map', () => {
      // As Rolldown writes it for Vite's `build.chunkImportMap`: chunks
      // import each other, and Vite's lists name them, by a name whose hash
      // stays when a chunk's content changes
      const IMPORTS = {
        'assets/Home-name.js': 'assets/Home-file.js',
        'assets/Help-name.js': 'assets/Help-file.js',
        'chunks/Orders-name.js': 'chunks/Orders-file.js',
      };
      const asset = (imports: object, baseUrl = '/') => ({
        type: 'asset',
        source: JSON.stringify({
          imports: Object.fromEntries(
            Object.entries(imports).map(([name, file]) => [
              `${baseUrl}${name}`,
              `${baseUrl}${file}`,
            ])
          ),
        }),
      });
      const WRITTEN = { fileName: 'importmap.json', baseUrl: '/' };
      const importMap = new Map(Object.entries(IMPORTS));
      const NAMED = `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/Home-name.js","assets/shared.js"])))=>i.map(i=>d[i]);\n`;
      const needsNamedFiles = (target: string) =>
        target !== 'assets/Help-file.js';

      it.each([
        ['no options', undefined, undefined],
        ['options without it', { experimental: {} }, undefined],
        ['it off', { experimental: { chunkImportMap: false } }, undefined],
        ['it on', { experimental: { chunkImportMap: true } }, WRITTEN],
        [
          "a file and Vite's base",
          {
            experimental: {
              chunkImportMap: {
                fileName: 'maps/chunks.json',
                baseUrl: '/app/',
              },
            },
          },
          { fileName: 'maps/chunks.json', baseUrl: '/app/' },
        ],
        [
          'values that are not strings',
          { experimental: { chunkImportMap: { fileName: '', baseUrl: 1 } } },
          WRITTEN,
        ],
        ['options that are no object', 'experimental', undefined],
      ])(
        'reads where the bundler writes it from %s',
        (_name, options, expected) => {
          expect(getChunkImportMapOptions(options)).toEqual(expected);
        }
      );

      it.each([
        ['the root', '/', 'importmap.json', (source: string) => source],
        ['a base', '/app/', 'importmap.json', (source: string) => source],
        [
          'a CDN',
          'https://cdn.example/app/',
          'importmap.json',
          (source: string) => source,
        ],
        ['a relative base', './', 'importmap.json', (source: string) => source],
        [
          'a file the build names',
          '/',
          'maps/chunks.json',
          (source: string) => source,
        ],
        [
          'bytes',
          '/',
          'importmap.json',
          (source: string) => new TextEncoder().encode(source),
        ],
      ])(
        'reads it from the bundle, written for %s',
        (_name, baseUrl, fileName, encode) => {
          const { type, source } = asset(IMPORTS, baseUrl);
          expect(
            readChunkImportMap(
              { [fileName]: { type, source: encode(source) } },
              { fileName, baseUrl }
            )
          ).toEqual(importMap);
        }
      );

      it('reads none from a build that writes none, or from a bundle without one, as of a build no chunk of which has a hash in its name', () => {
        expect(
          readChunkImportMap({ 'importmap.json': asset(IMPORTS) }, undefined)
        ).toBeUndefined();
        expect(readChunkImportMap({}, WRITTEN)).toBeUndefined();
        expect(
          readChunkImportMap({ 'importmap.json': { type: 'chunk' } }, WRITTEN)
        ).toBeUndefined();
      });

      it.each([
        ['is not JSON', '{'],
        ['has no imports', '{}'],
        ['lists its imports', '{"imports":["/assets/Home-file.js"]}'],
        ['names what is not a file', '{"imports":{"/assets/Home-name.js":1}}'],
      ])('fails the build when the file %s', (_name, source) => {
        expect(() =>
          readChunkImportMap(
            { 'importmap.json': { type: 'asset', source } },
            WRITTEN
          )
        ).toThrow(
          /could not read the chunk import map importmap\.json because it is not an import map as the bundler writes one/
        );
      });

      it('reads the file of the chunk an import names, and leaves the name in the code', () => {
        const chunk = {
          fileName: 'assets/index-file.js',
          code: `${NAMED}e(()=>import(\`./Home-name.js\`),\`${P}\`,a,__vite__mapDeps([0,1]));e(()=>import("../chunks/Orders-name.js"),"${P}",a,[]);e(()=>import("./Help-name.js"),"${P}",a,[]);e(()=>import("./plain.js"),"${P}")`,
        };
        expect(findImportedChunks(chunk, importMap)).toEqual([
          'assets/Home-file.js',
          'chunks/Orders-file.js',
          'assets/Help-file.js',
          // In no import map: a chunk without a hash in its name
          'assets/plain.js',
        ]);
        // The file of another chunk in a chunk's code would change with that
        // chunk's content, while the name of its own file stays
        expect(
          replaceImportedChunks(chunk, needsNamedFiles, importMap)
        ).toEqual({
          code: `${NAMED}e(()=>import(\`./Home-name.js\`),0,a,__vite__mapDeps([0,1]));e(()=>import("../chunks/Orders-name.js"),"chunks/Orders-name.js",a,[]);e(()=>import("./Help-name.js"),0,a,[]);e(()=>import("./plain.js"),"assets/plain.js")`,
          unread: 0,
        });
        // Without the import map no chunk is found for a name
        expect(findImportedChunks(chunk)).toEqual([
          'assets/Home-name.js',
          'chunks/Orders-name.js',
          'assets/Help-name.js',
          'assets/plain.js',
        ]);
      });

      it('reads an import by a name that is not a path', () => {
        const names = new Map([['route:Home', 'assets/Home-file.js']]);
        const chunk = {
          fileName: 'assets/index-file.js',
          code: `e(()=>import("route:Home"),"${P}",a,[])`,
        };
        expect(findImportedChunks(chunk, names)).toEqual([
          'assets/Home-file.js',
        ]);
        expect(replaceImportedChunks(chunk, needsNamedFiles, names).code).toBe(
          `e(()=>import("route:Home"),"route:Home",a,[])`
        );
      });

      it('lists what an import needs under the file of its chunk and under its names', () => {
        const lists = renderImportedFiles(
          new Map([
            ['assets/Home-file.js', ['assets/Home-file', 'assets/a']],
            ['assets/Help-file.js', []],
            ['assets/plain.js', ['assets/plain']],
          ]),
          importMap
        );
        expect(lists).toEqual({
          k: [
            'assets/a',
            'assets/Home-file',
            'assets/Home-name',
            'assets/plain',
          ],
          c: [0, [1, 0, 1], [0, 0, 2], [1]],
        });
        // A page preloads a chunk by its file and imports it by its name
        for (const chunk of ['assets/Home-file.js', 'assets/Home-name.js']) {
          expect(readImportedFiles(lists, chunk)?.sort()).toEqual([
            'assets/Home-file',
            'assets/a',
          ]);
        }
        expect(readImportedFiles(lists, 'assets/Help-name.js')).toBeUndefined();
      });

      it('names a chunk in a diagnostic by its file and by what the code imports it by', () => {
        const describeChunk = describeChunks(importMap);
        expect(describeChunk('assets/Home-file.js')).toBe(
          'assets/Home-file.js (imported as assets/Home-name.js)'
        );
        expect(describeChunk('assets/plain.js')).toBe('assets/plain.js');
        expect(describeChunks(undefined)('assets/Home.js')).toBe(
          'assets/Home.js'
        );
      });
    });

    it.each([
      [
        'as Rolldown prints it',
        `lazy(() => loadChunk(() => __vitePreload(() => import("./Home-!~{001}~.js"), __VITE_PRELOAD__), "${P}"))`,
        `lazy(() => loadChunk(() => import("./Home-!~{001}~.js"), "${P}", __vitePreload, __VITE_PRELOAD__))`,
      ],
      [
        "as Vite's own transform writes it, with the importer's URL",
        `__gt_chunk_load(() => __vitePreload$1(() => import('./Home.js'),__VITE_PRELOAD__,import.meta.url), "${P}")`,
        `__gt_chunk_load(() => import('./Home.js'), "${P}", __vitePreload$1, __VITE_PRELOAD__,import.meta.url)`,
      ],
      [
        'of a chunk that other chunks import too, where modules run in order: the module is started after the import',
        `loadChunk(() => __vitePreload(() => import("./Home.js").then((n) => (n.init_Home(), n.Home_exports)), __VITE_PRELOAD__, import.meta.url), "${P}")`,
        `loadChunk(() => import("./Home.js").then((n) => (n.init_Home(), n.Home_exports)), "${P}", __vitePreload, __VITE_PRELOAD__, import.meta.url)`,
      ],
      [
        "of a chunk whose exports are not the module's",
        `loadChunk(() => __vitePreload(() => import("./Home.js").then((n) => n.Home_exports), __VITE_PRELOAD__), "${P}")`,
        `loadChunk(() => import("./Home.js").then((n) => n.Home_exports), "${P}", __vitePreload, __VITE_PRELOAD__)`,
      ],
    ])(
      "hands gt-react Vite's preload call of an import, %s",
      (_name, code, expected) => {
        expect(passPreloads(code)).toBe(expected);
      }
    );

    it.each([
      [
        'an import the bundler does not preload',
        `loadChunk(() => import("./Home.js"), "${P}")`,
      ],
      [
        'an import the compiler did not wrap',
        `__vitePreload(() => import("./Home.js"), __VITE_PRELOAD__)`,
      ],
      [
        'an import the bundler inlined',
        `loadChunk(() => __vitePreload(() => Promise.resolve().then(() => ns), __VITE_PRELOAD__), "${P}")`,
      ],
    ])('leaves %s as it is', (_name, code) => {
      expect(passPreloads(code)).toBe(code);
    });

    it('writes which files each import needs as runs of the keys most imports need', () => {
      expect(
        renderImportedFiles(
          new Map([
            ['assets/Home.js', ['assets/Home']],
            ['assets/Orders.mjs', ['assets/Orders', 'assets/a', 'assets/b']],
            // No file of its own, and not what the others need next to each other
            ['assets/Settings.js', ['assets/a', 'assets/c', 'assets/b']],
            ['assets/Help.js', []],
          ])
        )
      ).toEqual({
        k: [
          'assets/a',
          'assets/b',
          'assets/c',
          'assets/Home',
          'assets/Orders',
          'assets/Settings',
        ],
        c: [0, 0, 0, [1], [1, 0, 2], [0, 0, 3]],
      });
      expect(renderImportedFiles(new Map([['a.js', []]]))).toBeUndefined();
    });

    it('reads the lists as gt-react does, and lists no chunk whose import needs no file', () => {
      const lists = renderImportedFiles(
        new Map([
          ['assets/Home.js', ['assets/Home', 'assets/a']],
          ['assets/Help.js', []],
        ])
      );
      expect(lists).toEqual({
        k: ['assets/a', 'assets/Home'],
        c: [0, [1, 0, 1]],
      });
      expect(readImportedFiles(lists, 'assets/Home.js')).toEqual([
        'assets/Home',
        'assets/a',
      ]);
      // In no list, which is nothing to request
      expect(readImportedFiles(lists, 'assets/Help.js')).toBeUndefined();
      expect(readImportedFiles(undefined, 'assets/Home.js')).toEqual([]);
    });

    describe('the replay of every load against the lists a page is sent', () => {
      // A route that a dynamic import loads and that the chunk of a panel
      // it opens imports statically, with a shared chunk under both
      const BUNDLE = [
        chunk('index.js', ['title'], {
          isEntry: true,
          dynamicImports: ['Orders.js'],
        }),
        chunk('Orders.js', many('order'), {
          imports: ['shared.js'],
          dynamicImports: ['Details.js'],
        }),
        chunk('Details.js', ['details'], {
          imports: ['Orders.js', 'shared.js'],
        }),
        chunk('shared.js', many('shared')),
      ];
      const replay = (
        bundle: AssignedChunk[],
        lists = (assignment: TranslationAssignment) =>
          renderImportedFiles(assignment.imports)
      ) => {
        const assignment = assignTranslationsByChunk(bundle);
        return findUncoveredChunkMessages(
          bundle,
          assignment,
          lists(assignment)
        );
      };

      it('finds every message of every load in a file that load requests', () => {
        expect(replay(BUNDLE)).toEqual([]);
        const lists = renderImportedFiles(
          assignTranslationsByChunk(BUNDLE).imports
        );
        expect(readImportedFiles(lists, 'Orders.js')).toEqual([
          'Orders',
          'shared',
        ]);
        expect(readImportedFiles(lists, 'Details.js')).toEqual([
          'Details',
          'shared',
          'Orders',
        ]);
      });

      it('names the messages of a chunk whose import the lists send no file for', () => {
        // The lists as they would be if they left the route's own file out
        const uncovered = replay(BUNDLE, ({ imports }) =>
          renderImportedFiles(new Map([...imports, ['Orders.js', ['shared']]]))
        );
        expect(uncovered).toHaveLength(MIN_SHARED_CHUNK_MESSAGES);
        expect(uncovered[0]).toEqual({
          hash: 'order0',
          chunk: 'Orders.js',
          load: 'Orders.js',
        });
      });

      it('names the messages of a chunk the lists do not know', () => {
        // A chunk that passes the route's exports on is what the page imports
        const bundle = [
          ...BUNDLE,
          chunk('Orders-facade.js', [], { imports: ['Orders.js'] }),
          chunk('table.js', [], { dynamicImports: ['Orders-facade.js'] }),
        ];
        bundle[0] = {
          ...bundle[0],
          dynamicImports: ['Orders.js', 'table.js'],
        };
        expect(replay(bundle)).toEqual([]);
        // The lists as they would be without it
        expect(
          replay(bundle, ({ imports }) =>
            renderImportedFiles(
              new Map(
                [...imports].filter(([file]) => file !== 'Orders-facade.js')
              )
            )
          ).map(({ load }) => load)
        ).toContain('Orders-facade.js');
      });

      it('holds for chunks of every shape', () => {
        let state = 7;
        const pick = (below: number) => {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          return Math.floor((state / 2 ** 32) * below);
        };
        for (let build = 0; build < 300; build++) {
          const count = 4 + pick(20);
          const bundle = Array.from({ length: count }, (_, index) =>
            chunk(
              `c${index}.js`,
              // None, as a chunk that passes exports on, few or many
              [
                ...new Set(
                  Array.from(
                    { length: [0, 5, 30][pick(3)] },
                    () => `m${pick(120)}`
                  )
                ),
              ],
              { isEntry: index === 0 }
            )
          );
          bundle.forEach((from, index) => {
            for (let edge = pick(4); edge > 0; edge--) {
              // Mostly to a later chunk, and now and then around in a circle
              const to = pick(10) ? index + 1 + pick(count) : 1 + pick(count);
              if (to < count && to !== index) from.imports.push(`c${to}.js`);
            }
            for (let edge = pick(3); edge > 0; edge--) {
              const to = 1 + pick(count - 1);
              if (to !== index) from.dynamicImports.push(`c${to}.js`);
            }
          });
          // Every chunk of a bundle is one an entry leads to
          bundle.slice(1).forEach((to, index) => {
            bundle[pick(index + 1)].dynamicImports.push(to.fileName);
          });
          expect(replay(bundle), `build ${build}`).toEqual([]);
          const { imports } = assignTranslationsByChunk(bundle);
          const lists = renderImportedFiles(imports);
          for (const [target, keys] of imports) {
            expect(
              readImportedFiles(lists, target)?.sort() ?? [],
              `build ${build}`
            ).toEqual([...keys].sort());
          }
        }
      });
    });

    it('writes those lists in a size that does not grow with what the imports share', () => {
      const shared = Array.from(
        { length: 100 },
        (_, index) => `shared-${index}`
      );
      const imports = new Map(
        Array.from({ length: 500 }, (_, index) => [
          `route-${index}.js`,
          [`route-${index}`, ...shared.filter((_, at) => at !== index % 100)],
        ])
      );
      const imported = renderImportedFiles(imports)!;
      // Its own file, and all but one of the shared ones as two runs
      expect(
        imported.c
          .filter(Boolean)
          .every((needed) => (needed as number[]).length <= 5)
      ).toBe(true);
      expect(JSON.stringify(imported).length).toBeLessThan(
        JSON.stringify([...imports]).length / 30
      );
    });

    const ASSIGNMENT = {
      entries: new Map([['assets/index.js', ['nav', 'title']]]),
      files: new Map([
        ['assets/Home', ['home', 'untranslated']],
        ['assets/Orders', ['orders']],
      ]),
      imports: new Map([['assets/Home.js', ['assets/Home']]]),
    };
    const FR = {
      nav: 'Navigation',
      title: 'Titre',
      home: 'Accueil',
      other: 'Autre',
    };
    const render = (fr: Record<string, unknown> = FR) =>
      renderChunkTranslations(
        ASSIGNMENT,
        { defaultLocale: 'en', locales: ['fr', 'de', 'ja'] },
        { fr, de: { title: 'Titel', home: null, orders: 'Bestellungen' } },
        '/app/'
      );

    it("writes each file per locale, the entry's named by its own hash and the others by the locale's token, and the manifest", () => {
      const { files, manifest } = render();
      expect(
        Object.fromEntries(
          files.map(({ fileName, source }) => [fileName, JSON.parse(source)])
        )
      ).toEqual({
        'assets/Home.fr.76b1ca6e.json': { home: 'Accueil' },
        // Written for every locale, so its URL follows from the chunk's
        'assets/Orders.fr.76b1ca6e.json': {},
        // With the files each import needs
        'assets/index.fr.df5a25ac.json': {
          t: { nav: 'Navigation', title: 'Titre' },
          i: { k: ['assets/Home'], c: [[1]] },
        },
        'assets/Home.de.c85eff71.json': {},
        'assets/Orders.de.c85eff71.json': { orders: 'Bestellungen' },
        'assets/index.de.3d7a45d8.json': {
          t: { title: 'Titel' },
          i: { k: ['assets/Home'], c: [[1]] },
        },
      });
      expect(manifest).toEqual({
        defaultLocale: 'en',
        // No translations file for ja
        locales: ['fr', 'de'],
        entries: {
          'assets/index.js': {
            translations: {
              fr: 'assets/index.fr.df5a25ac.json',
              de: 'assets/index.de.3d7a45d8.json',
            },
            startupScript: expect.stringContaining(
              '{"b":"/app/","f":"assets/index","h":{"fr":"df5a25ac","de":"3d7a45d8"},"v":{"fr":"76b1ca6e","de":"c85eff71"}},["en","fr","de","ja"]'
            ),
          },
        },
        files: {
          'assets/Home': {
            fr: 'assets/Home.fr.76b1ca6e.json',
            de: 'assets/Home.de.c85eff71.json',
          },
          'assets/Orders': {
            fr: 'assets/Orders.fr.76b1ca6e.json',
            de: 'assets/Orders.de.c85eff71.json',
          },
        },
        imports: { 'assets/Home.js': ['assets/Home'] },
      });
    });

    it("gives every file of a locale but the entry's a new name when one of them changes", () => {
      const names = (fr: Record<string, unknown>) =>
        render(fr)
          .files.map(({ fileName }) => fileName)
          .sort();
      const before = names(FR);
      const changed = (after: string[]) =>
        after.filter((name) => !before.includes(name));
      // A translation of a file, of the entry, and of no file
      expect(changed(names({ ...FR, home: 'Maison' }))).toEqual([
        expect.stringMatching(/^assets\/Home\.fr\./),
        expect.stringMatching(/^assets\/Orders\.fr\./),
      ]);
      expect(changed(names({ ...FR, title: 'Nom' }))).toEqual([
        expect.stringMatching(/^assets\/index\.fr\./),
      ]);
      expect(changed(names({ ...FR, other: 'Rien' }))).toEqual([]);
    });

    it("writes each locale's token and how the build assigned its messages under a name that every build has, and gives the page both", () => {
      const CURRENT = 'assets/gt-current.json';
      const withCurrent = (
        fr: Record<string, unknown> | null = FR,
        de: Record<string, unknown> | null = { title: 'Titel' },
        assignment: TranslationAssignment = ASSIGNMENT
      ) => {
        const { files, manifest } = renderChunkTranslations(
          assignment,
          { defaultLocale: 'en', locales: ['fr', 'de'] },
          { ...(fr && { fr }), ...(de && { de }) },
          '/',
          undefined,
          undefined,
          'assets/gt-current'
        );
        const current = files.find(({ fileName }) => fileName === CURRENT);
        return {
          names: current && JSON.parse(current.source),
          manifest,
          script: manifest.entries['assets/index.js'].startupScript,
        };
      };
      const { names, manifest, script } = withCurrent();
      const tokens = Object.fromEntries(
        ['fr', 'de'].map((locale) => [
          locale,
          manifest.files['assets/Home'][locale].split('.').at(-2),
        ])
      );
      expect(names).toEqual({
        v: tokens,
        c: expect.stringMatching(/^[0-9a-f]{8}$/),
      });
      expect(manifest.current).toBe(CURRENT);
      expect(script).toContain(
        `"v":${JSON.stringify(tokens)},"n":"assets/gt-current","c":"${names.c}"}`
      );

      // A changed translation changes what it says of that locale alone
      const changed = withCurrent({ ...FR, home: 'Maison' }).names;
      expect(changed.v.de).toBe(tokens.de);
      expect(changed.v.fr).not.toBe(tokens.fr);
      expect(changed.c).toBe(names.c);

      // A message that the entry's file now holds, and not the chunk's: the
      // files have the keys they had, and the build says it assigned
      // differently
      const moved = withCurrent(FR, undefined, {
        ...ASSIGNMENT,
        entries: new Map([['assets/index.js', ['nav', 'title', 'home']]]),
        files: new Map([
          ['assets/Home', ['untranslated']],
          ['assets/Orders', ['orders']],
        ]),
      }).names;
      expect(moved.c).not.toBe(names.c);

      // A build without files has no names to give
      const none = withCurrent(null, null);
      expect(none.names).toBeUndefined();
      expect(none.manifest.current).toBeUndefined();
      expect(none.script).not.toContain('"n"');
    });
  });

  describe('the imports of a build', () => {
    const P = IMPORTED_CHUNKS_PLACEHOLDER;
    const SAVED = 'ab72d114d0d156a9';
    type Bundle = Record<
      string,
      {
        type: 'chunk';
        fileName: string;
        code: string;
        imports: string[];
        dynamicImports: string[];
        isEntry: boolean;
      }
    >;
    const file = (
      fileName: string,
      code: string,
      rest: Partial<Bundle[string]> = {}
    ): Bundle[string] => ({
      type: 'chunk',
      fileName,
      code,
      imports: [],
      dynamicImports: [],
      isEntry: false,
      ...rest,
    });

    /**
     * Builds a bundle whose entry holds `code`, and returns what the build
     * wrote and warned. With `importMap`, the bundler writes that chunk
     * import map.
     */
    async function build(
      code: string,
      dynamicImports: string[],
      importMap?: string
    ) {
      const created = createPlugins(ON, 'vite', {
        'translations/fr.json': JSON.stringify({ [SAVED]: 'Enregistrer' }),
        'translations/de.json': JSON.stringify({ [SAVED]: 'Speichern' }),
      });
      await transform(
        `import { initializeGTSPA, t } from 'gt-react';\nexport const ready = initializeGTSPA({});\nexport const save = () => t\`Save\`;`,
        ON,
        created
      );
      const [first, second] = created.plugins as unknown as {
        vite: {
          configResolved?: (config: object) => void;
          options?: (options: object) => null;
          generateBundle: unknown;
        };
      }[];
      first.vite.configResolved!({ base: '/', build: { assetsDir: 'assets' } });
      second.vite.options!({
        experimental: { chunkImportMap: importMap !== undefined },
      });
      const bundle: Bundle = {
        'assets/index.js': file('assets/index.js', code, {
          isEntry: true,
          dynamicImports,
        }),
        // Passes the route's exports on, as a bundler writes for a chunk
        // that other chunks import too
        'assets/Orders-facade.js': file(
          'assets/Orders-facade.js',
          'export{t as default}from"./Orders.js"',
          { imports: ['assets/Orders.js'] }
        ),
        'assets/Orders.js': file(
          'assets/Orders.js',
          `t({$_hash:"${SAVED}"})\`Save\``
        ),
      };
      if (importMap !== undefined) {
        (bundle as Record<string, object>)['importmap.json'] = {
          type: 'asset',
          source: importMap,
        };
      }
      const emitted: Record<string, string> = {};
      (
        first.vite.generateBundle as (
          this: object,
          options: object,
          bundle: object
        ) => void
      ).call(
        {
          emitFile: (emit: { fileName: string; source: string }) =>
            (emitted[emit.fileName.replace(/\.[0-9a-f]{8}\.json$/, '')] =
              emit.source),
        },
        {},
        bundle
      );
      const name = () =>
        (
          second.vite.generateBundle as {
            handler: (options: object, bundle: object) => void;
          }
        ).handler({}, bundle);
      return { bundle, emitted, name };
    }

    it('lists the files of the chunk an import names in the final code, also when the bundler reports another', async () => {
      const { bundle, emitted, name } = await build(
        `e(()=>import("./Orders-facade.js"),"${P}")`,
        ['assets/Orders.js']
      );
      const manifest = JSON.parse(emitted['assets/gt-chunk-translations.json']);
      expect(manifest.imports['assets/Orders-facade.js']).toEqual([
        'assets/Orders-facade',
      ]);
      expect(JSON.parse(emitted['assets/Orders-facade.fr'])).toEqual({
        [SAVED]: 'Enregistrer',
      });
      expect(JSON.parse(emitted['assets/index.fr']).i.k).toContain(
        'assets/Orders-facade'
      );
      name();
      expect(bundle['assets/index.js'].code).toBe(
        `e(()=>import("./Orders-facade.js"),"assets/Orders-facade.js")`
      );
      expect(console.warn).not.toHaveBeenCalled();
    });

    // The bundler's chunk import map: the route's chunk is imported by a
    // name that no file has
    const IMPORT_MAP = JSON.stringify({
      imports: { '/assets/Orders-name.js': '/assets/Orders.js' },
    });

    it('finds the chunk an import names through the chunk import map, and lists its files under that name too', async () => {
      const { bundle, emitted, name } = await build(
        `e(()=>import("./Orders-name.js"),"${P}")`,
        ['assets/Orders.js'],
        IMPORT_MAP
      );
      const manifest = JSON.parse(emitted['assets/gt-chunk-translations.json']);
      expect(manifest.imports['assets/Orders.js']).toEqual(['assets/Orders']);
      expect(JSON.parse(emitted['assets/index.fr']).i).toEqual({
        k: ['assets/Orders', 'assets/Orders-name'],
        c: [[1], [0, 0, 1]],
      });
      name();
      expect(bundle['assets/index.js'].code).toBe(
        `e(()=>import("./Orders-name.js"),"assets/Orders-name.js")`
      );
      expect(console.warn).not.toHaveBeenCalled();
    });

    // A plugin of the app has chunks import each other by a bare name, which
    // it gives the import map before the build writes its lists, or under
    // the assets directory first and bare only once the lists are written
    const BARE = { 'r:Orders-name.js': '/assets/Orders.js' };
    const UNDER_ASSETS = { '/assets/r:Orders-name.js': '/assets/Orders.js' };
    const VITE = { '/assets/Orders-name.js': '/assets/Orders.js' };

    it.each([
      [
        'that has the name before the lists are written',
        { ...BARE, ...VITE },
        { ...BARE, ...VITE },
      ],
      [
        'that a plugin rewrites once the lists are written',
        { ...UNDER_ASSETS, ...VITE },
        { ...BARE, ...VITE },
      ],
      [
        'that a plugin empties once the lists are written',
        { ...BARE, ...VITE },
        {},
      ],
    ])(
      'writes at an import the name the page imports the chunk by, which its lists hold, with an import map %s',
      async (_name, atLists, atNames) => {
        // The specifier, whatever the import map holds and when
        const written = 'r:Orders-name.js';
        const { bundle, emitted, name } = await build(
          `e(()=>import("r:Orders-name.js"),"${P}")`,
          ['assets/Orders.js'],
          JSON.stringify({ imports: atLists })
        );
        (bundle as Record<string, object>)['importmap.json'] = {
          type: 'asset',
          source: JSON.stringify({ imports: atNames }),
        };
        name();
        expect(bundle['assets/index.js'].code).toBe(
          'e(()=>import("r:Orders-name.js"),"r:Orders-name.js")'
        );
        // The chunk's file and what the import is written with, and not the
        // name Vite has for the chunk, which nothing looks up
        expect(JSON.parse(emitted['assets/index.fr']).i.k).toEqual([
          'assets/Orders',
          written.replace(/\.js$/, ''),
        ]);
        expect(console.warn).not.toHaveBeenCalled();
      }
    );

    it('writes a name its lists know the chunk by at an import a plugin rewrote once the lists are written, to another name the import map had', async () => {
      const { bundle, emitted, name } = await build(
        `e(()=>import("./Orders-name.js"),"${P}")`,
        ['assets/Orders.js'],
        JSON.stringify({ imports: { ...UNDER_ASSETS, ...VITE } })
      );
      bundle['assets/index.js'].code =
        `e(()=>import("r:Orders-name.js"),"${P}")`;
      name();
      expect(bundle['assets/index.js'].code).toBe(
        `e(()=>import("r:Orders-name.js"),"assets/Orders-name.js")`
      );
      expect(JSON.parse(emitted['assets/index.fr']).i.k).toEqual([
        'assets/Orders',
        'assets/Orders-name',
      ]);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('warns of an import a plugin rewrote once the lists are written, to a name the import map did not have', async () => {
      const { bundle, name } = await build(
        `e(()=>import("./Orders-name.js"),"${P}")`,
        ['assets/Orders.js'],
        IMPORT_MAP
      );
      bundle['assets/index.js'].code =
        `e(()=>import("r:Orders-name.js"),"${P}")`;
      name();
      // gt-react reads the chunk from the bundler's list, when it has one
      expect(bundle['assets/index.js'].code).toBe(
        `e(()=>import("r:Orders-name.js"),0)`
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /Nothing waits for the translations of assets\/Orders\.js/
        )
      );
    });

    it('says by which name the code imports a chunk that an import it did not wrap loads', async () => {
      const { name } = await build(
        `import("./Orders-name.js")`,
        ['assets/Orders.js'],
        IMPORT_MAP
      );
      name();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /Nothing waits for the translations of assets\/Orders\.js \(imported as assets\/Orders-name\.js\).*assets\/index\.js imports assets\/Orders\.js \(imported as assets\/Orders-name\.js\)/s
        )
      );
    });

    it('fails when the chunk import map of the build is not one', async () => {
      await expect(
        build(`e(()=>import("./Orders-name.js"),"${P}")`, [], '[]')
      ).rejects.toThrow('could not read the chunk import map importmap.json');
    });

    it('fails when it cannot read an import that loads translations', async () => {
      const { name } = await build(
        `e(()=>import(pick("./Orders.js")),"${P}")`,
        ['assets/Orders.js']
      );
      expect(name).toThrow(
        /could not tell which chunk a dynamic import loads because the bundler printed the import in a form the build does not read.*assets\/index\.js imports assets\/Orders\.js/s
      );
    });

    it('says which translations an import it did not wrap leaves nothing waiting for', async () => {
      const { bundle, name } = await build(`import("./Orders.js")`, [
        'assets/Orders.js',
      ]);
      name();
      expect(bundle['assets/index.js'].code).toBe(`import("./Orders.js")`);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Nothing waits for the translations of assets/Orders.js because a dynamic import the build does not wrap loads them'
        )
      );
    });

    it('only warns of an import it did not wrap in a chunk that also holds one the bundler put into a chunk the page has', async () => {
      const { bundle, name } = await build(
        `e(()=>Promise.resolve().then(()=>ns),"${P}");import("./Orders.js")`,
        ['assets/Orders.js']
      );
      name();
      expect(bundle['assets/index.js'].code).toBe(
        'e(()=>Promise.resolve().then(()=>ns),0);import("./Orders.js")'
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Nothing waits for the translations of assets/Orders.js'
        )
      );
    });

    it('leaves an import alone whose module the bundler put into a chunk the page has', async () => {
      const { bundle, name } = await build(
        `e(()=>Promise.resolve().then(()=>(init(),ns)),"${P}")`,
        []
      );
      name();
      expect(bundle['assets/index.js'].code).toBe(
        'e(()=>Promise.resolve().then(()=>(init(),ns)),0)'
      );
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('files named by their own hash, with a map', () => {
    const ASSIGNMENT = {
      entries: new Map([['assets/index.js', ['title']]]),
      files: new Map([
        ['assets/Home', ['home']],
        ['assets/Orders', ['orders']],
      ]),
      imports: new Map(),
    };
    const FR = { title: 'Titre', home: 'Accueil', orders: 'Commandes' };
    const render = (
      fr: Record<string, unknown> = FR,
      assignment: TranslationAssignment = ASSIGNMENT
    ) =>
      renderChunkTranslations(
        assignment,
        { defaultLocale: 'en', locales: ['fr', 'de'] },
        { fr, de: { home: 'Start' } },
        '/',
        undefined,
        { key: 'assets/gt-map', files: 'assets/gt' }
      );
    const read = ({ files }: ReturnType<typeof render>) =>
      Object.fromEntries(
        files.map(({ fileName, source }) => [fileName, JSON.parse(source)])
      );

    it("writes the hash in the name of each locale's map under a name that every build has", () => {
      const { files, manifest } = renderChunkTranslations(
        ASSIGNMENT,
        { defaultLocale: 'en', locales: ['fr', 'de'] },
        { fr: FR, de: { home: 'Start' } },
        '/',
        undefined,
        { key: 'assets/gt-map', files: 'assets/gt' },
        'assets/gt-current'
      );
      expect(read({ files } as ReturnType<typeof render>)).toMatchObject({
        'assets/gt-current.json': { v: { fr: '04905701', de: '236306e2' } },
      });
      expect(manifest.maps).toEqual({
        fr: 'assets/gt-map.fr.04905701.json',
        de: 'assets/gt-map.de.236306e2.json',
      });
      expect(manifest.current).toBe('assets/gt-current.json');
      expect(manifest.entries['assets/index.js'].startupScript).toContain(
        '"v":{"fr":"04905701","de":"236306e2"},"n":"assets/gt-current","c":"'
      );
    });

    it.each([
      [undefined, 'token'],
      ['token', 'token'],
      ['map', 'map'],
    ] as const)('is chosen by the option %s: %s', (option, expected) => {
      expect(getChunkTranslationsNaming(option)).toBe(expected);
    });

    it.each(['hash', ''])(
      'rejects the naming %j, which it does not have',
      (naming) => {
        expect(() => getChunkTranslationsNaming(naming as never)).toThrow(
          `The naming of chunk translations is set to "${naming}", which is not one of token, map. Set experimentalSplitTranslations.naming to one of them.`
        );
      }
    );

    it('compiles the app to read the maps, and nothing else differently', async () => {
      const MAPPED = {
        ...ON,
        experimentalSplitTranslations: { naming: 'map' as const },
      };
      const compiled = await transform(MODULE, MAPPED);
      expect(compiled).toContain(
        'initializeMappedChunkTranslations as __gt_chunk_initialize'
      );
      expect(
        compiled!.replace(
          'initializeMappedChunkTranslations',
          'initializeChunkTranslations'
        )
      ).toBe(await transform(MODULE));
      expect(
        wrapDynamicImports(`import('./a.js');`, '/a.js', 'map')?.code
      ).toBe(
        `import { loadMappedChunk as __gt_chunk_load } from "gt-react/chunk-translations";__gt_chunk_load(() => import('./a.js'), "__GT_CHUNK_TRANSLATIONS_IMPORT__");`
      );
    });

    it('writes each file that holds something by its hash alone, the map of what names a chunk, and the manifest', () => {
      const rendered = render();
      const { manifest } = rendered;
      expect(read(rendered)).toEqual({
        'assets/gt.fr.634cb4aad30a70ab.json': { home: 'Accueil' },
        'assets/gt.fr.8e28fd5eaf53520e.json': { orders: 'Commandes' },
        'assets/gt-map.fr.04905701.json': {
          i: {
            k: ['assets/Home', 'assets/Orders'],
            c: [],
            h: ['634cb4aad30a70ab', '8e28fd5eaf53520e'],
          },
        },
        'assets/gt.fr.0e97fb5539058000.json': { t: { title: 'Titre' } },
        // No file for Orders, which has no translation in de
        'assets/gt.de.94ca6839e14a2bb6.json': { home: 'Start' },
        'assets/gt-map.de.236306e2.json': {
          i: { k: ['assets/Home'], c: [], h: ['94ca6839e14a2bb6'] },
        },
        'assets/gt.de.c9f7dd1b4dcda0ff.json': { t: {} },
      });
      expect(manifest.maps).toEqual({
        fr: 'assets/gt-map.fr.04905701.json',
        de: 'assets/gt-map.de.236306e2.json',
      });
      expect(manifest.files).toEqual({
        'assets/Home': {
          fr: 'assets/gt.fr.634cb4aad30a70ab.json',
          de: 'assets/gt.de.94ca6839e14a2bb6.json',
        },
        'assets/Orders': { fr: 'assets/gt.fr.8e28fd5eaf53520e.json' },
      });
      expect(manifest.entries['assets/index.js'].translations).toEqual({
        fr: 'assets/gt.fr.0e97fb5539058000.json',
        de: 'assets/gt.de.c9f7dd1b4dcda0ff.json',
      });
      const script = manifest.entries['assets/index.js'].startupScript;
      expect(script).toContain(
        '{"b":"/","f":"assets/gt","h":{"fr":"0e97fb5539058000","de":"c9f7dd1b4dcda0ff"},"v":{"fr":"04905701","de":"236306e2"}}'
      );
      expect(script).toContain(
        '(window["__GT_CHUNK_TRANSLATIONS__"],"assets/gt-map");'
      );
      expect(script).not.toContain('startPreloadedTranslations');
    });

    const names = (rendered: ReturnType<typeof render>) =>
      rendered.files.map(({ fileName }) => fileName).sort();
    const added = (
      before: ReturnType<typeof render>,
      after: ReturnType<typeof render>
    ) => names(after).filter((name) => !names(before).includes(name));

    it('renames only the file a translation is in, and the map', () => {
      expect(added(render(), render({ ...FR, home: 'Maison' }))).toEqual([
        expect.stringMatching(/^assets\/gt-map\.fr\./),
        'assets/gt.fr.4126901353bc0504.json',
      ]);
    });

    it('renames only the maps when chunks are renamed, as by a change to JavaScript alone', () => {
      const assign = (suffix: string): TranslationAssignment => ({
        entries: new Map([[`assets/index-${suffix}.js`, ['title']]]),
        files: new Map([
          [`assets/Home-${suffix}`, ['home']],
          [`assets/Orders-${suffix}`, ['orders']],
        ]),
        imports: new Map([
          [`assets/Home-${suffix}.js`, [`assets/Home-${suffix}`]],
          [
            `assets/Orders-${suffix}.js`,
            [`assets/Home-${suffix}`, `assets/Orders-${suffix}`],
          ],
        ]),
      });
      const before = render(FR, assign('a1'));
      expect(added(before, render(FR, assign('b2')))).toEqual([
        expect.stringMatching(/^assets\/gt-map\.de\./),
        expect.stringMatching(/^assets\/gt-map\.fr\./),
      ]);
      // What names a chunk is in the map, and in no file that holds translations
      const files = read(before);
      expect(files[before.manifest.maps!.fr]).toEqual({
        i: {
          k: ['assets/Home-a1', 'assets/Orders-a1'],
          c: [[1], [1, 0, 1]],
          h: ['634cb4aad30a70ab', '8e28fd5eaf53520e'],
        },
      });
      expect(
        files[before.manifest.entries['assets/index-a1.js'].translations.fr]
      ).toEqual({ t: { title: 'Titre' } });
    });

    it('writes files that hold the same once, for every chunk and entry they are of', () => {
      const rendered = render(FR, {
        entries: new Map([
          ['assets/index.js', ['title']],
          ['assets/admin.js', ['title']],
        ]),
        files: new Map([
          ['assets/Home', ['home']],
          ['assets/Start', ['home']],
        ]),
        imports: new Map(),
      });
      const { manifest } = rendered;
      expect(names(rendered).filter((name) => name.includes('.fr.'))).toEqual([
        'assets/gt-map.fr.32d51803.json',
        'assets/gt.fr.0e97fb5539058000.json',
        'assets/gt.fr.634cb4aad30a70ab.json',
      ]);
      expect(manifest.files['assets/Start']).toEqual(
        manifest.files['assets/Home']
      );
      expect(manifest.entries['assets/admin.js'].translations).toEqual(
        manifest.entries['assets/index.js'].translations
      );
      expect(read(rendered)[manifest.maps!.fr].i.h).toEqual([
        '634cb4aad30a70ab',
        '634cb4aad30a70ab',
      ]);
    });

    it('names a file by a hash long enough to be its own in every build, whatever else a build holds', () => {
      // The hashes of these two start with the same eight digits
      const home = 'assets/gt.fr.81e93a64b34dc6f2.json';
      const orders = 'assets/gt.fr.81e93a6465ccc97c.json';
      const one = render({ ...FR, home: 'Accueil 353965' });
      const other = render({ ...FR, orders: 'Commandes 28037' });
      expect(one.manifest.files['assets/Home'].fr).toBe(home);
      expect(other.manifest.files['assets/Orders'].fr).toBe(orders);
      // Each keeps its name next to the other, as a visitor may hold both
      expect(
        render({ ...FR, home: 'Accueil 353965', orders: 'Commandes 28037' })
          .manifest.files
      ).toMatchObject({
        'assets/Home': { fr: home },
        'assets/Orders': { fr: orders },
      });
    });
  });

  describe('the unsplit translations', () => {
    const P = UNSPLIT_LOADER_PLACEHOLDER;
    const STATE = '__GT_CHUNK_TRANSLATIONS__';

    it('are what the catalog holds and no call site reads from a chunk', () => {
      expect(
        getUnsplitTranslations(
          {
            fr: {
              wrapped: 'Enveloppé',
              dead: 'Mort',
              msg: 'Message',
              both: 'Les deux',
              dictionary: 'Dictionnaire',
              empty: null,
            },
            de: { wrapped: 'Verpackt', dead: 'Tot' },
          },
          {
            locales: ['fr', 'de', 'ja'],
            // A message of unused code was compiled like any other
            hashes: new Set(['wrapped', 'dead', 'both']),
            // A msg, and a msg whose text a t template also has
            unsplit: new Set(['msg', 'both']),
          }
        )
      ).toEqual({
        fr: { both: 'Les deux', dictionary: 'Dictionnaire', msg: 'Message' },
      });
    });

    it('lists for a framework the unsplit messages of every locale, once each', () => {
      expect(
        getUnsplitHashes({
          fr: { msg: 'Message', both: 'Les deux' },
          de: { both: 'Beide', dictionary: 'Wörterbuch' },
        })
      ).toEqual(['both', 'dictionary', 'msg']);
    });

    it('leaves the call that starts the app as it was written when there are none', () => {
      const code = `function start(config) {\n\treturn initialize(initializeGTSPA, config, "${P}");\n}`;
      expect(replaceUnsplitLoader(code, false)).toBe(
        'function start(config) {\n\treturn initialize(initializeGTSPA, config);\n}'
      );
      expect(replaceUnsplitLoader('start();', false)).toBeUndefined();
      expect(replaceUnsplitLoader('start();', true)).toBeUndefined();
    });

    it('fails the build when it cannot read the call that starts the app', () => {
      expect(() =>
        replaceUnsplitLoader(`initialize(...[spa, config, "${P}"])`, true)
      ).toThrow('could not write the loader of the unsplit translations');
    });

    /** Starts an app whose build has unsplit files, and loads the catalog of fr. */
    function load(state: object | undefined, fetched = vi.fn()) {
      const code = replaceUnsplitLoader(
        `return initialize$1(initializeGTSPA, config, \`${P}\`);`,
        true
      )!;
      vi.stubGlobal(STATE, state);
      vi.stubGlobal('fetch', fetched);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // gt-react's entry replaces the app's loader, then gt-react calls the one it is given
      const catalog = new Function(
        'initialize$1',
        'initializeGTSPA',
        'config',
        code
      )(
        (initialize: (config: object) => Promise<object>, config: object) =>
          initialize({
            ...config,
            loadTranslations: () => Promise.resolve({}),
          }),
        (config: { locales: string[]; loadTranslations: Function }) =>
          config.loadTranslations(config.locales[0]),
        { locales: ['fr'] }
      ) as Promise<object>;
      return { catalog, fetched, warn };
    }
    const respond = (file: unknown, ok = true) =>
      Promise.resolve({ ok, status: 404, json: () => file });
    const LOADED = { b: '/', u: 'assets/gt-unsplit', o: { fr: '33333333' } };

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('loads the unsplit file as the catalog gt-react asks for', async () => {
      const { catalog, fetched, warn } = load(
        { ...LOADED },
        vi.fn(() => respond({ msg: 'Message' }))
      );
      expect(await catalog).toEqual({ msg: 'Message' });
      expect(fetched.mock.calls).toEqual([
        ['/assets/gt-unsplit.fr.33333333.json'],
      ]);
      expect(warn).not.toHaveBeenCalled();
    });

    it('reads the request the startup script made', async () => {
      const { catalog, fetched } = load({
        ...LOADED,
        q: { fr: Promise.resolve({ msg: 'Du script' }) },
      });
      expect(await catalog).toEqual({ msg: 'Du script' });
      expect(fetched).not.toHaveBeenCalled();
    });

    it.each([
      ['a page without the startup script', undefined],
      ['a locale without an unsplit file', { ...LOADED, o: { de: '4' } }],
    ])('loads nothing on %s', async (_name, state) => {
      const { catalog, fetched, warn } = load(state);
      expect(await catalog).toEqual({});
      expect(fetched).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it('loads nothing and warns when the file is missing, and asks again next time', async () => {
      const state: { q?: Record<string, unknown> } = { ...LOADED };
      const { catalog, warn } = load(
        state,
        vi.fn(() => respond(undefined, false))
      );
      expect(await catalog).toEqual({});
      expect(warn.mock.calls).toEqual([
        [
          expect.stringMatching(
            /^gt-react Warning: Could not load the translations in \/assets\/gt-unsplit\.fr\.33333333\.json\..*Details: Error: HTTP 404/
          ),
        ],
      ]);
      expect(state.q).toEqual({ fr: undefined });
    });

    it('stops waiting for a file after the timeout', async () => {
      vi.useFakeTimers();
      const { catalog, warn } = load(
        { ...LOADED, w: 2000 },
        vi.fn(() => new Promise(() => {}))
      );
      let loaded: object | undefined;
      void catalog.then((file) => (loaded = file));
      await vi.advanceTimersByTimeAsync(1999);
      expect(loaded).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(loaded).toEqual({});
      expect(warn.mock.calls[0][0]).toContain(
        'The translations in /assets/gt-unsplit.fr.33333333.json did not load within 2000 ms'
      );
    });

    it('writes the file of each locale that has one, and says so once', () => {
      const { files, manifest, unsplit } = renderChunkTranslations(
        {
          entries: new Map([['assets/index.js', ['title']]]),
          files: new Map(),
          imports: new Map(),
        },
        { defaultLocale: 'en', locales: ['fr', 'de'] },
        { fr: { title: 'Titre' }, de: { title: 'Titel' } },
        '/',
        { key: 'assets/gt-unsplit', translations: { fr: { msg: 'Message' } } }
      );
      expect(files[0]).toEqual({
        fileName: 'assets/gt-unsplit.fr.9ddbca58.json',
        source: '{"msg":"Message"}',
      });
      expect(manifest.unsplit).toEqual({
        fr: 'assets/gt-unsplit.fr.9ddbca58.json',
      });
      expect(manifest.entries['assets/index.js'].startupScript).toContain(
        '(window["__GT_CHUNK_TRANSLATIONS__"],"assets/gt-unsplit",{"fr":"9ddbca58"});'
      );
      expect(unsplit).toEqual([{ locale: 'fr', count: 1, bytes: 17 }]);
      expect(createUnsplitTranslationsMessage(unsplit)).toContain(
        'Some translations are not split by chunk: 1 for "fr" (0.0 kB)'
      );
    });

    it.each([
      ['precomputed', true],
      ['left as tagged templates', false],
    ])(
      'leaves no translation of a t template unsplit when messages are %s',
      async (_name, precomputeMessages) => {
        const options = { ...ON, precomputeMessages };
        const translations = {
          ab72d114d0d156a9: 'Enregistrer',
          b785eb9d5af50191: ['Bonjour, ', ['name'], ' !'],
        };
        const created = createPlugins(options, 'vite', {
          'translations/fr.json': JSON.stringify(translations),
        });
        const compiled = await transform(
          `import { initializeGTSPA, t } from 'gt-react';
export const ready = initializeGTSPA({});
export const save = () => t\`Save\`;
export const hello = (name) => t\`Hello, \${{ name }}!\`;`,
          options,
          created
        );
        expect(compiled!.includes('$_tree')).toBe(precomputeMessages);
        const vite = created.plugins[0].vite as {
          configResolved: (config: object) => void;
          renderChunk: (code: string) => string | null;
          generateBundle: (
            this: object,
            options: object,
            bundle: object
          ) => void;
        };
        vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });

        const emitted: Record<string, string> = {};
        vite.generateBundle.call(
          {
            emitFile: (file: { fileName: string; source: string }) =>
              (emitted[file.fileName.replace(/\.[0-9a-f]{8}\.json$/, '')] =
                file.source),
          },
          {},
          {
            'assets/index.js': {
              type: 'chunk',
              fileName: 'assets/index.js',
              code: vite.renderChunk(compiled!),
              imports: [],
              dynamicImports: [],
              isEntry: true,
              moduleIds: [path.join(created.cwd, 'App.jsx')],
            },
          }
        );
        expect(JSON.parse(emitted['assets/index.fr'])).toEqual({
          t: translations,
        });
        expect(Object.keys(emitted)).not.toContain('assets/gt-unsplit.fr');
      }
    );

    it('keeps the translation of a msg that a t template shares its text with, and of nothing unused', async () => {
      const created = createPlugins(ON, 'vite', {
        'translations/fr.json': JSON.stringify({
          ab72d114d0d156a9: 'Enregistrer',
          b785eb9d5af50191: ['Bonjour, ', ['name'], ' !'],
          '0123456789abcdef': 'Seulement dans le catalogue',
        }),
      });
      const compiled = await transform(
        `import { initializeGTSPA, msg, t } from 'gt-react';
export const ready = initializeGTSPA({});
export const save = () => t\`Save\`;
export const saved = msg\`Save\`;
export const unused = (name) => t\`Hello, \${{ name }}!\`;`,
        ON,
        created
      );
      const vite = created.plugins[0].vite as {
        configResolved: (config: object) => void;
        renderChunk: (code: string) => string | null;
        generateBundle: (this: object, options: object, bundle: object) => void;
      };
      vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });

      const rendered = vite.renderChunk(compiled!);
      expect(rendered).toContain(
        'loadTranslations: (locale) => ((locale) => (function'
      );
      expect(rendered).not.toContain(P);

      const emitted: Record<string, string> = {};
      vite.generateBundle.call(
        {
          emitFile: (file: { fileName: string; source: string }) =>
            (emitted[file.fileName.replace(/\.[0-9a-f]{8}\.json$/, '')] =
              file.source),
        },
        {},
        {
          // The bundler dropped the unused function
          'assets/index.js': {
            type: 'chunk',
            fileName: 'assets/index.js',
            code: 't({$_hash:"ab72d114d0d156a9"})`Save`',
            imports: [],
            dynamicImports: [],
            isEntry: true,
            // The app imports a catalog in a way the build could not take out
            moduleIds: [
              path.join(created.cwd, 'App.jsx'),
              `${path.join(created.cwd, 'translations/fr.json')}?import`,
            ],
          },
        }
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'The build still bundles translations/fr.json because the app imports them'
        )
      );
      expect(JSON.parse(emitted['assets/gt-unsplit.fr'])).toEqual({
        '0123456789abcdef': 'Seulement dans le catalogue',
        ab72d114d0d156a9: 'Enregistrer',
      });
      expect(JSON.parse(emitted['assets/index.fr'])).toEqual({
        t: { ab72d114d0d156a9: 'Enregistrer' },
      });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('2 for "fr" (0.1 kB)')
      );
    });

    it.each([
      [
        'a namespace import',
        `import * as gt from 'gt-react';
export const ready = gt.initializeGTSPA({});`,
      ],
      ['a re-export', `export { initializeGTSPA } from 'gt-react';`],
      [
        "an import through the app's own module",
        `import { initializeGTSPA } from './i18n';
export const ready = initializeGTSPA({});`,
      ],
    ])(
      'says that the app starts without the files when initializeGTSPA is only %s, and not that nothing loads a bundled catalog',
      async (_name, code) => {
        const created = createPlugins(ON, 'vite', {
          'translations/fr.json': JSON.stringify({}),
        });
        await transform(code, ON, created);
        const vite = created.plugins[0].vite as {
          configResolved: (config: object) => void;
          generateBundle: (
            this: object,
            options: object,
            bundle: object
          ) => void;
        };
        vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });
        vite.generateBundle.call(
          { emitFile() {} },
          {},
          {
            'assets/index.js': {
              type: 'chunk',
              fileName: 'assets/index.js',
              code: '',
              imports: [],
              dynamicImports: [],
              isEntry: true,
              moduleIds: [
                path.join(created.cwd, 'App.jsx'),
                `${path.join(created.cwd, 'translations/fr.json')}?import`,
              ],
            },
          }
        );
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'did not find the initializeGTSPA that starts the app because no module the build compiled imports it by name'
          )
        );
        expect(console.warn).not.toHaveBeenCalledWith(
          expect.stringContaining('The build still bundles')
        );
      }
    );
  });

  describe('the startup script', () => {
    /** Runs the script in a page with these cookies and browser languages. */
    const TOKENS = { fr: '44444444', 'pt-BR': '55555555' };
    const link = (href: string, rel = 'modulepreload') => ({
      nodeName: 'LINK',
      rel,
      href,
    });

    /**
     * Runs the script in a page with these cookies and browser languages.
     * `files` are the keys of the build's files, and `links` the links the
     * page holds before the script.
     */
    function run(
      cookie: string,
      languages: string[],
      {
        unsplit,
        files = [],
        maps,
        regions,
        responses = {},
        links = [],
        base = '/',
        baseURI = 'https://app.test/',
        readyState = 'loading',
      }: {
        unsplit?: { key: string; hashes: Record<string, string> };
        files?: string[];
        maps?: { key: string };
        regions?: Record<string, Record<string, string>>;
        responses?: Record<string, unknown>;
        links?: object[];
        base?: string;
        /** The page's URL */
        baseURI?: string;
        readyState?: DocumentReadyState;
      } = {}
    ) {
      const fetched: string[] = [];
      type State = {
        l?: string;
        p?: object;
        q?: object;
        g?: object;
        r?: object;
        e?: object;
      };
      const window: { MutationObserver?: object } & Record<string, State> = {};
      const script = renderStartupScript({
        base,
        entry: 'assets/index-a1',
        hashes: { fr: '11111111', 'pt-BR': '22222222' },
        tokens: TOKENS,
        files,
        maps,
        regions,
        locales: ['en', 'fr', 'pt-BR', 'ja'],
        unsplit,
      });
      const page = {
        observe: undefined as ((records: object[]) => void) | undefined,
        observing: false,
        parsed: () => {},
      };
      class Observer {
        constructor(observe: (records: object[]) => void) {
          page.observe = observe;
        }
        observe() {
          page.observing = true;
        }
        disconnect() {
          page.observing = false;
        }
      }
      window.MutationObserver = Observer;
      new Function('document', 'navigator', 'fetch', 'window', script)(
        {
          cookie,
          baseURI,
          readyState,
          querySelectorAll: () => links,
          addEventListener: (_name: string, parsed: () => void) =>
            (page.parsed = parsed),
        },
        { languages },
        (url: string) => {
          fetched.push(url);
          return Promise.resolve({
            ok: true,
            json: () => responses[url] ?? {},
          });
        },
        window
      );
      return {
        fetched,
        state: window.__GT_CHUNK_TRANSLATIONS__,
        page,
        /** The parser reaches a link after the script. */
        add: (added: object) => page.observe?.([{ addedNodes: [added] }]),
      };
    }

    it.each([
      [
        'the cookie gt-react keeps',
        'a=b; generaltranslation.locale=fr',
        ['en-US'],
        'fr',
      ],
      ["the browser's first language that is a locale", '', ['fr'], 'fr'],
      ['a language a locale shares', '', ['pt-PT', 'fr'], 'pt-BR'],
      ['a region of a locale', '', ['FR-ca', 'en'], 'fr'],
      ['the next language when one is unknown', '', ['sv', 'fr-FR'], 'fr'],
    ])('requests the entry file for %s', (_name, cookie, languages, locale) => {
      const { fetched, state } = run(cookie, languages);
      const hash = locale === 'fr' ? '11111111' : '22222222';
      expect(fetched).toEqual([`/assets/index-a1.${locale}.${hash}.json`]);
      expect(state).toMatchObject({
        b: '/',
        f: 'assets/index-a1',
        l: locale,
        p: { [locale]: expect.any(Promise) },
      });
    });

    it.each([
      ['the default locale', '', ['en-GB', 'fr']],
      ['a locale without a file', '', ['ja']],
      ['no known language', '', ['sv']],
      ['i18n turned off', 'generaltranslation.enable-i18n=false', ['fr']],
      [
        'a cookie for the default locale',
        'generaltranslation.locale=en',
        ['fr'],
      ],
    ])('requests nothing for %s', (_name, cookie, languages) => {
      const { fetched, state } = run(cookie, languages);
      expect(fetched).toEqual([]);
      expect(state).toEqual({
        b: '/',
        f: 'assets/index-a1',
        h: { fr: '11111111', 'pt-BR': '22222222' },
        v: TOKENS,
      });
    });

    it.each([
      ['/', '/index.html', '/'],
      ['/app/', '/pages/nested.html', '/app/'],
      [
        'https://cdn.example.com/app/',
        '/pages/nested.html',
        'https://cdn.example.com/app/',
      ],
      ['./', '/index.html', './'],
      ['', '/index.html', './'],
      ['./', '/pages/nested.html', '../'],
      ['', '/pages/admin/index.html', '../../'],
    ])(
      'gives a page the base %j as its own URLs have it: %s',
      (base, page, expected) => {
        expect(getPageBase(base, page)).toBe(expected);
      }
    );

    it.each([
      ['./', 'https://example.com/app/index.html?tab=1#orders', '/app/'],
      ['', 'https://example.com/app/', '/app/'],
      ['../', 'https://example.com/app/pages/nested.html', '/app/'],
    ])(
      'resolves the relative base %j against the page as it loads',
      (base, baseURI, directory) => {
        const { fetched, state } = run('', ['fr'], {
          base,
          baseURI,
          files: ['assets/Orders-b2'],
          unsplit: { key: 'assets/gt-unsplit', hashes: { fr: '33333333' } },
          links: [link(`https://example.com${directory}assets/Orders-b2.js`)],
        });
        const root = `https://example.com${directory}`;
        expect(state.b).toBe(root);
        expect(fetched).toEqual([
          `${root}assets/index-a1.fr.11111111.json`,
          `${root}assets/Orders-b2.fr.44444444.json`,
          `${root}assets/gt-unsplit.fr.33333333.json`,
        ]);
      }
    );

    it('writes each page of a build with a relative base its own way to the files', () => {
      const created = createPlugins(ON, 'vite', {
        'translations/fr.json': JSON.stringify({ [SAVE]: 'Enregistrer' }),
      });
      const vite = created.plugins[0].vite as {
        configResolved: (config: object) => void;
        generateBundle: (this: object, options: object, bundle: object) => void;
        transformIndexHtml: {
          handler: (html: string, context: object) => { children: string }[];
        };
      };
      vite.configResolved({ base: './', build: { assetsDir: 'assets' } });
      const emitted: Record<string, string> = {};
      vite.generateBundle.call(
        {
          emitFile: (file: { fileName: string; source: string }) =>
            (emitted[file.fileName] = file.source),
        },
        {},
        {
          'assets/index.js': {
            type: 'chunk',
            fileName: 'assets/index.js',
            code: '',
            imports: [],
            dynamicImports: [],
            isEntry: true,
          },
        }
      );
      const write = (page: string) =>
        vite.transformIndexHtml.handler('', {
          path: page,
          chunk: { fileName: 'assets/index.js' },
        })[0].children;
      expect(write('/index.html')).toContain(
        '{b:new URL("./",document.baseURI).href}'
      );
      expect(write('/pages/nested.html')).toContain(
        '{b:new URL("../",document.baseURI).href}'
      );
      // A server that writes its own page serves it from the build's root
      expect(
        JSON.parse(emitted['assets/gt-chunk-translations.json']).entries[
          'assets/index.js'
        ].startupScript
      ).toBe(write('/index.html'));
    });

    it('cannot end the script element it is written into', () => {
      expect(
        renderStartupScript({
          base: '/</script>/',
          entry: 'a',
          hashes: {},
          tokens: {},
          files: ['</script>'],
          locales: [],
          unsplit: { key: '</script>', hashes: {} },
        })
      ).not.toContain('</script>');
    });

    const FILES = ['assets/Orders-b2', 'assets/Glossary-c3'];

    it('requests the files of the chunks the page preloads, wherever their links are', () => {
      const { fetched, state, add, page } = run('', ['fr'], {
        files: FILES,
        links: [
          link('https://app.test/assets/Orders-b2.js'),
          // Not a chunk with a file, and not a preload
          link('https://app.test/assets/vendor-d4.js'),
          link('https://app.test/assets/Glossary-c3.js', 'stylesheet'),
        ],
      });
      expect(fetched).toEqual([
        '/assets/index-a1.fr.11111111.json',
        '/assets/Orders-b2.fr.44444444.json',
      ]);

      // The parser adds a link below the script
      add(link('https://app.test/assets/Glossary-c3.js?x=1'));
      add(link('https://app.test/assets/Orders-b2.js'));
      add({ nodeName: 'SCRIPT' });
      expect(fetched.slice(2)).toEqual([
        '/assets/Glossary-c3.fr.44444444.json',
      ]);
      expect(state.g).toEqual({
        'fr assets/Orders-b2': expect.any(Promise),
        'fr assets/Glossary-c3': expect.any(Promise),
      });

      expect(page.observing).toBe(true);
      page.parsed();
      expect(page.observing).toBe(false);
    });

    it.each([
      ['/app/', 'https://app.test/', 'https://app.test/app/'],
      ['https://cdn.test/v1/', 'https://app.test/', 'https://cdn.test/v1/'],
      ['//cdn.test/v1/', 'https://app.test/', 'https://cdn.test/v1/'],
      ['../', 'https://app.test/app/pages/a.html', 'https://app.test/app/'],
    ])(
      'reads the key of a preloaded chunk as the rest of its URL after the base %j',
      (base, baseURI, root) => {
        const { fetched } = run('', ['fr'], {
          base,
          baseURI,
          files: FILES,
          links: [
            link(`${root}assets/Orders-b2.mjs#x`),
            // The same end of the path, somewhere the build's files are not
            link('https://other.test/assets/Glossary-c3.js'),
            link(`${root}old/assets/Glossary-c3.js`),
          ],
        });
        const served = base === '../' ? root : base;
        expect(fetched).toEqual([
          `${served}assets/index-a1.fr.11111111.json`,
          `${served}assets/Orders-b2.fr.44444444.json`,
        ]);
      }
    );

    it('tests one key for a preloaded chunk, and requests a file the filter is wrong about where the build would have written it', () => {
      // Of chunks without a file, the filter of FILES takes `vendor-5wl` for
      // a key and not `assets/vendor-5wl`, and `assets/vendor-4s9` for one
      const { fetched, state } = run('', ['fr'], {
        files: FILES,
        links: [
          link('https://app.test/assets/vendor-5wl.js'),
          link('https://app.test/assets/vendor-4s9.js'),
        ],
      });
      expect(fetched).toEqual([
        '/assets/index-a1.fr.11111111.json',
        '/assets/vendor-4s9.fr.44444444.json',
      ]);
      expect(Object.keys(state.g!)).toEqual(['fr assets/vendor-4s9']);
    });

    it.each([
      ['the default locale', ['en']],
      ['a locale without files', ['ja']],
    ])('requests no file of a preloaded chunk for %s', (_name, languages) => {
      const { fetched, state, page } = run('', languages, {
        files: FILES,
        links: [link('https://app.test/assets/Orders-b2.js')],
      });
      expect(fetched).toEqual([]);
      expect(state.g).toBeUndefined();
      expect(page.observing).toBe(false);
    });

    it('tells the keys that have a file from nearly all that have none', () => {
      const keys = Array.from(
        { length: 1000 },
        (_, index) => `assets/a-${index}`
      );
      const { fetched, add } = run('', ['fr'], { files: keys });
      for (const key of keys) add(link(`https://app.test/${key}.js`));
      expect(fetched).toHaveLength(1 + keys.length);
      for (let index = 0; index < 1000; index++) {
        add(link(`https://app.test/other/b-${index}.js`));
      }
      expect(fetched.length - 1 - keys.length).toBeLessThan(20);
    });

    const UNSPLIT = { key: 'assets/gt-unsplit', hashes: { fr: '33333333' } };

    it('requests the unsplit file of the locale it read with the entry file', () => {
      const { fetched, state } = run('', ['fr'], { unsplit: UNSPLIT });
      expect(fetched).toEqual([
        '/assets/index-a1.fr.11111111.json',
        '/assets/gt-unsplit.fr.33333333.json',
      ]);
      expect(state).toMatchObject({
        u: 'assets/gt-unsplit',
        o: { fr: '33333333' },
        q: { fr: expect.any(Promise) },
      });
    });

    it.each([
      ['a locale without one', ['pt-BR'], 1],
      ['the default locale', ['en'], 0],
    ])('requests no unsplit file for %s', (_name, languages, requests) => {
      const { fetched, state } = run('', languages, { unsplit: UNSPLIT });
      expect(fetched).toHaveLength(requests);
      expect(state).toMatchObject({ o: { fr: '33333333' } });
      expect(state.q).toBeUndefined();
    });

    it('holds only what the build has: no code for unsplit files or preloaded chunks without any', () => {
      const script = renderStartupScript({
        base: '/',
        entry: 'a',
        hashes: {},
        tokens: {},
        files: [],
        locales: [],
      });
      expect(script).not.toContain('startUnsplitTranslations');
      expect(script).not.toContain('startPreloadedTranslations');
      expect(script).not.toContain('startMappedTranslations');
    });

    // A locale's map: the hash in the name of each chunk's file
    const MAP = {
      i: {
        k: [
          'assets/Orders-b2',
          'assets/Glossary-c3',
          'assets/Settings-e5',
          'assets/Reports-f6',
        ],
        c: [],
        h: ['aaaaaaaa', 'bbbbbbbb', 'aaaaaaaa', 0],
      },
    };

    it('with maps, requests the map with the entry file, then the files it lists for preloaded chunks', async () => {
      const { fetched, state, add } = run('', ['fr'], {
        maps: { key: 'assets/gt-map' },
        links: [
          link('https://app.test/assets/Orders-b2.js'),
          link('https://app.test/assets/vendor-d4.js'),
        ],
        responses: { '/assets/gt-map.fr.44444444.json': MAP },
      });
      expect(fetched).toEqual([
        '/assets/index-a1.fr.11111111.json',
        '/assets/gt-map.fr.44444444.json',
      ]);
      expect(state).toMatchObject({
        k: 'assets/gt-map',
        m: { fr: expect.any(Promise) },
      });

      // A file is named by the key of the entry's, the locale and its hash
      await new Promise((resolve) => setTimeout(resolve));
      expect(fetched.slice(2)).toEqual(['/assets/index-a1.fr.aaaaaaaa.json']);
      add(link('https://app.test/assets/Glossary-c3.js'));
      add(link('https://app.test/assets/Orders-b2.js'));
      // Settings has the file Orders has, and Reports has none in this locale
      add(link('https://app.test/assets/Settings-e5.js'));
      add(link('https://app.test/assets/Reports-f6.js'));
      expect(fetched.slice(3)).toEqual(['/assets/index-a1.fr.bbbbbbbb.json']);
    });

    it.each([
      [
        'one token per locale',
        { files: FILES },
        'fr assets/Orders-b2',
        '/assets/Glossary-c3.fr.44444444.json',
      ],
      [
        'a map per locale',
        {
          maps: { key: 'assets/gt-map' },
          responses: { '/assets/gt-map.fr.44444444.json': MAP },
        },
        'fr aaaaaaaa',
        '/assets/index-a1.fr.bbbbbbbb.json',
      ],
    ])(
      'with %s, requests no file gt-react has requested, for the link an import adds while the page loads',
      async (_name, build, requested, file) => {
        const { fetched, state, add } = run('', ['fr'], build);
        await new Promise((resolve) => setTimeout(resolve));
        const before = fetched.length;
        state.r = { [requested]: Promise.resolve(true) };

        add(link('https://app.test/assets/Orders-b2.js'));
        add(link('https://app.test/assets/Glossary-c3.js'));

        expect(fetched.slice(before)).toEqual([file]);
      }
    );

    it.each([
      [
        'one token per locale',
        { files: FILES },
        '/assets/Orders-b2.fr.44444444.json',
      ],
      [
        'a map per locale',
        {
          maps: { key: 'assets/gt-map' },
          responses: { '/assets/gt-map.fr.44444444.json': MAP },
        },
        '/assets/index-a1.fr.aaaaaaaa.json',
      ],
    ])(
      'with %s, reads the links of a page that is already parsed and watches for no more',
      async (_name, build, file) => {
        const { fetched, page } = run('', ['fr'], {
          ...build,
          readyState: 'interactive',
          links: [link('https://app.test/assets/Orders-b2.js')],
        });
        await new Promise((resolve) => setTimeout(resolve));

        expect(fetched[fetched.length - 1]).toBe(file);
        expect(page.observing).toBe(false);
      }
    );

    // The map of a build that splits by module, which is the file the script
    // names: the entry holds gt-aa, the import of Orders needs gt-bb, gt-cc
    // (which fr has no translations for) and gt-aa, the one of Help gt-dd
    const REGION_MAP = {
      i: {
        k: [
          'assets/gt-bb',
          'assets/gt-cc',
          'assets/gt-aa',
          'assets/gt-dd',
          'assets/Help-e5',
          'assets/Orders-b2',
        ],
        c: [0, 0, 0, 0, [0, 3, 1], [0, 0, 3]],
        h: ['88888888', 0, '77777777', '99999999'],
      },
    };
    const REGIONS = { fr: { 'assets/gt-aa': '77777777' } };

    it("split by module, requests the entry's files with the map, then the files the map lists for the imports of preloaded chunks", async () => {
      const { fetched, state, add, page } = run('', ['fr'], {
        regions: REGIONS,
        links: [
          link('https://app.test/assets/Orders-b2.js'),
          // A chunk that only other chunks import, and not a preload
          link('https://app.test/assets/shared-d4.js'),
          link('https://app.test/assets/Help-e5.js', 'stylesheet'),
        ],
        responses: { '/assets/index-a1.fr.11111111.json': REGION_MAP },
      });
      expect(fetched).toEqual([
        '/assets/index-a1.fr.11111111.json',
        '/assets/gt-aa.fr.77777777.json',
      ]);
      expect(state).toMatchObject({
        e: REGIONS,
        g: { 'fr assets/gt-aa': expect.any(Promise) },
      });

      await new Promise((resolve) => setTimeout(resolve));
      expect(fetched.slice(2)).toEqual(['/assets/gt-bb.fr.88888888.json']);

      // The parser adds a link below the script, under another path
      add(link('https://cdn.test/v1/app/assets/Help-e5.js?x=1'));
      add(link('https://app.test/assets/Orders-b2.js'));
      add(link('https://app.test/assets/gt-bb.js'));
      add({ nodeName: 'SCRIPT' });
      expect(fetched.slice(3)).toEqual(['/assets/gt-dd.fr.99999999.json']);

      expect(page.observing).toBe(true);
      page.parsed();
      expect(page.observing).toBe(false);
    });

    it('split by module, requests no file gt-react has requested, and none for a locale without a map', async () => {
      const { fetched, state, add } = run('', ['fr'], {
        regions: REGIONS,
        responses: { '/assets/index-a1.fr.11111111.json': REGION_MAP },
      });
      await new Promise((resolve) => setTimeout(resolve));
      const before = fetched.length;
      state.r = { 'fr assets/gt-bb': Promise.resolve(true) };
      add(link('https://app.test/assets/Orders-b2.js'));
      expect(fetched.slice(before)).toEqual([]);

      const other = run('', ['ja'], { regions: REGIONS });
      expect(other.fetched).toEqual([]);
      expect(other.state).toMatchObject({ e: REGIONS });
      expect(other.state.g).toBeUndefined();
    });

    it('names what gt-react exports', async () => {
      const entry = (await import('gt-react/chunk-translations')) as Record<
        string,
        unknown
      >;
      for (const kind of Object.keys(CHUNK_TRANSLATIONS_IMPORTS)) {
        for (const naming of chunkTranslationsNamings) {
          const name = getEntryExport(kind as ChunkTranslationsImport, naming);
          expect(entry[name], name).toBeTypeOf('function');
        }
        const name = getEntryExport(
          kind as ChunkTranslationsImport,
          'map',
          true
        );
        expect(entry[name], name).toBeTypeOf('function');
      }
    });
  });

  describe('hash minification', () => {
    const MINIFIED: GTUnpluginOptions = {
      ...ON,
      experimentalSplitTranslations: { minifyHashes: true },
    };
    // t`Save` and t`Print`
    const SAVE_TEXT = 'ab72d114d0d156a9';
    const PRINT_TEXT = 'aae8cb2668d0cb74';
    const idsOf = (hashes: string[]) => [...minifyHashes(hashes).values()];
    const minifiedIds = (): MinifiedIds => ({ hashes: new Map() });
    const site = (hash: string) => `t({$_hash:"${createIdPlaceholder(hash)}"})`;
    type Vite = {
      configResolved: (config: object) => void;
      renderChunk: (code: string) => string | null;
      generateBundle: (this: object, options: object, bundle: object) => void;
    };
    /** Renders each chunk and writes the build's files, by file without its hash. */
    function writeBundle(
      vite: Vite,
      chunks: Record<string, { code: string; [key: string]: unknown }>
    ) {
      vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });
      const emitted: Record<string, string> = {};
      const rendered = Object.fromEntries(
        Object.entries(chunks).map(([fileName, chunk]) => [
          fileName,
          {
            type: 'chunk',
            fileName,
            imports: [],
            dynamicImports: [],
            isEntry: false,
            ...chunk,
            code: vite.renderChunk(chunk.code) ?? chunk.code,
          },
        ])
      );
      vite.generateBundle.call(
        {
          emitFile: (file: { fileName: string; source: string }) =>
            (emitted[file.fileName.replace(/\.[0-9a-f]{8}\.json$/, '')] =
              file.source),
        },
        {},
        rendered
      );
      return { emitted, rendered };
    }

    it.each([
      [undefined, undefined, false],
      [undefined, '', false],
      [undefined, 'false', false],
      [undefined, '0', false],
      [undefined, 'true', true],
      [undefined, ' TRUE ', true],
      [undefined, '1', true],
      [true, 'false', true],
      [false, 'true', false],
    ] as const)(
      'is chosen by the option %s, then GT_MINIFY_HASHES=%s: %s',
      (option, env, expected) => {
        vi.stubEnv('GT_MINIFY_HASHES', env as never);
        expect(getMinifyHashes(option)).toBe(expected);
      }
    );

    it('rejects a variable that is not a boolean', () => {
      vi.stubEnv('GT_MINIFY_HASHES', '8');
      expect(() => getMinifyHashes(undefined)).toThrow(
        'GT_MINIFY_HASHES is set to "8", which is not a boolean. Set GT_MINIFY_HASHES to true or false.'
      );
    });

    it.each([
      ['enabled: false', { enabled: false, minifyHashes: true }, {}],
      [
        'GT_SPLIT_TRANSLATIONS=false',
        { minifyHashes: true },
        { GT_SPLIT_TRANSLATIONS: 'false' },
      ],
      [
        'no option, with GT_MINIFY_HASHES=true',
        undefined,
        { GT_MINIFY_HASHES: 'true' },
      ],
      [
        'enabled: false, with a GT_MINIFY_HASHES that is not a boolean',
        { enabled: false },
        { GT_MINIFY_HASHES: '8' },
      ],
    ])(
      'is ignored, and its variable is not read, in a build with the split off by %s',
      async (_, experimentalSplitTranslations, env) => {
        const off = { gtConfig: GT_CONFIG, precomputeMessages: false };
        const compiled = await transform(MODULE, off);
        for (const [name, value] of Object.entries(env)) {
          vi.stubEnv(name, value);
        }
        const created = createPlugins({
          ...off,
          experimentalSplitTranslations,
        });
        expect(created.plugins).toHaveLength(1);
        expect(created.plugins[0].buildStart as () => void).not.toThrow();
        expect(
          await transform(
            MODULE,
            { ...off, experimentalSplitTranslations },
            created
          )
        ).toBe(compiled);
      }
    );

    it('fails a build that writes the id of a <T> into its output', () => {
      const build = { framework: 'vite', compileTimeHash: true };
      const tagged = { ...GT_CONFIG, _tagIds: true };
      const resolved = resolveChunkTranslations(tagged, {
        ...build,
        minifyHashes: true,
      });
      expect('error' in resolved && resolved.error).toContain(
        'experimentalSplitTranslations.minifyHashes cannot be used with _tagIds'
      );
      expect(resolveChunkTranslations(tagged, build)).not.toHaveProperty(
        'error'
      );
      expect(
        resolveChunkTranslations(GT_CONFIG, { ...build, minifyHashes: true })
      ).toMatchObject({ minifiedIds: { hashes: new Map() } });
    });

    it.each([
      [
        'by chunk, named by token',
        {},
        ['loadChunk', 'loadMinifiedChunk'],
        ['initializeChunkTranslations', 'initializeMinifiedChunkTranslations'],
      ],
      [
        'by chunk, named by map',
        { naming: 'map' },
        ['loadMappedChunk', 'loadMinifiedMappedChunk'],
        [
          'initializeMappedChunkTranslations',
          'initializeMinifiedMappedChunkTranslations',
        ],
      ],
      [
        'by module',
        { by: 'module' },
        ['loadRegionChunk', 'loadMinifiedRegionChunk'],
        [
          'initializeRegionChunkTranslations',
          'initializeMinifiedRegionChunkTranslations',
        ],
      ],
    ] as const)(
      'imports the entry by names that only a gt-react that reads its files exports, split %s',
      async (_split, split, load, initialize) => {
        const imported = async (options: GTUnpluginOptions) => {
          const created = createPlugins(options);
          const wrap = created.plugins[1].transform as (
            this: unknown,
            code: string,
            id: string
          ) => Promise<{ code: string } | null>;
          const wrapped = await wrap.call(
            {},
            `import('./a.js');`,
            path.join(created.cwd, 'a.js')
          );
          const compiled = await transform(MODULE, options, created);
          return [wrapped?.code, compiled].map(
            (code) => / (\w+) as __gt_chunk_\w+ /.exec(code ?? '')?.[1]
          );
        };
        expect(
          await imported({
            ...ON,
            experimentalSplitTranslations: { ...split, minifyHashes: true },
          })
        ).toEqual([load[1], initialize[1]]);
        // A build without hash minification imports what it did
        expect(
          await imported({ ...ON, experimentalSplitTranslations: split })
        ).toEqual([load[0], initialize[0]]);
        const entry = (await import('gt-react/chunk-translations')) as Record<
          string,
          unknown
        >;
        for (const [name, minified] of [load, initialize]) {
          expect(entry[minified], minified).toBeTypeOf('function');
          expect(entry[minified], minified).toBe(entry[name]);
        }
      }
    );

    it("gives a message the name of the list of its chunk's messages, then its place in it", () => {
      expect(getListName([SAVE_TEXT, HELLO])).toBe('2bFNA3qJ');
      expect(minifyHashes([SAVE_TEXT, HELLO])).toEqual(
        new Map([
          [SAVE_TEXT, '2bFNA3qJ.0'],
          [HELLO, '2bFNA3qJ.1'],
        ])
      );
      // Wherever a chunk's code names them, and however often
      expect(minifyHashes([HELLO, SAVE_TEXT, HELLO])).toEqual(
        minifyHashes([SAVE_TEXT, HELLO])
      );
    });

    it.each([
      ['16 hexadecimal characters', [SAVE_TEXT, HELLO], '2bFNA3qJ'],
      ['11 base64url characters', ['q3LRFNDRVqk', 't4XrnVr1AZE'], 'Rze57V1q'],
    ])(
      'minifies the hashes of a chunk in the order of the hashes, whatever a hash is made of: %s',
      (_format, [first, second], name) => {
        const minified = minifiedIds();
        const code = [
          `e(T,{children:"Hello",_hash:'${createIdPlaceholder(second)}'})`,
          `t({$_hash:"${createIdPlaceholder(first)}",$_tree:"Save"})`,
          `t({$_hash:\`${createIdPlaceholder(first)}\`})\`Save\``,
          // A call site that reads the unsplit file by its hash
          `msg({$_hash:"${first}"})\`Save\``,
        ].join(';');
        expect(minifyChunk(code, minified)).toBe(
          [
            `e(T,{children:"Hello",_hash:'${name}.1'})`,
            `t({$_hash:"${name}.0",$_tree:"Save"})`,
            `t({$_hash:\`${name}.0\`})\`Save\``,
            `msg({$_hash:"${first}"})\`Save\``,
          ].join(';')
        );
        expect(minified.hashes).toEqual(
          new Map([
            [`${name}.0`, first],
            [`${name}.1`, second],
          ])
        );
        // No id is a string a hash of either format can be
        for (const id of minified.hashes.keys()) {
          expect(id).not.toMatch(/^(?:[0-9a-f]{16}|[A-Za-z0-9_-]{11})$/);
        }
        expect(minifyChunk(`msg({$_hash:"${first}"})`, minified)).toBe(
          undefined
        );
      }
    );

    // What a page of one build can meet in a file of another: an id of a
    // chunk whose messages changed is no id of the chunk as it is now
    it.each([
      ['gains a message', [SAVE_TEXT, HELLO], [PRINT_TEXT, SAVE_TEXT, HELLO]],
      [
        'loses a message',
        [SAVE_TEXT, HELLO, PRINT_TEXT],
        [SAVE_TEXT, PRINT_TEXT],
      ],
      ['has a message edited', [SAVE_TEXT, HELLO], [SAVE_TEXT, PRINT_TEXT]],
    ])(
      'shares no id between a chunk and the same chunk of a build in which it %s',
      (_change, before, after) => {
        const old = idsOf(before);
        expect(idsOf(after).filter((id) => old.includes(id))).toEqual([]);
      }
    );

    it('gives a chunk the same ids in every build that leaves its messages alone, and two chunks with the same messages the same ids', () => {
      const minified = minifiedIds();
      const home = `${site(SAVE_TEXT)};${site(HELLO)}`;
      const first = minifyChunk(home, minified)!;
      // Other code around the same call sites, and another chunk of the build
      expect(minifyChunk(`var revision=2;${home}`, minified)).toBe(
        `var revision=2;${first}`
      );
      // The same call sites the other way round, as when the bundler
      // orders the chunk's modules differently
      expect(minifyChunk(`${site(HELLO)};${site(SAVE_TEXT)}`, minified)).toBe(
        first.split(';').reverse().join(';')
      );
      minifyChunk(site(PRINT_TEXT), minified);
      expect([...minified.hashes]).toEqual([
        ['2bFNA3qJ.0', SAVE_TEXT],
        ['2bFNA3qJ.1', HELLO],
        [`${getListName([PRINT_TEXT])}.0`, PRINT_TEXT],
      ]);
    });

    it('fails the build when two lists of messages share a name, and names both messages', () => {
      const minified: MinifiedIds = {
        hashes: new Map([['2bFNA3qJ.0', PRINT_TEXT]]),
      };
      expect(() =>
        minifyChunk(`${site(SAVE_TEXT)};${site(HELLO)}`, minified)
      ).toThrow(
        `Hash minification gives two messages the id "2bFNA3qJ.0" because the lists of messages of two chunks have the same digest, and a page would render the translation of one message for the other. Turn experimentalSplitTranslations.minifyHashes off. Details: ${PRINT_TEXT} and ${SAVE_TEXT}.`
      );
    });

    it.each([
      ['a key of the translation files', { fr: { '2bFNA3qJ.1': 'Autre' } }, []],
      ['an id written by hand', {}, ['2bFNA3qJ.1']],
    ])('fails the build when an id is also %s', (_name, table, unsplit) => {
      const minified = minifiedIds();
      const code = minifyChunk(`${site(SAVE_TEXT)};${site(HELLO)}`, minified)!;
      const chunks = [{ fileName: 'assets/index.js', code }];
      expect(() =>
        readMinifiedIds(minified, { unsplit: new Set(unsplit) }, table, chunks)
      ).toThrow(
        'Hash minification gives a message an id that the translations already hold because a key of the translation files, or an id written by hand, is the same string, and a page would render one message for the other. Turn experimentalSplitTranslations.minifyHashes off. Details: 2bFNA3qJ.1.'
      );
      expect(
        readMinifiedIds(minified, { unsplit: new Set() }, {}, chunks).hashes
      ).toBe(minified.hashes);
    });

    it('fails the build when a chunk reaches the output with a placeholder at its call sites', () => {
      expect(() =>
        readMinifiedIds(minifiedIds(), { unsplit: new Set() }, {}, [
          { fileName: 'assets/worker.js', code: site(SAVE_TEXT) },
          { fileName: 'assets/index.js', code: 't({$_hash:"2bFNA3qJ.0"})' },
        ])
      ).toThrow(
        'Hash minification did not reach the call sites of a chunk because the bundler wrote them without rendering them through this plugin, so their call sites still hold a placeholder and would render the source text. Turn experimentalSplitTranslations.minifyHashes off. Details: assets/worker.js.'
      );
    });

    it("reads the ids out of a chunk's final code in any quotes, by their list and then their number", () => {
      const minified = minifiedIds();
      const hashes = Array.from({ length: 11 }, (_, place) =>
        place.toString(16).padStart(16, '0')
      );
      minifyChunk(hashes.map(site).join(';'), minified);
      minifyChunk(site(SAVE_TEXT), minified);
      const ids = readMinifiedIds(minified, { unsplit: new Set() }, {}, []);
      const [list] = idsOf(hashes)[0].split('.');
      const other = idsOf([SAVE_TEXT])[0];
      const code = [
        `t({$_hash:\`${list}.10\`,$_tree:[\`Hello, \`,[\`name\`],\`!\`]},{name:e})`,
        `e(T,{children:"Save",_hash:'${list}.9'})`,
        `t({ "$_hash": "${other}" })`,
        `t({$_hash:"${list}.2"})`,
        // A call site that reads the unsplit file by its hash
        `msg({$_hash:"${SAVE_TEXT}"})\`Save\``,
        // An id that is not a call site option, of no message, or of no list
        `var ids={save:"${list}.3"}`,
        `t({$_hash:"${list}.11"})`,
        't({$_hash:"AAAAAAAA.0"})',
        `t({$_hash:"${list}0"})`,
      ].join(';');
      const found = [`${list}.2`, `${list}.9`, `${list}.10`];
      expect(findChunkIds(code, ids)).toEqual(
        list < other ? [...found, other] : [other, ...found]
      );
      expect(
        findChunkHashes(code, new Set([...hashes, SAVE_TEXT]), ids)
      ).toEqual([hashes[2], hashes[9], hashes[10], SAVE_TEXT].sort());
    });

    const SOURCE = `import { jsx } from 'react/jsx-runtime';
import { initializeGTSPA, T, msg, t } from 'gt-react';
export const ready = initializeGTSPA({});
export const save = () => t\`Save\`;
export const hello = (name) => t\`Hello, \${{ name }}!\`;
export const label = () => t({ context: 'button' })\`Save\`;
export const notice = msg\`Maintenance tonight\`;
export const again = msg\`Save\`;
export const Shared = () => jsx(T, { children: 'Shared by every route' });
export const Spread = (props) => jsx(T, { ...props, children: 'Spread over' });
export const Written = () => jsx(T, { _hash: '0123456789abcdef', children: 'Written by hand' });`;

    it.each([
      ['calls with a precomputed message', true],
      ['tagged templates', false],
    ])(
      'writes a placeholder at the call sites the build splits, written as %s, and keys the files of chunks by the ids their chunk is rendered with',
      async (_name, precomputeMessages) => {
        const off = (await transform(SOURCE, { ...ON, precomputeMessages }))!;
        // The t templates and the <T> without a hash of its own
        const split = [
          SAVE_TEXT,
          HELLO,
          '3638c6269a914b05',
          '0a9725453707110e',
        ];
        // What reads the unsplit file: the first msg, and the <T> whose
        // props could carry another hash
        const notice = 'd186602f8b37cd9e';
        const spread = '8a745136bd12b483';

        const options = { ...MINIFIED, precomputeMessages };
        const translations = Object.fromEntries(
          [...split, notice, spread, '0123456789abcdef', PRINT_TEXT].map(
            (hash) => [hash, `fr ${hash}`]
          )
        );
        const created = createPlugins(options, 'vite', {
          'translations/fr.json': JSON.stringify(translations),
        });
        const on = (await transform(SOURCE, options, created))!;
        // Only the hash of a call site that reads a chunk's file changes,
        // and not where the second msg passes the hash of a t template,
        // and the name the entry is imported by
        expect(on).toBe(
          split.reduce(
            (code, hash) =>
              code.replace(`"${hash}"`, `"${createIdPlaceholder(hash)}"`),
            off.replace(
              'initializeChunkTranslations',
              'initializeMinifiedChunkTranslations'
            )
          )
        );
        const ids = minifyHashes(split);
        const { emitted, rendered } = writeBundle(
          created.plugins[0].vite as Vite,
          { 'assets/index.js': { code: on, isEntry: true } }
        );
        expect(
          rendered['assets/index.js'].code.match(/_hash: ["'][\w.-]+["']/g)
        ).toEqual([
          `_hash: "${ids.get(SAVE_TEXT)}"`,
          `_hash: "${ids.get(HELLO)}"`,
          `_hash: "${ids.get('3638c6269a914b05')}"`,
          `_hash: "${notice}"`,
          `_hash: "${SAVE_TEXT}"`,
          `_hash: "${ids.get('0a9725453707110e')}"`,
          `_hash: "${spread}"`,
          "_hash: '0123456789abcdef'",
        ]);
        expect(unpack(JSON.parse(emitted['assets/index.fr']).t)).toEqual(
          Object.fromEntries(split.map((hash) => [ids.get(hash), `fr ${hash}`]))
        );
        // A message a t template and a msg share is in both files
        expect(JSON.parse(emitted['assets/gt-unsplit.fr'])).toEqual(
          Object.fromEntries(
            [notice, spread, '0123456789abcdef', PRINT_TEXT, SAVE_TEXT].map(
              (hash) => [hash, `fr ${hash}`]
            )
          )
        );
      }
    );

    it('writes a placeholder at a template that stays tagged in a build that precomputes messages', async () => {
      // One name for two values: the call could not pass both
      const source = `import { t } from 'gt-react';
export const save = () => t\`Save\`;
export const pair = (a, b) => t\`\${{ name: a }} and \${{ name: b }}\`;`;
      const off = (await transform(source, {
        ...ON,
        precomputeMessages: true,
      }))!;
      expect(off).toContain(`t({ $_hash: "${SAVE_TEXT}", $_tree: "Save" })`);
      const [, hash] = /t\(\{ \$_hash: "([0-9a-f]{16})" \}\)`/.exec(off)!;
      expect(
        await transform(source, { ...MINIFIED, precomputeMessages: true })
      ).toBe(
        off
          .replace(SAVE_TEXT, createIdPlaceholder(SAVE_TEXT))
          .replace(hash, createIdPlaceholder(hash))
      );
    });

    it('leaves a dev build alone, which runtime translation reads hashes from', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(await transform(SOURCE, MINIFIED)).toBe(
        await transform(SOURCE, ON)
      );
    });

    it('keeps every compiled message that a template hashed at runtime can read in the unsplit file, and names the modules that say nothing of it', async () => {
      // t`Total: ${1 + 1}`, whose value is a primitive wherever it is written
      const TOTAL = '52008f74e891635c';
      // t({ context: 'button' })`Save`
      const SAVE_BUTTON = '3638c6269a914b05';
      const split = {
        [SAVE_TEXT]: 'Enregistrer',
        [SAVE_BUTTON]: 'Sauvegarder',
        [HELLO]: ['Bonjour, ', ['name'], ' !'],
        [TOTAL]: ['Total : ', ['_gt_1']],
      };
      const translations = { ...split, [PRINT_TEXT]: 'Imprimer' };
      const created = createPlugins(MINIFIED, 'vite', {
        'translations/fr.json': JSON.stringify(translations),
      });
      const compiled = (await transform(
        `import { derive, t } from 'gt-react';
export const helloTo = (who) => t\`Hello, \${who}!\`;
export const save = () => t\`Save\`;
export const saveButton = () => t({ context: 'button' })\`Save\`;
export const hello = (name) => t\`Hello, \${{ name }}!\`;
export const print = () => t\`Print\`;
export const total = () => t\`Total: \${1 + 1}\`;
export const saveWith = (options) => t(options)\`Save\`;
export const totalOf = (count) => t\`Total: \${count}\`;
export const totalBy = (count) => t\`Total: \${format(count)}\`;
export const derived = () => t\`Hello, \${derive(getName())}\`;`,
        MINIFIED,
        created
      ))!;
      // Left to the runtime, which hashes what the options and the values
      // turn out to be: a value can be a primitive or a { name: value }
      expect(compiled).toContain('t`Hello, ${who}!`');
      expect(compiled).toContain('t(options)`Save`');
      expect(compiled).toContain('t`Total: ${count}`');
      expect(compiled).toContain('t`Total: ${format(count)}`');
      const { emitted } = writeBundle(created.plugins[0].vite as Vite, {
        'assets/index.js': { code: compiled, isEntry: true },
      });
      // The compiled call sites read the entry's file by their ids
      const ids = minifyHashes(Object.keys(translations));
      expect(unpack(JSON.parse(emitted['assets/index.fr']).t)).toEqual(
        Object.fromEntries(
          Object.entries(translations).map(([hash, translation]) => [
            ids.get(hash),
            translation,
          ])
        )
      );
      // And the ones hashed at runtime read the unsplit file by hash: every
      // compiled message with their text, whatever its options and the
      // names of its values, and not the message none of them can build
      expect(JSON.parse(emitted['assets/gt-unsplit.fr'])).toEqual(split);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Hash minification cannot tell which messages a module reads by a hash computed when the app runs'
        )
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Details: App.jsx.')
      );
    });

    it('gives trees that differ only in the names of their values one shape', () => {
      const plural = (name: string) =>
        JSON.parse(
          JSON.stringify([
            'You have ',
            [name, 'plural', { one: [0, ' file of ', [name]], other: 'files' }],
            ['when', 'date', 'short'],
          ])
        );
      expect(getMessageShape(plural('count'))).toBe(
        getMessageShape(plural('_gt_1'))
      );
      expect(getMessageShape(plural('count'))).toBe(
        '["You have ",["","plural",{"one":[0," file of ",[""]],"other":"files"}],["","date","short"]]'
      );
      expect(getMessageShape('Save')).toBe('"Save"');
      expect(getMessageShape(['Save ', ['name']])).not.toBe(
        getMessageShape(['Save ', ['name', 'number']])
      );
    });

    describe('a translations file', () => {
      // t({ context: 'button' })`Save`, which is translated as t`Save` is
      const SAVE_BUTTON = '3638c6269a914b05';
      const GREETING = ['Bonjour, ', ['name'], ' !'];
      const CATALOG = {
        [SAVE_BUTTON]: 'Enregistrer',
        [PRINT_TEXT]: 'Imprimer',
        [SAVE_TEXT]: 'Enregistrer',
        [HELLO]: GREETING,
      };
      /** The ids of two chunks: one reads all four messages, one two of them. */
      const minify = () => {
        const minified = minifiedIds();
        minifyChunk(Object.keys(CATALOG).map(site).join(';'), minified);
        minifyChunk(`${site(SAVE_TEXT)};${site(HELLO)}`, minified);
        return minified;
      };

      it('holds each translation once, and for the list of each chunk the runs of places that read it', () => {
        const minified = minify();
        expect([...minified.hashes]).toEqual([
          ['pymb1UPk.0', SAVE_BUTTON],
          ['pymb1UPk.1', PRINT_TEXT],
          ['pymb1UPk.2', SAVE_TEXT],
          ['pymb1UPk.3', HELLO],
          ['2bFNA3qJ.0', SAVE_TEXT],
          ['2bFNA3qJ.1', HELLO],
        ]);
        const ids = [...minified.hashes.keys()];
        // A run is a place in the list, the place of its translation in the
        // file, and how many follow on from both: it ends where either stops
        expect(pickMinifiedTranslations(CATALOG, ids, minified)).toEqual([
          ['Enregistrer', GREETING, 'Imprimer'],
          { '2bFNA3qJ': [0, 0, 2], pymb1UPk: [0, 0, 1, 1, 2, 1, 2, 0, 2] },
        ]);
        expect(
          unpack(pickMinifiedTranslations(CATALOG, ids, minified))
        ).toEqual({
          'pymb1UPk.0': 'Enregistrer',
          'pymb1UPk.1': 'Imprimer',
          'pymb1UPk.2': 'Enregistrer',
          'pymb1UPk.3': GREETING,
          '2bFNA3qJ.0': 'Enregistrer',
          '2bFNA3qJ.1': GREETING,
        });
      });

      it('leaves out a message the locale does not translate, an id of no message and an id it is not given', () => {
        const minified = minify();
        expect(
          pickMinifiedTranslations(
            { ...CATALOG, [PRINT_TEXT]: null, [SAVE_TEXT]: undefined },
            [
              'pymb1UPk.3',
              'pymb1UPk.0',
              'pymb1UPk.1',
              'pymb1UPk.2',
              'Zz9_none.0',
            ],
            minified
          )
        ).toEqual([
          ['Enregistrer', GREETING],
          { pymb1UPk: [0, 0, 1, 3, 1, 1] },
        ]);
        expect(pickMinifiedTranslations(CATALOG, [], minified)).toEqual([
          [],
          {},
        ]);
      });

      it('never holds the same translation twice, and reads back as one entry per id', () => {
        // 40 messages of 7 translations in 3 chunks that share half of them
        const hashes = Array.from({ length: 40 }, (_, place) =>
          (place * 2654435761).toString(16).padStart(16, '0').slice(-16)
        );
        const catalog = Object.fromEntries(
          hashes.map((hash, place) => [hash, [`Texte ${place % 7}`]])
        );
        const minified = minifiedIds();
        const chunks = [hashes.slice(0, 25), hashes.slice(10, 40), hashes];
        for (const chunk of chunks) {
          minifyChunk(chunk.map(site).join(';'), minified);
        }
        const [held, lists] = pickMinifiedTranslations(
          catalog,
          [...minified.hashes.keys()],
          minified
        );
        expect(
          held.map((translation) => JSON.stringify(translation)).sort()
        ).toEqual(
          Array.from({ length: 7 }, (_, place) => `["Texte ${place}"]`)
        );
        expect(Object.keys(lists)).toHaveLength(3);
        expect(unpack([held, lists])).toEqual(
          Object.fromEntries(
            [...minified.hashes].map(([id, hash]) => [id, catalog[hash]])
          )
        );
      });
    });

    it("gives a message that two chunks read an id in each, and each chunk's file the ids of its own call sites", async () => {
      const created = createPlugins(MINIFIED, 'vite', {
        'translations/fr.json': JSON.stringify({
          [SAVE_TEXT]: 'Enregistrer',
          [HELLO]: 'Bonjour',
        }),
      });
      const { emitted } = writeBundle(created.plugins[0].vite as Vite, {
        'assets/index.js': {
          code: site(SAVE_TEXT),
          isEntry: true,
          dynamicImports: ['assets/Home.js'],
        },
        'assets/Home.js': { code: `${site(HELLO)};${site(SAVE_TEXT)}` },
      });
      expect(JSON.parse(emitted['assets/index.fr']).t).toEqual([
        ['Enregistrer'],
        { [getListName([SAVE_TEXT])]: [0, 0, 1] },
      ]);
      // The entry's file holds the message for another id, so the route's
      // file does not leave it out
      expect(emitted['assets/Home.fr']).toBe(
        JSON.stringify([
          ['Enregistrer', 'Bonjour'],
          { [getListName([SAVE_TEXT, HELLO])]: [0, 0, 2] },
        ])
      );
    });

    it.each(chunkTranslationsNamings)(
      'gives a page of one build, in the files of the next build named by %s, the message of its own id or nothing',
      (naming) => {
        const options = {
          ...MINIFIED,
          experimentalSplitTranslations: { minifyHashes: true, naming },
        };
        /** A build of two chunks, and each id its call sites pass with its hash. */
        const build = (home: string[], catalog: Record<string, string>) => {
          const created = createPlugins(options, 'vite', {
            'translations/fr.json': JSON.stringify(catalog),
          });
          const { emitted } = writeBundle(created.plugins[0].vite as Vite, {
            'assets/index.js': {
              code: site(SAVE_TEXT),
              isEntry: true,
              dynamicImports: ['assets/Home.js'],
            },
            'assets/Home.js': { code: home.map(site).join(';') },
          });
          return {
            files: readTranslationFiles(emitted),
            ids: new Map(
              [[SAVE_TEXT], home].flatMap((hashes) =>
                [...minifyHashes(hashes)].map(([hash, id]) => [id, hash])
              )
            ),
          };
        };
        const page = build([HELLO, SAVE_TEXT], {
          [SAVE_TEXT]: 'Enregistrer',
          [HELLO]: 'Bonjour',
        });
        // The deploy added a message to the route and changed a translation
        const next = {
          [SAVE_TEXT]: 'Sauvegarder',
          [HELLO]: 'Bonjour',
          [PRINT_TEXT]: 'Imprimer',
        };
        const deployed = build([HELLO, SAVE_TEXT, PRINT_TEXT], next);
        const [entryId] = idsOf([SAVE_TEXT]);
        // The entry chunk is as it was and reads its message as it is now;
        // the route's ids are in no file of that build
        expect(readAsPage(page.ids, deployed.files)).toEqual(
          new Map(
            [...page.ids.keys()].map((id) => [
              id,
              id === entryId ? 'Sauvegarder' : undefined,
            ])
          )
        );
        // And a page of the build that is served reads every message
        expect(readAsPage(deployed.ids, deployed.files)).toEqual(
          new Map(
            [...deployed.ids].map(([id, hash]) => [
              id,
              next[hash as keyof typeof next],
            ])
          )
        );
      }
    );

    it("assigns alike, for a page that reads the files of another build, only where no chunk's messages changed", () => {
      const assign = (home: string[]) =>
        getAssignmentHash(
          assignTranslationsByChunk([
            {
              fileName: 'assets/index.js',
              hashes: idsOf([SAVE_TEXT]),
              imports: [],
              dynamicImports: ['assets/Home.js'],
              isEntry: true,
            },
            {
              fileName: 'assets/Home.js',
              hashes: idsOf(home),
              imports: [],
              dynamicImports: [],
              isEntry: false,
            },
          ])
        );
      expect(assign([HELLO])).toBe(assign([HELLO]));
      expect(assign([HELLO, PRINT_TEXT])).not.toBe(assign([HELLO]));
      expect(assign([PRINT_TEXT])).not.toBe(assign([HELLO]));
    });
  });

  describe('the source maps of the chunks a build rewrites', () => {
    const MINIFIED: GTUnpluginOptions = {
      ...ON,
      experimentalSplitTranslations: { minifyHashes: true },
    };
    const P = IMPORTED_CHUNKS_PLACEHOLDER;
    // t`Save` and t`Print`
    const SAVE_TEXT = 'ab72d114d0d156a9';
    const PRINT_TEXT = 'aae8cb2668d0cb74';
    // A chunk as a bundler renders it, with each rewrite of the build before
    // other code on its line: two call sites, a dynamic import that Vite
    // preloads, and the call that starts the app
    const RENDERED = [
      `const labels = [t({$_hash:"${createIdPlaceholder(SAVE_TEXT)}"})\`Save\`, t({$_hash:"${createIdPlaceholder(PRINT_TEXT)}"})\`Print\`]; report(labels);`,
      `const Home = load(() => __vitePreload(() => import("./Home.js"), __VITE_PRELOAD__), "${P}"); mount(Home);`,
      `initialize(initializeGTSPA, config, "${UNSPLIT_LOADER_PLACEHOLDER}"); start();`,
    ].join('\n');
    type Rendered = string | { code: string; map: unknown } | null;
    type Vite = {
      configResolved: (config: object) => void;
      renderChunk: (code: string, chunk?: object, options?: object) => Rendered;
    };

    it.each([
      ['with unsplit translations', true],
      ['without unsplit translations', false],
    ])(
      'returns the map of what renderChunk replaced, %s',
      async (_name, unsplit) => {
        const created = createPlugins(MINIFIED, 'vite', {
          'translations/fr.json': JSON.stringify({
            [SAVE_TEXT]: 'Enregistrer',
          }),
        });
        // A msg is rendered away from its chunk, so its translation is unsplit
        await transform(
          `import { ${unsplit ? 'msg' : 't'} } from 'gt-react';\nexport const saved = ${unsplit ? 'msg' : 't'}\`Save\`;`,
          MINIFIED,
          created
        );
        const vite = created.plugins[0].vite as Vite;
        vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });
        const chunk = { fileName: 'assets/index.js' };

        const code = vite.renderChunk(RENDERED, chunk, { sourcemap: false });
        expect(code).toContain(
          unsplit ? 'loadTranslations: (locale) =>' : 'initializeGTSPA, config)'
        );
        expect(code).toContain(`import("./Home.js"), "${P}", __vitePreload,`);
        expect(code).not.toContain(createIdPlaceholder(''));

        const mapped = vite.renderChunk(RENDERED, chunk, { sourcemap: true });
        expect(mapped).toEqual({ code, map: expect.anything() });
        const { map } = mapped as { map: unknown };
        for (const token of ['report', 'mount', 'start', 'Print']) {
          expect(trace(map, code as string, token), token).toEqual({
            source: 'assets/index.js',
            ...locate(RENDERED, token),
          });
        }
      }
    );

    it('follows rewrites that replace in what the one before returned', () => {
      const code = 'one(A); two(B);\nthree(A); four(C); five();';
      const tracked = trackReplacements(code);
      const first = tracked.replace(code, /A/g, () => 'longer');
      const second = tracked.replace(first, /\((B|C)\)/g, (_match, name) =>
        name === 'B' ? '()' : '(\n)'
      );
      expect(second).toBe(
        'one(longer); two();\nthree(longer); four(\n); five();'
      );
      // Only what differs: not the brackets of the second rewrite
      expect(tracked.replacements).toEqual([
        { start: 4, end: 5, content: 'longer' },
        { start: 12, end: 13, content: '' },
        { start: 22, end: 23, content: 'longer' },
        { start: 31, end: 32, content: '\n' },
      ]);
      const map = generateReplacementsMap(
        code,
        'chunk.js',
        tracked.replacements!
      );
      for (const token of ['two', 'three', 'four', 'five']) {
        expect(trace(map, second, token), token).toEqual({
          source: 'chunk.js',
          ...locate(code, token),
        });
      }
    });

    it.each<[name: string, run: (code: string) => unknown]>([
      [
        'nothing was replaced',
        (code) => trackReplacements(code).replace(code, /Z/g, () => 'z'),
      ],
      [
        'a rewrite replaced in what an earlier one wrote',
        (code) => {
          const tracked = trackReplacements(code);
          const first = tracked.replace(code, /A/g, () => 'longer');
          tracked.replace(first, /\(long/g, () => '(');
          return tracked.replacements;
        },
      ],
      [
        'a rewrite replaced in other code than the last one returned',
        (code) => {
          const tracked = trackReplacements(code);
          tracked.replace(code, /A/g, () => 'longer');
          tracked.replace(code, /B/g, () => 'b');
          return tracked.replacements;
        },
      ],
    ])('has no replacements to map when %s', (name, run) => {
      const code = 'one(A); two(B);';
      const result = run(code);
      expect(result).toBe(name === 'nothing was replaced' ? code : undefined);
    });

    it('moves the positions of a map with what was replaced in its code', () => {
      const code =
        'one("X"); two("X");\nthree(); four("X"); five(); six(BB); seven();';
      const tracked = trackReplacements(code);
      const replaced = tracked.replace(code, /"X"|three\(\); |BB/g, (match) =>
        match === '"X"' ? '0' : match === 'BB' ? '' : 'three(\n);\n'
      );
      // Every character maps to itself
      const before = new MagicString(code).generateMap({
        hires: true,
        source: 'chunk.js',
      });
      const moved = {
        ...before,
        mappings: moveMappings(before.mappings, code, tracked.replacements!),
      };
      for (const token of ['one', 'two', 'three', 'four', 'five', 'seven']) {
        expect(trace(moved, replaced, token), token).toEqual({
          source: 'chunk.js',
          ...locate(code, token),
        });
      }
      // What follows something deleted keeps its own position, not that of what was deleted
      expect(trace(moved, replaced, '); seven')).toEqual({
        source: 'chunk.js',
        ...locate(code, '); seven'),
      });
      // A position inside what was replaced is where the replacement starts
      expect(trace(moved, replaced, '0); two')).toEqual({
        source: 'chunk.js',
        ...locate(code, '"X"); two'),
      });
      expect(moved.mappings.split(';')).toHaveLength(4);
    });

    it.each(['a map file', 'an inline map'])(
      'moves the map of a chunk whose imports generateBundle names, in %s',
      async (kept) => {
        const created = createPlugins(ON, 'vite', {
          'translations/fr.json': JSON.stringify({
            [SAVE_TEXT]: 'Enregistrer',
          }),
        });
        await transform(
          `import { t } from 'gt-react';\nexport const save = () => t\`Save\`;`,
          ON,
          created
        );
        const [first, second] = created.plugins as unknown as {
          vite: {
            configResolved: (config: object) => void;
            generateBundle: unknown;
          };
        }[];
        first.vite.configResolved({
          base: '/',
          build: { assetsDir: 'assets' },
        });
        // Minified: the chunk is one line, so what follows an import moves
        const code = `e(()=>import("./Orders.js"),"${P}");mount();e(()=>import("./versions.js"),"${P}");start()`;
        // Every character maps to itself
        const map = new MagicString(code).generateMap({
          hires: true,
          source: 'src/App.tsx',
        });
        const inline = kept === 'an inline map';
        const comment =
          '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,';
        const index = {
          type: 'chunk',
          fileName: 'assets/index.js',
          code: inline ? `${code}${comment}${btoa(map.toString())}` : code,
          map,
          sourcemapFileName: inline ? null : 'assets/index.js.map',
          imports: [],
          dynamicImports: ['assets/Orders.js', 'assets/versions.js'],
          isEntry: true,
        };
        const mapFile = {
          type: 'asset',
          fileName: 'assets/index.js.map',
          source: map.toString(),
        };
        const bundle = {
          'assets/index.js': index,
          ...(!inline && { 'assets/index.js.map': mapFile }),
          'assets/Orders.js': {
            type: 'chunk',
            fileName: 'assets/Orders.js',
            code: `t({$_hash:"${SAVE_TEXT}"})\`Save\``,
            imports: [],
            dynamicImports: [],
          },
          'assets/versions.js': {
            type: 'chunk',
            fileName: 'assets/versions.js',
            code: 'export const version = 1',
            imports: [],
            dynamicImports: [],
          },
        };
        (
          first.vite.generateBundle as (
            this: object,
            options: object,
            bundle: object
          ) => void
        ).call({ emitFile: () => undefined }, {}, bundle);
        (
          second.vite.generateBundle as {
            handler: (options: object, bundle: object) => void;
          }
        ).handler({}, bundle);

        const named = `e(()=>import("./Orders.js"),"assets/Orders.js");mount();e(()=>import("./versions.js"),0);start()`;
        expect(index.code.split('\n')[0]).toBe(named);
        for (const token of ['mount', 'start', './versions.js', 'Orders']) {
          expect(trace(index.map, named, token), token).toEqual({
            source: 'src/App.tsx',
            ...locate(code, token),
          });
        }
        const written = inline
          ? atob(index.code.slice(named.length + comment.length))
          : mapFile.source;
        expect(JSON.parse(written)).toEqual(JSON.parse(index.map.toString()));
        expect(JSON.parse(written).mappings).toBe(index.map.mappings);
      }
    );
  });

  describe('split by module', () => {
    const SPLIT: GTUnpluginOptions = {
      ...ON,
      experimentalSplitTranslations: { by: 'module' },
    };

    it.each([
      [undefined, undefined, 'chunk'],
      [undefined, 'module', 'module'],
      ['chunk', 'module', 'chunk'],
      ['module', undefined, 'module'],
    ] as const)(
      'is chosen by the option %s, then GT_SPLIT_TRANSLATIONS_BY=%s: %s',
      (option, env, expected) => {
        vi.stubEnv('GT_SPLIT_TRANSLATIONS_BY', env as never);
        expect(getChunkTranslationsSplit(option)).toBe(expected);
      }
    );

    it('rejects a split it does not have', () => {
      vi.stubEnv('GT_SPLIT_TRANSLATIONS_BY', 'route');
      expect(() => getChunkTranslationsSplit(undefined)).toThrow(
        'The split of chunk translations is set to "route", which is not one of chunk, module. Set experimentalSplitTranslations.by or GT_SPLIT_TRANSLATIONS_BY to one of them.'
      );
    });

    it('names its files by map, and fails a build that asks for tokens', () => {
      expect(getChunkTranslationsNaming(undefined, 'module')).toBe('map');
      expect(getChunkTranslationsNaming('map', 'module')).toBe('map');
      expect(() => getChunkTranslationsNaming('token', 'module')).toThrow(
        'Chunk translations that are split by module cannot be named by token'
      );
      expect(() =>
        createPlugins({
          ...ON,
          experimentalSplitTranslations: { by: 'module', naming: 'token' },
        })
      ).toThrow(
        'cannot be named by token because a file then holds the messages of modules from many chunks, so its URL does not follow from the URL of a chunk. Set experimentalSplitTranslations.naming to map, or leave it out.'
      );
    });

    it.each([
      [undefined, undefined, 8192, undefined],
      [0, 'a.json', 0, 'a.json'],
      [2048, undefined, 2048, undefined],
      [4096, '', 4096, undefined],
      // Not a number, as an untyped config can write: the cost left out
      [null as never, 'b.json', 8192, 'b.json'],
    ])(
      'takes the request cost %s and the previous manifest %s',
      (cost, file, requestCost, previous) => {
        const options = { requestCost: cost, previous: file };
        expect(getRegionSplit('module', options)).toEqual({
          requestCost,
          previous,
        });
        expect(getRegionSplit('chunk', options)).toBeUndefined();
      }
    );

    it.each([-1, Number.NaN, 'much' as never, '4096' as never, '' as never])(
      'rejects the request cost %j',
      (requestCost) => {
        expect(() =>
          getRegionSplit('module', { requestCost, previous: undefined })
        ).toThrow(
          `The request cost of chunk translations is set to "${requestCost}", which is not a number of bytes. Set experimentalSplitTranslations.requestCost to zero or more bytes, or leave it out for 8192.`
        );
      }
    );

    it('compiles the app to read the map for what an import needs, and nothing else differently', async () => {
      const compiled = await transform(MODULE, SPLIT);
      expect(compiled).toContain(
        'initializeRegionChunkTranslations as __gt_chunk_initialize'
      );
      expect(
        compiled!.replace(
          'initializeRegionChunkTranslations',
          'initializeChunkTranslations'
        )
      ).toBe(await transform(MODULE));
      expect(
        wrapDynamicImports(`import('./a.js');`, '/a.js', 'map', true)?.code
      ).toBe(
        `import { loadRegionChunk as __gt_chunk_load } from "gt-react/chunk-translations";__gt_chunk_load(() => import('./a.js'), "__GT_CHUNK_TRANSLATIONS_IMPORT__");`
      );
      // It keeps what the bundler's options say about when a module runs
      expect(Object.keys(createPlugins(SPLIT).plugins[0].vite ?? {})).toEqual([
        'configResolved',
        'options',
        'outputOptions',
        'renderChunk',
        'generateBundle',
        'transformIndexHtml',
      ]);
    });

    const FR = {
      title: 'Titre',
      home: 'Accueil',
      picker: 'Date',
      invoice: 'Facture',
    };
    const renderRegions = (fr: Record<string, unknown> = FR) =>
      renderRegionTranslations(
        {
          files: new Map([
            ['aa', ['title']],
            ['bb', ['home', 'picker']],
            ['cc', ['invoice']],
          ]),
          entries: new Map([['assets/index.js', ['aa']]]),
          imports: new Map([
            ['assets/Home.js', ['aa', 'bb']],
            ['assets/Billing.js', ['aa', 'cc']],
          ]),
        },
        { defaultLocale: 'en', locales: ['fr', 'de'] },
        { fr, de: { home: 'Start' } },
        {
          base: '/',
          assetsDir: 'assets',
          samples: [[100, 60]],
          unsplit: { fr: { msg: 'Message' } },
        }
      );

    it("writes each file once per locale that translates it, the locale's map of what each import needs, and the manifest", () => {
      const { files, manifest, unsplit } = renderRegions();
      expect(
        Object.fromEntries(
          files.map(({ fileName, source }) => [fileName, JSON.parse(source)])
        )
      ).toEqual({
        'assets/gt-unsplit.fr.9ddbca58.json': { msg: 'Message' },
        'assets/gt-aa.fr.d7a4dbef.json': { title: 'Titre' },
        'assets/gt-bb.fr.ff88a5f0.json': { home: 'Accueil', picker: 'Date' },
        'assets/gt-cc.fr.e29516b9.json': { invoice: 'Facture' },
        // The files every import needs first, then the imported chunks
        'assets/gt-map.fr.df659cf2.json': {
          i: {
            k: [
              'assets/gt-aa',
              'assets/gt-bb',
              'assets/gt-cc',
              'assets/Billing',
              'assets/Home',
            ],
            c: [0, 0, 0, [0, 0, 1, 2, 1], [0, 0, 2]],
            h: ['d7a4dbef', 'ff88a5f0', 'e29516b9'],
          },
        },
        // de translates one message: its other files are not written
        'assets/gt-bb.de.94ca6839.json': { home: 'Start' },
        'assets/gt-map.de.aae53460.json': {
          i: {
            k: [
              'assets/gt-aa',
              'assets/gt-bb',
              'assets/gt-cc',
              'assets/Billing',
              'assets/Home',
            ],
            c: [0, 0, 0, [0, 0, 1, 2, 1], [0, 0, 2]],
            h: [0, '94ca6839', 0],
          },
        },
        // The hash in the name of each map, under a name every build has
        'assets/gt-current.json': { v: { fr: 'df659cf2', de: 'aae53460' } },
      });
      expect(unsplit).toEqual([{ locale: 'fr', count: 1, bytes: 17 }]);
      const { startupScript, ...entry } = manifest.entries['assets/index.js'];
      expect({ ...manifest, entries: { 'assets/index.js': entry } }).toEqual({
        split: 'module',
        defaultLocale: 'en',
        locales: ['fr', 'de'],
        entries: { 'assets/index.js': { files: ['assets/gt-aa'] } },
        files: {
          'assets/gt-aa': { fr: 'assets/gt-aa.fr.d7a4dbef.json' },
          'assets/gt-bb': {
            fr: 'assets/gt-bb.fr.ff88a5f0.json',
            de: 'assets/gt-bb.de.94ca6839.json',
          },
          'assets/gt-cc': { fr: 'assets/gt-cc.fr.e29516b9.json' },
        },
        imports: {
          'assets/Home.js': ['assets/gt-aa', 'assets/gt-bb'],
          'assets/Billing.js': ['assets/gt-aa', 'assets/gt-cc'],
        },
        maps: {
          fr: 'assets/gt-map.fr.df659cf2.json',
          de: 'assets/gt-map.de.aae53460.json',
        },
        current: 'assets/gt-current.json',
        unsplit: { fr: 'assets/gt-unsplit.fr.9ddbca58.json' },
        assignment: {
          files: { aa: ['title'], bb: ['home', 'picker'], cc: ['invoice'] },
          samples: [[100, 60]],
        },
      } satisfies Omit<RegionTranslationsManifest, 'entries'> & {
        entries: object;
      });
      // The page holds the name of the map and of the entry's files
      expect(startupScript).toContain(
        '"f":"assets/gt-map","h":{"fr":"df659cf2","de":"aae53460"},"v":{},"n":"assets/gt-current"}'
      );
      expect(startupScript).toContain(
        '(window["__GT_CHUNK_TRANSLATIONS__"],{"fr":{"assets/gt-aa":"d7a4dbef"},"de":{}});'
      );
      expect(startupScript).toContain('"assets/gt-unsplit",{"fr":"9ddbca58"}');
      expect(startupScript).not.toContain('startMappedTranslations');
      expect(startupScript).not.toContain('startPreloadedTranslations');
    });

    it('renames only the file a translation is in, and the map', () => {
      const names = (fr: Record<string, unknown>) =>
        renderRegions(fr)
          .files.map(({ fileName }) => fileName)
          .sort();
      const before = names(FR);
      expect(
        names({ ...FR, home: 'Maison' }).filter(
          (name) => !before.includes(name)
        )
      ).toEqual([
        expect.stringMatching(/^assets\/gt-bb\.fr\./),
        expect.stringMatching(/^assets\/gt-map\.fr\./),
      ]);
    });

    it('fails a build whose chunk would share a key with a file', () => {
      expect(() =>
        renderRegionTranslations(
          {
            files: new Map([['aa', ['title']]]),
            entries: new Map(),
            imports: new Map([['assets/gt-aa.js', ['aa']]]),
          },
          { defaultLocale: 'en', locales: ['fr'] },
          { fr: FR },
          { base: '/', assetsDir: 'assets', samples: [], unsplit: {} }
        )
      ).toThrow('A translations file and a chunk would share the key');
    });

    it('lists an imported chunk under the names its imports are written with too, which cannot share a key with a file either', () => {
      const render = (name: string) =>
        renderRegionTranslations(
          {
            files: new Map([['aa', ['title']]]),
            entries: new Map(),
            imports: new Map([['assets/Home-file.js', ['aa']]]),
            importedNames: new Map([[name, 'assets/Home-file.js']]),
          },
          { defaultLocale: 'en', locales: ['fr'] },
          { fr: FR },
          { base: '/', assetsDir: 'assets', samples: [], unsplit: {} }
        );
      const { files, manifest } = render('assets/Home-name.js');
      // A page preloads the chunk by its file and imports it by its name
      expect(
        JSON.parse(
          files.find(({ fileName }) => fileName === manifest.maps.fr)!.source
        ).i
      ).toEqual({
        k: ['assets/gt-aa', 'assets/Home-file', 'assets/Home-name'],
        c: [0, [0, 0, 1], [0, 0, 1]],
        h: ['d7a4dbef'],
      });
      expect(manifest.imports).toEqual({
        'assets/Home-file.js': ['assets/gt-aa'],
      });
      expect(() => render('assets/gt-aa.js')).toThrow(
        'A translations file and a chunk would share the key assets/gt-aa'
      );
    });

    // A shared chunk holds a date picker that Home uses, an invoice table
    // that only Billing uses and a panel that only Admin uses.
    const HASH = {
      title: '1000000000000001',
      home: '2000000000000002',
      billing: '3000000000000003',
      admin: '4000000000000004',
      picker: '5000000000000005',
      invoice: '6000000000000006',
      panel: '7000000000000007',
    };
    // A call site as a bundler prints it, where findChunkHashes reads its hash
    const callSite = (hash: string) => `t({$_hash:"${hash}"})`;
    // And as a precomputed message, without and with values
    const CALL_SITES = [
      callSite,
      (hash: string) => `t({$_hash:"${hash}",$_tree:"Title"})`,
      (hash: string) =>
        `t({$_hash:"${hash}",$_tree:["Title ",["name"]]},{name})`,
    ];
    const NAMES = Object.keys(HASH);
    const site = (...names: (keyof typeof HASH)[]) =>
      names
        .map((name) =>
          CALL_SITES[NAMES.indexOf(name) % CALL_SITES.length](HASH[name])
        )
        .join(';');
    const chunk = (
      fileName: string,
      modules: Record<string, string>,
      rest: object = {}
    ) => ({
      type: 'chunk',
      fileName,
      code: Object.values(modules).join(';'),
      isEntry: false,
      facadeModuleId: Object.keys(modules)[0],
      imports: [] as string[],
      dynamicImports: [] as string[],
      modules: Object.fromEntries(
        Object.entries(modules).map(([id, code]) => [id, { code }])
      ),
      ...rest,
    });
    const BUNDLE = Object.fromEntries(
      [
        chunk(
          'assets/index.js',
          { '/main.js': site('title') },
          { isEntry: true }
        ),
        chunk(
          'assets/Home.js',
          { '/home.js': site('home') },
          { imports: ['assets/shared.js'] }
        ),
        chunk(
          'assets/Billing.js',
          { '/billing.js': site('billing') },
          { imports: ['assets/shared.js'] }
        ),
        chunk(
          'assets/Admin.js',
          { '/admin.js': site('admin') },
          { imports: ['assets/shared.js'] }
        ),
        chunk(
          'assets/shared.js',
          {
            '/picker.js': site('picker'),
            '/invoice.js': site('invoice'),
            '/panel.js': site('panel'),
          },
          { facadeModuleId: null }
        ),
      ].map((file) => [file.fileName, file])
    );
    const GRAPH: Record<string, { imports?: string[]; dynamic?: string[] }> = {
      '/main.js': { dynamic: ['/home.js', '/billing.js', '/admin.js'] },
      '/home.js': { imports: ['/picker.js'] },
      '/billing.js': { imports: ['/invoice.js'] },
      '/admin.js': { imports: ['/panel.js'] },
    };
    const getModuleInfo =
      (
        graph: typeof GRAPH
      ): Parameters<typeof writeRegionTranslations>[2]['getModuleInfo'] =>
      (id) => ({
        importedIds: graph[id]?.imports ?? [],
        dynamicallyImportedIds: graph[id]?.dynamic ?? [],
      });
    const CATALOG = Object.fromEntries(
      Object.entries(HASH).map(([name, hash]) => [hash, name.toUpperCase()])
    );

    /** Writes the build of BUNDLE, and returns what it emitted by file key. */
    function write({
      isLazy = true,
      requestCost = 0,
      previous,
      graph = GRAPH,
      bundle = BUNDLE,
      cwd = createPlugins(ON, 'vite', {
        'translations/fr.json': JSON.stringify(CATALOG),
      }).cwd,
      minifiedIds,
    }: {
      isLazy?: boolean;
      requestCost?: number;
      previous?: string;
      graph?: typeof GRAPH;
      bundle?: typeof BUNDLE;
      cwd?: string;
      minifiedIds?: MinifiedIds;
    } = {}) {
      const emitted: Record<string, string> = {};
      const written = writeRegionTranslations(
        bundle,
        {
          defaultLocale: 'en',
          locales: ['fr'],
          hashes: new Set(Object.values(HASH)),
          unsplit: new Set(),
          naming: 'map',
          regions: { requestCost, previous },
          ...(minifiedIds && { minifiedIds }),
        },
        {
          gtFiles: GT_FILES.gt,
          base: '/',
          assetsDir: 'assets',
          emitFile: ({ fileName, source }) => (emitted[fileName] = source),
          getModuleInfo: getModuleInfo(graph),
          isLazy,
        }
      );
      const manifest = JSON.parse(
        emitted['assets/gt-chunk-translations.json']
      ) as RegionTranslationsManifest;
      const messagesIn = (keys: string[]) =>
        keys
          .flatMap((key) =>
            Object.values(JSON.parse(emitted[manifest.files[key].fr]))
          )
          .sort();
      /** The messages in the files the import of a chunk needs. */
      const messagesOf = (chunk: string) => messagesIn(manifest.imports[chunk]);
      /** The messages in the files a page holds before any code runs. */
      const messagesOfEntry = (chunk: string) =>
        messagesIn(manifest.entries[chunk].files);
      return { written, emitted, manifest, messagesOf, messagesOfEntry, cwd };
    }

    it('gives a route the translations of the modules it reaches, not of the others in a chunk it loads', () => {
      const { written, manifest, messagesOf } = write();
      expect(messagesOf('assets/Home.js')).toEqual(['HOME', 'PICKER']);
      expect(messagesOf('assets/Billing.js')).toEqual(['BILLING', 'INVOICE']);
      expect(messagesOf('assets/Admin.js')).toEqual(['ADMIN', 'PANEL']);
      // The shared chunk is the target of no import
      expect(Object.keys(manifest.imports)).toEqual([
        'assets/Home.js',
        'assets/Billing.js',
        'assets/Admin.js',
      ]);
      expect(written.imported).toEqual(new Set(Object.keys(manifest.imports)));
      expect(manifest.entries['assets/index.js'].files).toHaveLength(1);
      expect(Object.values(manifest.assignment.files).flat().sort()).toEqual(
        Object.values(HASH)
      );
      expect(written.stats).toMatchObject({
        loads: 4,
        files: 4,
        isConservative: false,
        conservativeMessages: 0,
      });
    });

    it('hands a framework the loader state of each entry, the files each import needs, and the messages of each file as call sites pass them', () => {
      const { written, emitted, manifest } = write();
      const hashOf = (fileName: string) => fileName.split('.').at(-2);
      expect(written.output).toEqual({
        entries: {
          'assets/index.js': {
            state: {
              b: '/',
              f: 'assets/gt-map',
              h: {
                fr: hashOf(
                  Object.keys(emitted).find((name) =>
                    name.startsWith('assets/gt-map.fr.')
                  )!
                ),
              },
              v: {},
              e: {
                fr: {
                  'assets/gt-10000000': hashOf(
                    manifest.files['assets/gt-10000000'].fr
                  ),
                },
              },
              n: 'assets/gt-current',
            },
            messages: [],
            files: ['assets/gt-10000000'],
          },
        },
        imports: {
          'assets/Home.js': ['assets/gt-20000000'],
          'assets/Billing.js': ['assets/gt-30000000'],
          'assets/Admin.js': ['assets/gt-40000000'],
        },
        files: {
          'assets/gt-10000000': [HASH.title],
          'assets/gt-20000000': [HASH.home, HASH.picker],
          'assets/gt-30000000': [HASH.billing, HASH.invoice],
          'assets/gt-40000000': [HASH.admin, HASH.panel],
        },
        unsplit: [],
      });
    });

    it("reads the build's chunk import map from the bundle once, lists a chunk under the name an import is written with and under no other, and returns both", () => {
      createPlugins(ON, 'vite', {
        'translations/fr.json': JSON.stringify(CATALOG),
      });
      const emitted: Record<string, string> = {};
      const index = BUNDLE['assets/index.js'];
      const written = writeRegionTranslations(
        {
          ...BUNDLE,
          'assets/index.js': {
            ...index,
            code: `${index.code};e(()=>import("./Home-name.js"),"${IMPORTED_CHUNKS_PLACEHOLDER}")`,
          },
          'importmap.json': {
            type: 'asset',
            source: JSON.stringify({
              imports: {
                '/assets/Home-name.js': '/assets/Home.js',
                // A name no import is written with
                '/assets/Home-other.js': '/assets/Home.js',
              },
            }),
          } as unknown as (typeof BUNDLE)[string],
        },
        {
          defaultLocale: 'en',
          locales: ['fr'],
          hashes: new Set(Object.values(HASH)),
          unsplit: new Set(),
          importMap: { fileName: 'importmap.json', baseUrl: '/' },
          naming: 'map',
          regions: { requestCost: 0, previous: undefined },
        },
        {
          gtFiles: GT_FILES.gt,
          base: '/',
          assetsDir: 'assets',
          emitFile: ({ fileName, source }) => (emitted[fileName] = source),
          getModuleInfo: getModuleInfo(GRAPH),
          isLazy: true,
        }
      );
      const manifest = JSON.parse(
        emitted['assets/gt-chunk-translations.json']
      ) as RegionTranslationsManifest;
      const lists = JSON.parse(emitted[manifest.maps.fr]).i;
      // Which a page holds once the import of the route has run
      const needed = ['assets/gt-20000000'];
      expect(manifest.imports['assets/Home.js']).toEqual(needed);
      expect(readImportedFiles(lists, 'assets/Home.js')).toEqual(needed);
      expect(readImportedFiles(lists, 'assets/Home-name.js')).toEqual(needed);
      expect(lists.k).not.toContain('assets/Home-other');
      expect(written.importMap).toEqual(
        new Map([
          ['assets/Home-name.js', 'assets/Home.js'],
          ['assets/Home-other.js', 'assets/Home.js'],
        ])
      );
      expect(written.importedNames).toEqual(
        new Map([['assets/Home-name.js', 'assets/Home.js']])
      );
    });

    it('writes at an import the name the page imports the chunk by, which the map of a locale holds, when a plugin rewrites the import map once the map is written', async () => {
      const P = IMPORTED_CHUNKS_PLACEHOLDER;
      const created = createPlugins(
        {
          ...SPLIT,
          experimentalSplitTranslations: { by: 'module', requestCost: 0 },
        },
        'vite',
        { 'translations/fr.json': JSON.stringify(CATALOG) }
      );
      const [first, second] = created.plugins as unknown as {
        vite: {
          configResolved: (config: object) => void;
          options: (options: object) => null;
          generateBundle: unknown;
        };
      }[];
      first.vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });
      second.vite.options({ experimental: { chunkImportMap: true } });
      // The hashes the build knows are those of the modules it compiled
      await transform(MODULE, SPLIT, created);
      // A plugin of the app has chunks import each other by a bare name: the
      // import map has it under the assets directory as the map of a locale
      // is written, and bare by the time the imports are named
      const importMap = (imports: Record<string, string>) => ({
        type: 'asset',
        source: JSON.stringify({ imports }),
      });
      const bundle: Record<string, object> = {
        'assets/index.js': chunk(
          'assets/index.js',
          {
            '/main.js': `${callSite(SAVE)};e(()=>import("r:Home-name.js"),"${P}")`,
          },
          { isEntry: true, dynamicImports: ['assets/Home.js'] }
        ),
        'assets/Home.js': chunk('assets/Home.js', {
          '/home.js': callSite(HELLO),
        }),
        'importmap.json': importMap({
          '/assets/r:Home-name.js': '/assets/Home.js',
          '/assets/Home-name.js': '/assets/Home.js',
        }),
      };
      const emitted: Record<string, string> = {};
      (
        first.vite.generateBundle as (
          this: object,
          options: object,
          bundle: object
        ) => void
      ).call(
        {
          emitFile: (file: { fileName: string; source: string }) =>
            (emitted[file.fileName] = file.source),
          getModuleInfo: getModuleInfo({
            '/main.js': { dynamic: ['/home.js'] },
          }),
        },
        {},
        bundle
      );
      bundle['importmap.json'] = importMap({
        'r:Home-name.js': '/assets/Home.js',
        '/assets/Home-name.js': '/assets/Home.js',
      });
      (
        second.vite.generateBundle as {
          handler: (options: object, bundle: object) => void;
        }
      ).handler({}, bundle);
      expect((bundle['assets/index.js'] as { code: string }).code).toContain(
        'e(()=>import("r:Home-name.js"),"r:Home-name.js")'
      );
      const manifest = JSON.parse(
        emitted['assets/gt-chunk-translations.json']
      ) as RegionTranslationsManifest;
      const lists = JSON.parse(emitted[manifest.maps.fr]).i;
      expect(readImportedFiles(lists, 'r:Home-name.js')).toEqual(
        manifest.imports['assets/Home.js']
      );
      expect(manifest.imports['assets/Home.js']).toHaveLength(1);
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Nothing waits for the translations')
      );
    });

    describe('an import of a module in the chunk of the module that imports it, which the bundler writes without an import()', () => {
      const bundleOf = (...chunks: ReturnType<typeof chunk>[]) =>
        Object.fromEntries(chunks.map((file) => [file.fileName, file]));

      it.each([true, false])(
        'gives its translations to the entry whose chunk holds both, with isLazy %s',
        (isLazy) => {
          const { manifest, messagesOf, messagesOfEntry } = write({
            isLazy,
            bundle: bundleOf(
              chunk(
                'assets/index.js',
                {
                  '/main.js': site('title'),
                  '/home.js': site('home'),
                  '/picker.js': site('picker'),
                },
                { isEntry: true, dynamicImports: ['assets/index.js'] }
              ),
              chunk('assets/Billing.js', { '/billing.js': site('billing') })
            ),
            graph: {
              '/main.js': { dynamic: ['/home.js', '/billing.js'] },
              '/home.js': { imports: ['/picker.js'] },
            },
          });
          // Nothing imports the entry's chunk, so no list of it is ever read
          expect(Object.keys(manifest.imports)).toEqual(['assets/Billing.js']);
          expect(messagesOfEntry('assets/index.js')).toEqual(
            expect.arrayContaining(['HOME', 'PICKER', 'TITLE'])
          );
          expect(messagesOf('assets/Billing.js')).toContain('BILLING');
        }
      );

      it('gives its translations to the import that loads their chunk with another', () => {
        // Home's chunk imports the shared chunk, where a helper imports the
        // panel: only the list of Home's chunk is read when Home loads
        const { manifest, messagesOf } = write({
          bundle: bundleOf(
            chunk(
              'assets/index.js',
              { '/main.js': site('title') },
              { isEntry: true }
            ),
            chunk(
              'assets/Home.js',
              { '/home.js': site('home') },
              { imports: ['assets/shared.js'] }
            ),
            chunk(
              'assets/shared.js',
              { '/picker.js': site('picker'), '/panel.js': site('panel') },
              { facadeModuleId: null, dynamicImports: ['assets/shared.js'] }
            )
          ),
          graph: {
            '/main.js': { dynamic: ['/home.js'] },
            '/home.js': { imports: ['/picker.js'] },
            '/picker.js': { dynamic: ['/panel.js'] },
          },
        });
        expect(Object.keys(manifest.imports)).toEqual(['assets/Home.js']);
        expect(messagesOf('assets/Home.js')).toEqual(
          expect.arrayContaining(['HOME', 'PANEL', 'PICKER'])
        );
      });

      it('still lists the files of a module whose import loads a chunk that is made for it', () => {
        // As Rolldown writes it where modules do not run in order: Home's
        // import of the picker loads a chunk that passes on what Home's holds
        const { manifest, messagesOf } = write({
          bundle: bundleOf(
            chunk(
              'assets/index.js',
              { '/main.js': site('title') },
              { isEntry: true }
            ),
            chunk(
              'assets/Home.js',
              { '/home.js': site('home'), '/picker.js': site('picker') },
              { dynamicImports: ['assets/Picker.js'] }
            ),
            chunk(
              'assets/Picker.js',
              {},
              { facadeModuleId: '/picker.js', imports: ['assets/Home.js'] }
            )
          ),
          graph: {
            '/main.js': { dynamic: ['/home.js'] },
            '/home.js': { dynamic: ['/picker.js'] },
          },
        });
        expect(Object.keys(manifest.imports).sort()).toEqual([
          'assets/Home.js',
          'assets/Picker.js',
        ]);
        expect(messagesOf('assets/Picker.js')).toContain('PICKER');
      });

      it('still lists the files of a module that another chunk imports too', () => {
        const { messagesOf } = write({
          bundle: bundleOf(
            chunk(
              'assets/index.js',
              { '/main.js': site('title') },
              { isEntry: true }
            ),
            chunk('assets/Home.js', {
              '/home.js': site('home'),
              '/picker.js': site('picker'),
            }),
            chunk('assets/Billing.js', { '/billing.js': site('billing') })
          ),
          graph: {
            '/main.js': { dynamic: ['/home.js', '/billing.js'] },
            '/home.js': { dynamic: ['/picker.js'] },
            '/billing.js': { dynamic: ['/picker.js'] },
          },
        });
        // Billing's import of the picker loads Home's chunk
        expect(messagesOf('assets/Home.js')).toEqual(
          expect.arrayContaining(['HOME', 'PICKER'])
        );
        expect(messagesOf('assets/Billing.js')).toContain('BILLING');
      });
    });

    describe('with hash minification', () => {
      const placeholders = (code: string) =>
        Object.values(HASH).reduce(
          (text, hash) => text.replaceAll(hash, createIdPlaceholder(hash)),
          code
        );
      /**
       * BUNDLE with a Billing route that reads `billing`, as hashes and as
       * the bundler renders it with hash minification: ids in a chunk's
       * code, placeholders in the code of each module.
       */
      function render(...billing: (keyof typeof HASH)[]) {
        const hashed = {
          ...BUNDLE,
          'assets/Billing.js': chunk(
            'assets/Billing.js',
            { '/billing.js': site(...billing) },
            { imports: ['assets/shared.js'] }
          ),
        };
        const minifiedIds: MinifiedIds = { hashes: new Map() };
        const bundle = Object.fromEntries(
          Object.entries(hashed).map(([fileName, file]) => [
            fileName,
            {
              ...file,
              code: minifyChunk(placeholders(file.code), minifiedIds)!,
              modules: Object.fromEntries(
                Object.entries(file.modules).map(([id, { code }]) => [
                  id,
                  { code: placeholders(code) },
                ])
              ),
            },
          ])
        );
        return { hashed, bundle, minifiedIds };
      }

      it('reads ids out of each chunk and placeholders out of each module, and keys the same files by every id of their messages', () => {
        // Billing also reads the date picker, which then has an id in two chunks
        const { hashed, bundle, minifiedIds } = render('billing', 'picker');
        const plain = write({ bundle: hashed });
        const minified = write({ bundle, minifiedIds });
        // The manifest still lists hashes, as a later build reads them from it
        expect(minified.manifest.assignment).toEqual(plain.manifest.assignment);
        expect(minified.manifest.imports).toEqual(plain.manifest.imports);
        const idsOf = (hash: string) =>
          [...minifiedIds.hashes]
            .filter(([, named]) => named === hash)
            .map(([id]) => id);
        expect(idsOf(HASH.picker)).toHaveLength(2);
        for (const [key, { fr }] of Object.entries(plain.manifest.files)) {
          const hashed: Record<string, unknown> = JSON.parse(plain.emitted[fr]);
          const file: MinifiedTranslations = JSON.parse(
            minified.emitted[minified.manifest.files[key].fr]
          );
          expect(unpack(file)).toEqual(
            Object.fromEntries(
              Object.entries(hashed).flatMap(([hash, translation]) =>
                idsOf(hash).map((id) => [id, translation])
              )
            )
          );
          // Once each, also the date picker's, which two chunks read
          expect(file[0]).toEqual(Object.values(hashed));
          // A framework is told the ids of each file, and the hash of each
          expect(minified.written.output.files[key].toSorted()).toEqual(
            Object.keys(unpack(file)).sort()
          );
        }
        expect(minified.written.output.hashes).toEqual(
          Object.fromEntries(minifiedIds.hashes)
        );
        expect(plain.written.output.hashes).toBeUndefined();
        expect(() =>
          write({
            bundle: {
              ...bundle,
              'assets/Admin.js': {
                ...bundle['assets/Admin.js'],
                code: placeholders(hashed['assets/Admin.js'].code),
              },
            },
            minifiedIds,
          })
        ).toThrow('Details: assets/Admin.js.');
      });

      it('gives a page of one build, in the files of the next, the message of its own id or nothing', () => {
        const page = render('billing', 'picker');
        // The deploy added a message to the Billing route
        const deployed = render('billing', 'picker', 'panel');
        const files = readTranslationFiles(
          write({
            bundle: deployed.bundle,
            minifiedIds: deployed.minifiedIds,
          }).emitted
        );
        const changed = new Set(
          minifyHashes([HASH.billing, HASH.picker]).values()
        );
        // A page reads these files when the ones of its own build are gone
        // (see listRegionFiles in gt-react): every chunk that is as it was
        // reads its messages, the changed route's ids are in no file
        expect(readAsPage(page.minifiedIds.hashes, files)).toEqual(
          new Map(
            [...page.minifiedIds.hashes].map(([id, hash]) => [
              id,
              changed.has(id) ? undefined : CATALOG[hash],
            ])
          )
        );
        expect(
          [...changed].every((id) => page.minifiedIds.hashes.has(id))
        ).toBe(true);
      });
    });

    it('gives a route what every module of its chunks reads when a chunk runs all of its modules, and counts those messages', () => {
      const { written, messagesOf } = write({ isLazy: false });
      expect(messagesOf('assets/Home.js')).toEqual(
        expect.arrayContaining(['HOME', 'INVOICE', 'PANEL', 'PICKER'])
      );
      expect(written.stats).toMatchObject({
        isConservative: true,
        conservativeMessages: 3,
      });
    });

    it('merges files while a request is worth more than the bytes it adds', () => {
      expect(write({ requestCost: 1e6 }).written.stats.files).toBeLessThan(4);
    });

    it('keeps the files of the manifest it is given, and builds from nothing when there is none', () => {
      const first = write();
      const file = path.join(first.cwd, 'previous.json');
      fs.writeFileSync(
        file,
        first.emitted['assets/gt-chunk-translations.json']
      );

      const again = write({ previous: file, cwd: first.cwd });
      expect(again.emitted).toEqual(first.emitted);
      expect(again.written.missingPrevious).toBe(false);

      // Home now reaches the invoice table too. The table's message stays
      // in the file it was in, which Home now needs, so no file changes;
      // built from nothing, it moves to where Home and Billing pay least
      const graph = {
        ...GRAPH,
        '/home.js': { imports: ['/picker.js', '/invoice.js'] },
      };
      const changed = write({ previous: file, cwd: first.cwd, graph });
      expect(changed.manifest.assignment).toEqual(first.manifest.assignment);
      expect(changed.manifest.files).toEqual(first.manifest.files);
      expect(changed.messagesOf('assets/Home.js')).toEqual([
        'BILLING',
        'HOME',
        'INVOICE',
        'PICKER',
      ]);
      const fromNothing = write({ cwd: first.cwd, graph });
      expect(fromNothing.manifest.files).not.toEqual(first.manifest.files);

      const missing = write({
        previous: path.join(first.cwd, 'none.json'),
        cwd: first.cwd,
      });
      expect(missing.written.missingPrevious).toBe(true);
      expect(missing.emitted).toEqual(first.emitted);
    });

    it.each([
      ['not JSON', 'not json'],
      ['the manifest of a build that splits by chunk', '{"files":{}}'],
      [
        'files that are not named as the build names them',
        '{"assignment":{"files":{"../a":["x"]},"samples":[]}}',
      ],
    ])('fails a build whose previous manifest is %s', (_name, content) => {
      const { cwd } = createPlugins(ON, 'vite', {
        'translations/fr.json': JSON.stringify(CATALOG),
        'previous.json': content,
      });
      expect(() =>
        write({ previous: path.join(cwd, 'previous.json'), cwd })
      ).toThrow('Could not read the previous chunk translations');
    });

    it('reads when modules run from the options of the bundler, and says what a build that runs every module of a chunk loads', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const created = createPlugins(
        {
          ...SPLIT,
          experimentalSplitTranslations: { by: 'module', requestCost: 0 },
          logLevel: 'debug',
        },
        'vite',
        { 'translations/fr.json': JSON.stringify(CATALOG) }
      );
      const vite = created.plugins[0].vite as {
        configResolved: (config: object) => void;
        options: (options: object) => null;
        outputOptions: (options: object) => null;
        generateBundle: (this: object, options: object, bundle: object) => void;
      };
      vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });
      // The hashes the build knows are those of the modules it compiled
      await transform(MODULE, SPLIT, created);
      const bundle = Object.fromEntries(
        [
          chunk(
            'assets/index.js',
            { '/main.js': callSite(SAVE) },
            { isEntry: true }
          ),
          chunk(
            'assets/Home.js',
            { '/home.js': '' },
            { imports: ['assets/shared.js'] }
          ),
          chunk(
            'assets/shared.js',
            { '/picker.js': '', '/panel.js': callSite(HELLO) },
            { facadeModuleId: null }
          ),
        ].map((file) => [file.fileName, file])
      );
      const generate = () => {
        const emitted: Record<string, string> = {};
        vite.generateBundle.call(
          {
            emitFile: (file: { fileName: string; source: string }) =>
              (emitted[file.fileName] = file.source),
            getModuleInfo: getModuleInfo({
              '/main.js': { dynamic: ['/home.js'] },
              '/home.js': { imports: ['/picker.js'] },
            }),
          },
          {},
          bundle
        );
        return JSON.parse(emitted['assets/gt-chunk-translations.json'])
          .imports as Record<string, string[]>;
      };

      // Rolldown's default: the panel runs when Home loads its chunk
      expect(generate()['assets/Home.js']).toHaveLength(1);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'pages load 1 messages of modules they never import'
        )
      );
      vi.mocked(console.warn).mockClear();

      vite.options({});
      vite.outputOptions({ strictExecutionOrder: true });
      log.mockClear();
      expect(generate()['assets/Home.js']).toBeUndefined();
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('they never import')
      );
      // The panel's message, which no load reaches, so the entry holds it
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining(
          'The files every page requests as it starts hold 1 messages (0 B), of which the entries read 1 (0 B). Replayed every entry'
        )
      );
    });

    it('fails the build when an import would lack a message its modules read', async () => {
      vi.resetModules();
      vi.doMock(
        '../transform/chunk-translations/assignTranslationsByRegion',
        async (original) => {
          const actual =
            await original<
              typeof import('../transform/chunk-translations/assignTranslationsByRegion')
            >();
          return {
            ...actual,
            // An assignment whose imports list nothing
            assignTranslationsByRegion: (
              ...given: Parameters<typeof actual.assignTranslationsByRegion>
            ) => ({
              ...actual.assignTranslationsByRegion(...given),
              demands: new Map(),
            }),
          };
        }
      );
      onTestFinished(() => {
        vi.doUnmock(
          '../transform/chunk-translations/assignTranslationsByRegion'
        );
        vi.resetModules();
      });
      createPlugins(ON, 'vite', {
        'translations/fr.json': JSON.stringify(CATALOG),
      });
      const broken =
        await import('../transform/chunk-translations/writeRegionTranslations');
      expect(() =>
        broken.writeRegionTranslations(
          BUNDLE,
          {
            defaultLocale: 'en',
            locales: ['fr'],
            hashes: new Set(Object.values(HASH)),
            unsplit: new Set(),
            naming: 'map',
            regions: { requestCost: 0, previous: undefined },
          },
          {
            gtFiles: GT_FILES.gt,
            base: '/',
            assetsDir: 'assets',
            emitFile: () => undefined,
            getModuleInfo: getModuleInfo(GRAPH),
            isLazy: true,
          }
        )
      ).toThrow(
        'would leave 12 messages without their translation when the code that reads them runs'
      );
    });
  });
});

/**
 * The plugin of a framework that renders an app on a server passes
 * `splitTranslationsHost`: the split then applies to the environments a
 * browser loads, compiled code imports the loader from the framework's
 * package, and the plugin is handed what the build wrote. How such a build
 * runs in a browser is checked by tests/apps/tanstack-start-split-translations.
 */
// The hash of the `Save` template
const SAVE_TEMPLATE = 'ab72d114d0d156a9';
const LOADER = 'gt-tanstack-start/chunk-translations';
const HOST: SplitTranslationsHost = {
  loader: LOADER,
  clientEnvironments: ['client'],
  onSplit() {},
};
const SERVER_RENDERED: GTUnpluginOptions = {
  gtConfig: {
    defaultLocale: 'en',
    locales: ['fr'],
    files: { gt: { output: 'translations/[locale].json' } },
  },
  experimentalSplitTranslations: { minifyHashes: true },
  precomputeMessages: false,
  splitTranslationsHost: HOST,
};
const SERVER_RENDERED_MODULE = `import { useGT } from 'gt-tanstack-start';
export function Save() {
  const t = useGT();
  return t\`Save\`;
}
export const load = () => import('./Orders');`;

const SERVER = { environment: { name: 'ssr' } };
const CLIENT = { environment: { name: 'client' } };

type Hook = (this: unknown, ...args: never[]) => unknown;
type BuildPlugin = {
  transform: Hook;
  vite: {
    configResolved: (config: object) => void;
    options?: (options: object) => null;
    renderChunk: Hook;
    generateBundle: Hook | { handler: Hook };
  };
};

function createBuild(options: GTUnpluginOptions = SERVER_RENDERED) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-split-server-'));
  onTestFinished(() => fs.rmSync(cwd, { force: true, recursive: true }));
  fs.mkdirSync(path.join(cwd, 'translations'));
  fs.writeFileSync(
    path.join(cwd, 'translations/fr.json'),
    JSON.stringify({ [SAVE_TEMPLATE]: 'Enregistrer' })
  );
  vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  const [compile, wrap] = [
    gtUnplugin.raw(options, { framework: 'vite' } as UnpluginContextMeta),
  ].flat() as unknown as [BuildPlugin, BuildPlugin];
  const id = path.join(cwd, 'App.jsx');
  const run = async (hook: Hook, context: object, code: string) => {
    const result = (await hook.call(
      { addWatchFile() {}, ...context },
      ...([code, id] as never[])
    )) as { code: string } | string | null;
    return result && typeof result === 'object' ? result.code : result;
  };
  return {
    compile,
    wrap,
    transform: (context: object) =>
      run(compile.transform, context, SERVER_RENDERED_MODULE),
    transformCode: (context: object, code: string) =>
      run(compile.transform, context, code),
    wrapImports: (context: object) =>
      run(wrap.transform, context, SERVER_RENDERED_MODULE),
  };
}

describe('experimentalSplitTranslations in a server-rendered app', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GT_SPLIT_TRANSLATIONS', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('keeps the hash at each call site of a build for a server, and wraps none of its imports', async () => {
    const build = createBuild();
    expect(await build.transform(SERVER)).toContain(
      `$_hash: "${SAVE_TEMPLATE}"`
    );
    expect(await build.wrapImports(SERVER)).toBeNull();
  });

  it('splits the client build of the same plugins, which loads translations from the entry the integration names', async () => {
    const build = createBuild();
    const compiled = await build.transform(CLIENT);
    // The id of a build with hash minification, until its chunk is rendered
    expect(compiled).not.toContain(`"${SAVE_TEMPLATE}"`);
    expect(compiled).toContain('$_hash:');
    expect(await build.wrapImports(CLIENT)).toContain(
      `import { loadMinifiedChunk as __gt_chunk_load } from "${LOADER}";`
    );
  });

  it('writes no file for a server, and leaves its chunks as the bundler rendered them', async () => {
    const { compile, wrap } = createBuild();
    compile.vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });
    const code = `t({$_hash:"${SAVE_TEMPLATE}"})\`Save\``;
    const bundle = {
      'server.js': {
        type: 'chunk',
        fileName: 'server.js',
        code,
        imports: [],
        dynamicImports: [],
        isEntry: true,
      },
    };
    const emitFile = vi.fn();
    expect(
      (compile.vite.renderChunk as Hook).call(SERVER, ...([code] as never[]))
    ).toBeNull();
    (compile.vite.generateBundle as Hook).call(
      { ...SERVER, emitFile },
      ...([{}, bundle] as never[])
    );
    (wrap.vite.generateBundle as { handler: Hook }).handler.call(
      SERVER,
      ...([{}, bundle] as never[])
    );
    expect(emitFile).not.toHaveBeenCalled();
    expect(bundle['server.js'].code).toBe(code);
  });

  /**
   * A client bundle whose entry holds `code` and imports a chunk with a
   * message. Returns what names the imported chunks, the last step of a build.
   */
  async function buildClient(code: string, options?: GTUnpluginOptions) {
    const onSplit = vi.fn();
    const { compile, wrap, transform } = createBuild({
      ...SERVER_RENDERED,
      experimentalSplitTranslations: {},
      splitTranslationsHost: { ...HOST, onSplit },
      ...options,
    });
    await transform(CLIENT);
    compile.vite.configResolved({ base: '/', build: { assetsDir: 'assets' } });
    wrap.vite.options!({});
    const chunk = (fileName: string, source: string, rest = {}) => ({
      type: 'chunk',
      fileName,
      code: source,
      imports: [],
      dynamicImports: [],
      isEntry: false,
      ...rest,
    });
    const bundle = {
      'assets/index.js': chunk('assets/index.js', code, {
        isEntry: true,
        dynamicImports: ['assets/Orders.js'],
      }),
      'assets/Orders.js': chunk(
        'assets/Orders.js',
        `t({$_hash:"${SAVE_TEMPLATE}"})\`Save\``
      ),
    };
    (compile.vite.generateBundle as Hook).call(
      { ...CLIENT, emitFile() {} },
      ...([{}, bundle] as never[])
    );
    const name = () =>
      (wrap.vite.generateBundle as { handler: Hook }).handler.call(
        CLIENT,
        ...([{}, bundle] as never[])
      );
    return Object.assign(name, { onSplit });
  }

  it('hands the plugin of the framework what the client build wrote, once', async () => {
    const { onSplit } = await buildClient(
      `e(()=>import("./Orders.js"),"${IMPORTED_CHUNKS_PLACEHOLDER}")`
    );
    expect(onSplit.mock.calls).toEqual([
      [
        {
          entries: {
            'assets/index.js': {
              state: {
                b: '/',
                f: 'assets/index',
                h: { fr: 'ad5321fc' },
                v: { fr: '5ba11f71' },
                c: 'e9d6aae7',
                n: 'assets/gt-current',
              },
              messages: [],
              files: [],
            },
          },
          imports: { 'assets/Orders.js': ['assets/Orders'] },
          files: { 'assets/Orders': [SAVE_TEMPLATE] },
          unsplit: [],
        },
      ],
    ]);
  });

  it('fails the build on an import it could not wrap that loads translations, naming the package to add', async () => {
    const name = await buildClient(`import("./Orders.js")`);
    expect(name).toThrow(
      /cannot load the translations of assets\/Orders\.js because a dynamic import the build could not wrap loads them.*cannot resolve gt-tanstack-start\/chunk-translations.*Add gt-tanstack-start to the dependencies/s
    );
  });

  it('accepts a build whose imports are all wrapped, without asking for initializeGTSPA', async () => {
    const name = await buildClient(
      `e(()=>import("./Orders.js"),"${IMPORTED_CHUNKS_PLACEHOLDER}")`
    );
    expect(name).not.toThrow();
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('initializeGTSPA')
    );
  });

  it('only warns of such an import in an app that starts with initializeGTSPA', async () => {
    const name = await buildClient(`import("./Orders.js")`, {
      splitTranslationsHost: undefined,
    });
    expect(name).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Nothing waits for the translations of assets/Orders.js'
      )
    );
  });
});
