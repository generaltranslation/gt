/**
 * experimentalChunkTranslations: a production build writes the translations
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
import type { UnpluginContextMeta, UnpluginOptions } from 'unplugin';
import gtUnplugin from '../index';
import type { GTUnpluginOptions } from '../index';
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
import { wrapDynamicImports } from '../transform/chunk-translations/chunkTranslationsModule';
import {
  CHUNK_TRANSLATIONS_IMPORTS,
  chunkTranslationsNamings,
  getChunkTranslations,
  getChunkTranslationsNaming,
  getEntryExport,
  IMPORTED_CHUNKS_PLACEHOLDER,
  type ChunkTranslationsImport,
  resolveChunkTranslations,
  UNSPLIT_LOADER_PLACEHOLDER,
} from '../transform/chunk-translations/resolveChunkTranslations';
import {
  getPageBase,
  renderStartupScript,
} from '../transform/chunk-translations/startupScript';
import {
  createUnsplitTranslationsMessage,
  getUnsplitTranslations,
  replaceUnsplitLoader,
} from '../transform/chunk-translations/unsplitTranslations';
import { renderChunkTranslations } from '../transform/chunk-translations/writeChunkTranslations';

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
  experimentalChunkTranslations: true,
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

const MODULE = `import { jsx } from 'react/jsx-runtime';
import { initializeGTSPA, T, t } from 'gt-react';
export const ready = initializeGTSPA({ defaultLocale: 'en', locales: ['fr'] });
export const save = () => t\`Save\`;
export const hello = (name) => t\`Hello, \${{ name }}!\`;
export const short = () => t({ maxChars: 4 })\`Save\`;
export const Shared = () => jsx(T, { children: 'Shared by every route' });`;

describe('experimentalChunkTranslations', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GT_CHUNK_TRANSLATIONS', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('the option', () => {
    it.each([
      [undefined, 'true', true],
      [undefined, '1', true],
      [undefined, 'false', false],
      [undefined, undefined, false],
      [false, 'true', false],
      [true, 'false', true],
    ])('is %s with GT_CHUNK_TRANSLATIONS=%s: %s', (option, env, expected) => {
      if (env !== undefined) vi.stubEnv('GT_CHUNK_TRANSLATIONS', env);
      else vi.stubEnv('GT_CHUNK_TRANSLATIONS', undefined as never);
      expect(getChunkTranslations(option)).toBe(expected);
    });

    it('rejects an environment value that is not a boolean', () => {
      vi.stubEnv('GT_CHUNK_TRANSLATIONS', 'yes');
      expect(() => getChunkTranslations(undefined)).toThrow(
        'GT_CHUNK_TRANSLATIONS is set to "yes", which is not a boolean'
      );
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
        experimentalChunkTranslations: true,
      });
      const buildStart = plugins[0].buildStart as () => void;
      expect(buildStart).toThrow('lists no locale other than the default');
      vi.stubEnv('NODE_ENV', 'development');
      expect(buildStart).not.toThrow();
    });

    it('adds its hooks and its second plugin only when it is on', () => {
      const off = createPlugins({ gtConfig: GT_CONFIG }).plugins;
      expect(off).toHaveLength(1);
      expect(off[0].vite).toBeUndefined();
      expect(off[0].rollup).toBeUndefined();

      const on = createPlugins({
        gtConfig: GT_CONFIG,
        experimentalChunkTranslations: true,
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
    });
  });

  describe('a module', () => {
    it('reads each message from its chunk and starts with the entry file', async () => {
      expect(await transform(MODULE)).toMatchInlineSnapshot(`
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
        experimentalChunkTranslations: true,
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

    /** Builds a bundle whose entry holds `code`, and returns what the build wrote and warned. */
    async function build(code: string, dynamicImports: string[]) {
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
          generateBundle: unknown;
        };
      }[];
      first.vite.configResolved!({ base: '/', build: { assetsDir: 'assets' } });
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

    it.each([
      [undefined, undefined, 'token'],
      [undefined, 'map', 'map'],
      ['token', 'map', 'token'],
      ['map', undefined, 'map'],
    ] as const)(
      'is chosen by the option %s, then GT_CHUNK_TRANSLATIONS_NAMING=%s: %s',
      (option, env, expected) => {
        vi.stubEnv('GT_CHUNK_TRANSLATIONS_NAMING', env as never);
        expect(getChunkTranslationsNaming(option)).toBe(expected);
      }
    );

    it('rejects a naming it does not have', () => {
      vi.stubEnv('GT_CHUNK_TRANSLATIONS_NAMING', 'hash');
      expect(() => getChunkTranslationsNaming(undefined)).toThrow(
        '"hash", which is not one of token, map'
      );
    });

    it('compiles the app to read the maps, and nothing else differently', async () => {
      const MAPPED = {
        ...ON,
        experimentalChunkTranslationsNaming: 'map' as const,
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
        responses = {},
        links = [],
        base = '/',
        baseURI = 'https://app.test/',
        readyState = 'loading',
      }: {
        unsplit?: { key: string; hashes: Record<string, string> };
        files?: string[];
        maps?: { key: string };
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
      };
      const window: { MutationObserver?: object } & Record<string, State> = {};
      const script = renderStartupScript({
        base,
        entry: 'assets/index-a1',
        hashes: { fr: '11111111', 'pt-BR': '22222222' },
        tokens: TOKENS,
        files,
        maps,
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
      }
    });
  });
});
