/**
 * Paraglide JS and Intlayer are build tools: each turns the ICU catalogs into
 * its own format with its own Vite plugin. This writes one small project per
 * cell and runs `vite build` in it, as an app would.
 */
import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { packageDir } from './formats.ts';

const require = createRequire(import.meta.url);
const run = promisify(execFile);
const viteBin = join(
  dirname(require.resolve('vite/package.json')),
  'bin/vite.js'
);

async function vite(dir: string, env: Record<string, string> = {}) {
  await run(process.execPath, [viteBin, 'build'], {
    cwd: dir,
    env: { ...process.env, NODE_ENV: 'production', ...env },
    maxBuffer: 1 << 26,
  });
}

function write(dir: string, file: string, content: string) {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), content);
}

export type ProjectInput = {
  dir: string;
  keys: string[];
  /** The ICU strings of each locale, in key order; the first locale is `en`. */
  locales: { locale: string; icu: string[] }[];
};

const catalogOf = (keys: string[], icu: string[]) =>
  JSON.stringify(Object.fromEntries(keys.map((key, i) => [key, icu[i]])));

/** The expression that Paraglide's per-locale build compiles in and its bundler defines. */
const STATIC_LOCALE =
  '/** @type {any} */ (globalThis).__PARAGLIDE_STATIC_LOCALE__';

const PARAGLIDE_VITE_CONFIG = `import { paraglideVitePlugin } from '@inlang/paraglide-js';

const mode = process.env.PARAGLIDE_MODE;
const options = {
  default: {},
  // What experimentalPerLocaleBuild sets up for its \`en\` environment.
  static: { outputStructure: 'locale-modules', experimentalStaticLocale: ${JSON.stringify(STATIC_LOCALE)} },
  official: { experimentalPerLocaleBuild: true },
}[mode];

export default {
  logLevel: 'error',
  define: mode === 'static' ? { 'globalThis.__PARAGLIDE_STATIC_LOCALE__': '"en"' } : {},
  plugins: [paraglideVitePlugin({ project: './project.inlang', outdir: './src/paraglide', ...options })],
  build: {
    outDir: \`dist-\${mode}\`,
    minify: true,
    modulePreload: false,
    chunkSizeWarningLimit: Infinity,
    rolldownOptions: {
      input: 'src/entry.js',
      output: mode === 'official' ? { entryFileNames: 'messages.js' } : [
        // Two chunks, to measure the messages and the runtime they import.
        { format: 'es', entryFileNames: 'es/messages.js', chunkFileNames: 'es/[name].js', manualChunks: (id) => (/paraglide\\/(runtime|registry)\\.js$/.test(id) ? 'runtime' : undefined) },
        // One script, which the timing harness evaluates.
        { format: 'iife', entryFileNames: 'iife/messages.js' },
      ],
    },
  },
};
`;

function writeParaglideProject({ dir, keys, locales }: ProjectInput) {
  write(dir, 'package.json', '{"private":true,"type":"module"}');
  write(
    dir,
    'project.inlang/settings.json',
    JSON.stringify({
      baseLocale: 'en',
      locales: locales.map(({ locale }) => locale),
      // inlang's ICU MessageFormat 1 plugin, read from node_modules instead of its CDN.
      modules: [require.resolve('@inlang/plugin-icu1')],
      'plugin.inlang.icu-messageformat-1': {
        pathPattern: './messages/{locale}.json',
      },
    })
  );
  for (const { locale, icu } of locales)
    write(dir, `messages/${locale}.json`, catalogOf(keys, icu));
  // An app calls each message function by name, so its bundler drops the
  // names. The list keeps every message in the bundle, in catalog order.
  write(
    dir,
    'src/entry.js',
    `import * as m from './paraglide/messages.js';\nglobalThis.__paraglideMessages = [${keys.map((key) => `m[${JSON.stringify(key)}]`).join(',')}];\n`
  );
  write(dir, 'vite.config.mjs', PARAGLIDE_VITE_CONFIG);
}

export type ParaglideOutput = {
  /** The messages chunk and the runtime chunk it imports. */
  messages: string;
  runtime: string;
  /** Both in one script. */
  script: string;
};

/** Builds a Paraglide project in its default setup or for the `en` locale only. */
export async function buildParaglide(
  input: ProjectInput,
  mode: 'default' | 'static'
): Promise<ParaglideOutput> {
  if (!existsSync(input.dir)) writeParaglideProject(input);
  await vite(input.dir, { PARAGLIDE_MODE: mode });
  const read = (file: string) =>
    readFileSync(join(input.dir, `dist-${mode}`, file), 'utf8');
  return {
    messages: read('es/messages.js'),
    runtime: read('es/runtime.js'),
    script: read('iife/messages.js'),
  };
}

/**
 * The `en` bundle that Paraglide's own per-locale build emits. It builds every
 * locale, which takes minutes for a large catalog, so it is only used to check
 * that the `static` mode above produces the same file.
 */
export async function buildParaglideOfficialPerLocale(
  input: ProjectInput
): Promise<string> {
  await vite(input.dir, { PARAGLIDE_MODE: 'official' });
  const out = join(input.dir, 'dist-official');
  const manifest = JSON.parse(
    readFileSync(join(out, 'paraglide-vite-locales.json'), 'utf8')
  );
  return readFileSync(
    join(out, manifest.locales.en.directory, 'messages.js'),
    'utf8'
  );
}

/** The source of each compiled message function, comments removed, from Paraglide's CLI. */
export async function compileParaglideExamples(
  input: ProjectInput
): Promise<string[]> {
  writeParaglideProject(input);
  const bin = join(
    dirname(require.resolve('@inlang/paraglide-js')),
    '../bin/run.js'
  );
  const args = [
    'compile',
    '--project',
    './project.inlang',
    '--outdir',
    './out',
  ];
  await run(process.execPath, [bin, ...args], { cwd: input.dir });
  return input.keys.map((key) =>
    readFileSync(join(input.dir, 'out/messages', `${key}.js`), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/\s*/g, '')
      .replace(/^import .*\n+/gm, '')
      .trim()
  );
}

const INTLAYER_CONFIG = `import { readFileSync } from 'node:fs';
import { syncJSON } from '@intlayer/sync-json-plugin';

export default {
  internationalization: { locales: JSON.parse(readFileSync('locales.json', 'utf8')), defaultLocale: 'en' },
  dictionary: { importMode: process.env.INTLAYER_IMPORT_MODE },
  editor: { enabled: false },
  plugins: [syncJSON({ format: 'icu', source: ({ key, locale }) => \`./locales/\${locale}/\${key}.json\` })],
};
`;

const INTLAYER_VITE_CONFIG = `import { intlayer } from 'vite-intlayer';

export default {
  logLevel: 'error',
  plugins: [intlayer()],
  build: {
    outDir: \`dist-\${process.env.INTLAYER_IMPORT_MODE}\`,
    minify: true,
    modulePreload: false,
    rolldownOptions: { input: 'src/harness.js', output: { format: 'iife', entryFileNames: 'harness.js' } },
  },
};
`;

/** The dictionary key; the catalog is one dictionary, as one JSON file per locale gives. */
export const INTLAYER_KEY = 'messages';

export type IntlayerOutput = {
  /** The dictionary Intlayer builds: every locale (static) or `en` alone (dynamic). */
  dictionary: string;
  /** Its interpreter and ICU resolver, bundled by its Vite plugin. */
  harness: string;
};

/** Builds the dictionary and the runtime of an Intlayer project for one import mode. */
export async function buildIntlayer(
  { dir, keys, locales }: ProjectInput,
  importMode: 'static' | 'dynamic'
): Promise<IntlayerOutput> {
  if (!existsSync(dir)) {
    write(dir, 'package.json', '{"private":true,"type":"module"}');
    write(dir, 'intlayer.config.mjs', INTLAYER_CONFIG);
    write(dir, 'vite.config.mjs', INTLAYER_VITE_CONFIG);
    write(
      dir,
      'locales.json',
      JSON.stringify(locales.map(({ locale }) => locale))
    );
    for (const { locale, icu } of locales)
      write(
        dir,
        `locales/${locale}/${INTLAYER_KEY}.json`,
        catalogOf(keys, icu)
      );
    write(
      dir,
      'src/harness.js',
      `import * as runtime from ${JSON.stringify(join(packageDir, 'src/runtimes/intlayer.ts'))};\nglobalThis.__bench = runtime;\n`
    );
  }
  // Each import mode is a build of its own.
  rmSync(join(dir, '.intlayer'), { recursive: true, force: true });
  await vite(dir, { INTLAYER_IMPORT_MODE: importMode });
  return {
    dictionary: readFileSync(
      join(
        dir,
        '.intlayer',
        importMode === 'static'
          ? `dictionary/${INTLAYER_KEY}.json`
          : `dynamic_dictionary/json/${INTLAYER_KEY}/en.json`
      ),
      'utf8'
    ),
    harness: readFileSync(join(dir, `dist-${importMode}/harness.js`), 'utf8'),
  };
}
