/**
 * Builds everything that is not a timing: the catalog of every cell in every
 * format, each produced by that library's own compiler, their byte sizes, the
 * check that all formats print the same text, the example messages and the
 * runtime bundles. Writes tmp/catalogs, tmp/harness and tmp/static.json.
 */
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { icuToMessage } from '@generaltranslation/icu/convert';
import { compileMessageOrThrow } from '@lingui/message-utils/compileMessage';
import compileMinify from 'icu-minify/compile';
import { _createCache, _createIntlFormatters } from 'use-intl/core';
import formatOnly from 'use-intl/format-message/format-only';
import {
  LOCALE_COUNTS,
  LOCALES,
  MIX_IDS,
  SEED,
  SIZES,
  loadCorpus,
  type Corpus,
  type Kind,
  type MixId,
} from './corpus.ts';
import {
  FORMATS,
  catalogFile,
  formatOf,
  harnessFile,
  localeCountsOf,
  packageDir,
  workDir,
} from './formats.ts';
import {
  INTLAYER_KEY,
  buildIntlayer,
  buildParaglide,
  buildParaglideOfficialPerLocale,
  compileParaglideExamples,
  type ProjectInput,
} from './projects.ts';
import { PAGE_MESSAGES, valuesFor, type Runtime } from './values.ts';

process.env.TZ = 'UTC';
process.env.NODE_ENV = 'production';

type Sizes = { raw: number; gzip: number; brotli: number };
export type StaticCell = {
  format: string;
  mix: MixId;
  n: number;
  locales: number;
  bytes: Sizes & { valuesGzip: number };
  runtimeBytes: { min: number; gzip: number; brotli: number };
  /** Characters the format prints for the first page of messages, and for all n. */
  chars: { page: number; all: number };
};

const sizes = (text: string): Sizes => ({
  raw: Buffer.byteLength(text),
  gzip: gzipSync(text, { level: 6 }).length,
  brotli: brotliCompressSync(text, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: Buffer.byteLength(text),
    },
  }).length,
});
const runtimeSizes = (text: string) => {
  const { raw, gzip, brotli } = sizes(text);
  return { min: raw, gzip, brotli };
};
const gzipOf = (value: unknown) =>
  gzipSync(JSON.stringify(value), { level: 6 }).length;

function writeWork(file: string, text: string) {
  mkdirSync(dirname(join(workDir, file)), { recursive: true });
  writeFileSync(join(workDir, file), text);
}

/** What `formatjs compile --ast` (default options) emits for `{key: icu}`. */
function formatjsAst(byKey: Record<string, string>, name: string) {
  const input = join(workDir, `formatjs-${name}.in.json`);
  const output = join(workDir, `formatjs-${name}.out.json`);
  writeFileSync(input, JSON.stringify(byKey));
  execFileSync(
    join(packageDir, 'node_modules/.bin/formatjs'),
    ['compile', '--ast', '--format', 'simple', input, '--out-file', output],
    { stdio: 'inherit' }
  );
  return JSON.parse(readFileSync(output, 'utf8')) as Record<string, unknown>;
}

type JsonWires = Record<
  'icu' | 'tree' | 'fjs-ast' | 'lingui' | 'minify',
  unknown
>;

/** One message in every JSON format, each by its own library's compiler. */
function compileJson(
  messages: { key: string; icu: string }[],
  name: string
): JsonWires[] {
  const ast = formatjsAst(
    Object.fromEntries(messages.map(({ key, icu }) => [key, icu])),
    name
  );
  return messages.map(({ key, icu }) => {
    const { tree, formats } = icuToMessage(icu);
    if (Object.keys(formats).length)
      throw new Error(
        `message has formatting context, so its tree alone is not the message: ${icu}`
      );
    return {
      icu,
      tree,
      'fjs-ast': ast[key],
      lingui: compileMessageOrThrow(icu),
      minify: compileMinify(icu),
    };
  });
}

const loadRuntime = (module: string): Promise<Runtime> =>
  import(`./runtimes/${module}.ts`);

type Render = (key: string, values: never, index: number) => string;
async function renderer(module: string, text: string): Promise<Render> {
  const runtime = await loadRuntime(module);
  const parse = runtime.parse ?? JSON.parse;
  return runtime.make(parse(text) as never) as Render;
}

/** Runs `job` over `items`, a few at a time: each job is a `vite build` or two. */
async function pool<T>(items: T[], job: (item: T) => Promise<void>) {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await job(item);
  };
  const workers = Math.max(1, Math.min(8, availableParallelism() - 2));
  await Promise.all(Array.from({ length: workers }, worker));
}

const projectInput = (
  corpus: Corpus,
  tool: string,
  n: number,
  locales: number
): ProjectInput => ({
  dir: join(workDir, 'projects', `${tool}-${corpus.mix}-${n}-L${locales}`),
  keys: corpus.messages.slice(0, n).map(({ key }) => key),
  locales: LOCALES.slice(0, locales).map((locale, index) => ({
    locale,
    icu: corpus.icuOf(index).slice(0, n),
  })),
});

/** `(function(){…})();` and the module Vite emits for the same code differ only in the wrapper. */
const scriptBody = (script: string) =>
  script
    .trim()
    .replace(/^\(function\(\)\{/, '')
    .replace(/\}\)\(\);$/, '')
    .replace(/;$/, '');

type Built = Omit<StaticCell, 'chars'>;

/**
 * The Paraglide and Intlayer cells of one mix. The per-locale setup of each is
 * built for every locale count too, to check that its output does not depend
 * on it.
 */
async function buildProjects(corpus: Corpus): Promise<Built[]> {
  const { mix } = corpus;
  const cells: Built[] = [];
  const perLocale = new Map<string, string>();
  /** A per-locale setup must emit the same catalog whatever the locale count. */
  const invariant = (id: string, n: number, locales: number, text: string) => {
    const key = `${id}-${n}`;
    if (!perLocale.has(key)) perLocale.set(key, text);
    else if (perLocale.get(key) !== text)
      throw new Error(
        `${id} ${mix}/${n} depends on the locale count (${locales} locales)`
      );
  };
  const cell = (
    id: string,
    n: number,
    locales: number,
    catalog: string,
    bytes: Built['bytes'],
    runtime: string,
    harness?: string
  ) => {
    const format = formatOf(id);
    if (format.localeInvariant) {
      invariant(id, n, locales, catalog);
      if (locales !== 1) return;
    }
    writeWork(catalogFile(format, mix, n, locales), catalog);
    if (harness) writeWork(harnessFile(format, mix, n, locales), harness);
    const runtimeBytes = runtimeSizes(runtime);
    cells.push({ format: id, mix, n, locales, bytes, runtimeBytes });
  };
  const jobs = SIZES.flatMap((n) =>
    LOCALE_COUNTS.map((locales) => ({ n, locales }))
  ).reverse();
  await pool(jobs, async ({ n, locales }) => {
    const paraglide = projectInput(corpus, 'paraglide', n, locales);
    for (const mode of ['default', 'static'] as const) {
      const out = await buildParaglide(paraglide, mode);
      const id = mode === 'default' ? 'paraglide' : 'paraglide-static';
      const messages = sizes(out.messages);
      // The bundle holds no keys, so it is its own "values only" size.
      const bytes = { ...messages, valuesGzip: messages.gzip };
      cell(id, n, locales, out.script, bytes, out.runtime);
      if (mode === 'static' && n === 100 && locales === 5) {
        const official = await buildParaglideOfficialPerLocale(paraglide);
        if (scriptBody(official) !== scriptBody(out.script))
          throw new Error(
            'the static build is not what experimentalPerLocaleBuild emits for `en`'
          );
      }
    }
    rmSync(paraglide.dir, { recursive: true, force: true });

    const intlayer = projectInput(corpus, 'intlayer', n, locales);
    for (const mode of ['static', 'dynamic'] as const) {
      const out = await buildIntlayer(intlayer, mode);
      const id = mode === 'static' ? 'intlayer' : 'intlayer-dynamic';
      const { content } = JSON.parse(out.dictionary);
      // With several locales the static dictionary is one translation node.
      const values =
        content.nodeType === 'translation'
          ? Object.values(content.translation).map((locale) =>
              Object.values(locale as object)
            )
          : Object.values(content);
      const bytes = { ...sizes(out.dictionary), valuesGzip: gzipOf(values) };
      cell(id, n, locales, out.dictionary, bytes, out.harness, out.harness);
      if (mode === 'static' && n === 100 && locales === 1)
        // Run in the project, where the adapter finds the built dictionary.
        execFileSync(
          process.execPath,
          [join(packageDir, 'src/intlayer-adapter-check.ts'), mix, String(n)],
          { cwd: intlayer.dir, stdio: 'inherit' }
        );
    }
    rmSync(intlayer.dir, { recursive: true, force: true });
    console.error(`  built ${mix} n=${n} locales=${locales}`);
  });
  return cells;
}

const EXAMPLES: [kind: string, icu: string][] = [
  ['plain text', 'Save changes'],
  ['one variable', 'Hi {name}!'],
  ['number', 'Disk is {ratio, number, percent} full'],
  ['date', 'Due {due, date, medium}'],
  ['plural', '{count, plural, one {# file} other {# files}}'],
  [
    'plural with =0 and a variable',
    '{count, plural, =0 {No messages} one {# message from {name}} other {# messages from {name}}}',
  ],
  [
    'select',
    '{role, select, admin {Manage team} member {View team} other {Request access}}',
  ],
  [
    'plural inside select',
    '{role, select, admin {{count, plural, one {# admin} other {# admins}}} other {{count, plural, one {# member} other {# members}}}} in {team}',
  ],
];

/** Example messages of rising complexity, as each format stores them. */
async function buildExamples() {
  const keys = EXAMPLES.map((_, i) => `e${i}`);
  const icu = EXAMPLES.map(([, text]) => text);
  const json = compileJson(
    keys.map((key, i) => ({ key, icu: icu[i]! })),
    'examples'
  );
  const input = (tool: string): ProjectInput => ({
    dir: join(workDir, 'projects', `${tool}-examples`),
    keys,
    locales: [{ locale: 'en', icu }],
  });
  const paraglide = await compileParaglideExamples(input('paraglide'));
  const dictionary = JSON.parse(
    (await buildIntlayer(input('intlayer'), 'dynamic')).dictionary
  );
  return EXAMPLES.map(([kind], i) => ({
    kind,
    icu: icu[i]!,
    tree: json[i]!.tree,
    fjsAst: json[i]!['fjs-ast'],
    lingui: json[i]!.lingui,
    minify: json[i]!.minify,
    paraglide: paraglide[i]!,
    intlayer: dictionary.content[keys[i]!],
  }));
}

const browserBuild = {
  bundle: true,
  minify: true,
  platform: 'browser',
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
} as const;
const NO_PARSER = {
  '@formatjs/icu-messageformat-parser':
    '@formatjs/icu-messageformat-parser/no-parser.js',
};

/** The script of each runtime that the browser page evaluates, and the page's own. */
async function buildHarness() {
  const modules = new Set(FORMATS.map((format) => format.module));
  modules.delete('intlayer');
  for (const name of [...modules, 'fjs-ast']) {
    const module = name === 'fjs-ast' ? 'formatjs' : name;
    const result = await build({
      ...browserBuild,
      stdin: {
        contents: `import * as runtime from './runtimes/${module}.ts'; globalThis.__bench = runtime;`,
        resolveDir: join(packageDir, 'src'),
      },
      format: 'iife',
      alias: name === 'fjs-ast' ? NO_PARSER : {},
    });
    writeWork(`harness/${name}.js`, result.outputFiles[0]!.text);
  }
  const page = await build({
    ...browserBuild,
    entryPoints: [join(packageDir, 'src/page.ts')],
    format: 'iife',
  });
  writeWork('harness/page.js', page.outputFiles[0]!.text);
}

/** Runtime bytes: the one import that formats, bundled and minified for the browser. */
const RUNTIME_ENTRIES: Record<string, [string, Record<string, string>?]> = {
  icu: [`export { formatIcu } from '@generaltranslation/icu/parser'`],
  'icu-fjs': [`export { IntlMessageFormat } from 'intl-messageformat'`],
  'fjs-ast': [
    `export { IntlMessageFormat } from 'intl-messageformat'`,
    NO_PARSER,
  ],
  lingui: [`export { i18n } from '@lingui/core'`],
  minify: [`export { default } from 'icu-minify/format'`],
  tree: [`export { formatMessageTree } from '@generaltranslation/icu'`],
  // Not formats of the grid; quoted in the notes.
  'fjs-ast (parser not aliased away)': [
    `export { IntlMessageFormat } from 'intl-messageformat'`,
  ],
  'minify + next-intl wrapper and formatter cache': [
    `export { default } from 'use-intl/format-message/format-only'; export { _createCache, _createIntlFormatters } from 'use-intl/core'`,
  ],
  'icu-fjs / fjs-ast + react-intl formatter cache': [
    `export { IntlMessageFormat } from 'intl-messageformat'; export { createFormatters, createIntlCache } from '@formatjs/intl'`,
  ],
};

async function buildRuntimeBytes() {
  const runtime: Record<string, ReturnType<typeof runtimeSizes>> = {};
  for (const [id, [contents, alias]] of Object.entries(RUNTIME_ENTRIES)) {
    const result = await build({
      ...browserBuild,
      stdin: { contents, resolveDir: packageDir },
      format: 'esm',
      alias: alias ?? {},
    });
    runtime[id] = runtimeSizes(result.outputFiles[0]!.text);
  }
  return runtime;
}

/**
 * The version of an installed package. A package this one does not depend on
 * directly is found beside `from`, the dependency that brings it in.
 */
function version(name: string, from?: string): string {
  const modules = join(packageDir, 'node_modules');
  const dir = from
    ? join(realpathSync(join(modules, from)).slice(0, -from.length), name)
    : join(modules, name);
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
}

const VERSIONS: [name: string, from?: string][] = [
  ['@generaltranslation/icu'],
  ['intl-messageformat'],
  ['@formatjs/icu-messageformat-parser'],
  ['@formatjs/icu-skeleton-parser', '@formatjs/icu-messageformat-parser'],
  ['@formatjs/fast-memoize', 'intl-messageformat'],
  ['@formatjs/intl'],
  ['@lingui/core'],
  ['@lingui/message-utils'],
  ['icu-minify'],
  ['use-intl'],
  ['@inlang/paraglide-js'],
  ['@inlang/plugin-icu1'],
  ['@inlang/sdk', '@inlang/paraglide-js'],
  ['intlayer'],
  ['@intlayer/core'],
  ['@intlayer/sync-json-plugin'],
  ['@intlayer/react-intl'],
  ['vite-intlayer'],
  ['vite'],
  ['rolldown', 'vite'],
  ['esbuild'],
  ['playwright-core'],
];

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

const cells: StaticCell[] = [];
const mixes = [];
const check: Record<string, unknown> = {};
const intlCache = _createCache();
const intlFormatters = _createIntlFormatters(intlCache);

for (const mix of MIX_IDS) {
  console.error(`${mix}: generating and compiling`);
  const corpus = loadCorpus(mix);
  const { messages } = corpus;
  const wires = compileJson(messages, mix);
  const built: Built[] = [];
  for (const n of SIZES)
    for (const wire of [
      'icu',
      'fjs-ast',
      'lingui',
      'minify',
      'tree',
    ] as const) {
      const catalog = Object.fromEntries(
        messages.slice(0, n).map(({ key }, i) => [key, wires[i]![wire]])
      );
      const text = JSON.stringify(catalog);
      const bytes = {
        ...sizes(text),
        valuesGzip: gzipOf(Object.values(catalog)),
      };
      for (const format of FORMATS.filter((f) => f.wire === wire)) {
        writeWork(catalogFile(format, mix, n, 1), text);
        const runtimeBytes = { min: 0, gzip: 0, brotli: 0 };
        built.push({
          format: format.id,
          mix,
          n,
          locales: 1,
          bytes,
          runtimeBytes,
        });
      }
    }
  built.push(...(await buildProjects(corpus)));

  // Every format must print the same string for every message, before anything is timed.
  const all = SIZES.at(-1)!;
  const checked = messages.slice(0, all);
  const printed: Record<string, string[]> = {};
  for (const format of FORMATS) {
    const text = readFileSync(
      join(workDir, catalogFile(format, mix, all, 1)),
      'utf8'
    );
    const render = await renderer(format.module, text);
    printed[format.id] = checked.map(({ key }, i) =>
      render(key, valuesFor(i) as never, i)
    );
  }
  printed['minify via use-intl'] = checked.map(
    ({ key }, i) =>
      formatOnly(key, wires[i]!.minify as never, valuesFor(i), {
        locale: 'en',
        cache: intlCache,
        formatters: intlFormatters,
        timeZone: 'UTC',
      }) as string
  );
  /**
   * Intlayer prints `#` without grouping (1234 for 1,234) and resolves a select
   * on a variable that is not named `value` to its fallback branch, so it is
   * compared on the kinds it prints as ICU does.
   */
  const intlayerDiffers: Kind[] = ['plural', 'select', 'selectPlural'];
  const differences: Record<string, Partial<Record<Kind, number>>> = {};
  for (const [id, list] of Object.entries(printed))
    list.forEach((text, i) => {
      if (typeof text === 'string' && text === printed.tree![i]) return;
      const { kind, icu } = messages[i]!;
      if (!id.startsWith('intlayer') || !intlayerDiffers.includes(kind))
        throw new Error(
          `${mix}/${id} differs at ${i}: ${icu}\n  tree: ${printed.tree![i]}\n  ${id}: ${text}`
        );
      const counts = (differences[id] ??= {});
      counts[kind] = (counts[kind] ?? 0) + 1;
    });
  check[mix] = {
    messages: checked.length,
    printersAgreeing: Object.keys(printed).filter((id) => !differences[id]),
    distinctOutputs: new Set(printed.tree).size,
    messagesThatDiffer: differences,
  };

  const length = (id: string, count: number) =>
    printed[id]!.slice(0, count).reduce((sum, text) => sum + text.length, 0);
  for (const cell of built)
    cells.push({
      ...cell,
      chars: {
        page: length(cell.format, Math.min(PAGE_MESSAGES, cell.n)),
        all: length(cell.format, cell.n),
      },
    });

  const counts: Partial<Record<Kind, number>> = {};
  for (const { kind } of messages) counts[kind] = (counts[kind] ?? 0) + 1;
  mixes.push({
    id: mix,
    label:
      mix === 'app'
        ? 'App-like (shares of a real app catalog)'
        : 'Rich (every message has structure)',
    shares: Object.fromEntries(
      Object.entries(counts).map(([kind, count]) => [
        kind,
        +(count / messages.length).toFixed(4),
      ])
    ),
    meanValueBytes: +(
      messages.reduce((sum, { icu }) => sum + Buffer.byteLength(icu), 0) /
      messages.length
    ).toFixed(2),
  });
}

console.error('bundling the runtimes');
await buildHarness();
const runtime = await buildRuntimeBytes();
for (const cell of cells)
  if (runtime[cell.format]) cell.runtimeBytes = runtime[cell.format]!;
// Paraglide's functions are held by index, so every runtime gets the keys in catalog order.
for (const mix of MIX_IDS)
  writeWork(
    `catalogs/${mix}-keys.json`,
    JSON.stringify(loadCorpus(mix).messages.map(({ key }) => key))
  );

const order = (cell: StaticCell) =>
  MIX_IDS.indexOf(cell.mix) * 1e9 +
  cell.n * 1e4 +
  cell.locales * 1e2 +
  FORMATS.findIndex((format) => format.id === cell.format);
cells.sort((a, b) => order(a) - order(b));
for (const format of FORMATS)
  for (const mix of MIX_IDS)
    for (const n of SIZES)
      for (const locales of localeCountsOf(format, LOCALE_COUNTS))
        if (
          !cells.some(
            (cell) =>
              cell.format === format.id &&
              cell.mix === mix &&
              cell.n === n &&
              cell.locales === locales
          )
        )
          throw new Error(`no cell for ${format.id} ${mix}/${n}/${locales}`);

writeWork(
  'static.json',
  JSON.stringify({
    seed: SEED,
    intlayerKey: INTLAYER_KEY,
    mixes,
    cells,
    check,
    examples: await buildExamples(),
    runtime,
    versions: Object.fromEntries(
      VERSIONS.map(([name, from]) => [name, version(name, from)])
    ),
  })
);
rmSync(join(workDir, 'projects'), { recursive: true, force: true });
console.error(JSON.stringify({ check, runtime }, null, 1));
