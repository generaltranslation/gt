// Builds one variant of a generated app, and measures what the build costs.
//   node scripts/load/build.mjs --app flat-5k --variant baseline
//     [--as name]                 the build's name, when it is not the variant's
//     [--env NAME=value]          added to the variant's environment; repeatable
//     [--compiler-options json]   merged over the variant's compiler options
//     [--init name]               a module of the app's src/init
//     [--locale fr-CA]            one locale of a hard-coded variant
//     [--runs 3]                  builds to time
// The build is written to apps/<app>/dist/<name>, or <name>.<locale> for a
// hard-coded variant, and its cost to results/load/build-<app>-<name>.json.
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { appsRoot } from './generate.mjs';
import { environment, summarize } from './stats.mjs';
import { TRANSLATION_FILES, variants } from './variants.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const viteBin = join(
  dirname(require.resolve('vite/package.json')),
  'bin',
  'vite.js'
);

const { values: args } = parseArgs({
  options: {
    app: { type: 'string' },
    variant: { type: 'string', default: 'baseline' },
    as: { type: 'string' },
    env: { type: 'string', multiple: true, default: [] },
    'compiler-options': { type: 'string' },
    init: { type: 'string' },
    locale: { type: 'string' },
    runs: { type: 'string', default: '1' },
    'translation-files': { type: 'string' },
  },
});

const variant = variants[args.variant];
if (!variant) throw new Error(`Unknown variant "${args.variant}"`);
if (!args.app) throw new Error('Pass --app, a directory of apps/');
const appDir = join(appsRoot, args.app);
const manifest = JSON.parse(
  readFileSync(join(appDir, 'public', 'bench-app.json'), 'utf8')
);
const name = args.as ?? args.variant;
const env = {
  ...variant.env,
  ...Object.fromEntries(
    args.env.map((pair) => {
      const at = pair.indexOf('=');
      return [pair.slice(0, at), pair.slice(at + 1)];
    })
  ),
};
const compilerOptions =
  variant.compilerOptions || args['compiler-options']
    ? {
        ...variant.compilerOptions,
        ...JSON.parse(args['compiler-options'] ?? '{}'),
      }
    : undefined;

/** `time` reports the peak memory of the process it ran, in its own format per OS. */
function timed(command, commandArgs, options) {
  const flag = process.platform === 'darwin' ? '-l' : '-v';
  const start = performance.now();
  const result = spawnSync('/usr/bin/time', [flag, command, ...commandArgs], {
    ...options,
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'pipe'],
  });
  const wallMs = performance.now() - start;
  const report = result.stderr ?? '';
  if (result.status !== 0) {
    process.stderr.write(report);
    throw new Error(`The build failed with status ${result.status}`);
  }
  const read = (pattern, scale) => {
    const match = report.match(pattern);
    return match ? Number(match[1]) * scale : undefined;
  };
  const statistics =
    process.platform === 'darwin'
      ? {
          peakRssBytes: read(/(\d+)\s+maximum resident set size/, 1),
          peakFootprintBytes: read(/(\d+)\s+peak memory footprint/, 1),
          cpuSeconds:
            read(/([\d.]+) user/, 1) + read(/([\d.]+) sys/, 1) || undefined,
        }
      : {
          peakRssBytes: read(
            /Maximum resident set size \(kbytes\): (\d+)/,
            1024
          ),
          cpuSeconds:
            read(/User time \(seconds\): ([\d.]+)/, 1) +
              read(/System time \(seconds\): ([\d.]+)/, 1) || undefined,
        };
  // What the build printed comes before the report of `time`.
  const output = report
    .slice(0, report.search(/^\s*([\d.]+ real\s|Command being timed)/m))
    .trim();
  if (output) process.stderr.write(`${output}\n`);
  return { wallMs, ...statistics };
}

// A translation file of any of the app's locales.
const translationFiles = new RegExp(
  (args['translation-files'] ?? TRANSLATION_FILES).replaceAll(
    '{locale}',
    `(${manifest.locales.join('|')})`
  )
);

/** The files of a build, counted by kind. */
function emitted(directory) {
  const kinds = { js: 0, translations: 0, other: 0 };
  let bytes = 0;
  for (const entry of readdirSync(directory, {
    recursive: true,
    withFileTypes: true,
  })) {
    // bench-app.json is this benchmark's own file, not the app's.
    if (!entry.isFile() || entry.name === 'bench-app.json') continue;
    const path = join(entry.parentPath, entry.name);
    const kind = translationFiles.test(path)
      ? 'translations'
      : /\.m?js$/.test(path)
        ? 'js'
        : 'other';
    kinds[kind]++;
    bytes += statSync(path).size;
  }
  return {
    files: kinds.js + kinds.translations + kinds.other,
    filesByKind: kinds,
    bytes,
  };
}

const builds = [];
const locales =
  variant.source === 'hardcoded'
    ? args.locale
      ? [args.locale]
      : manifest.hardcodedLocales
    : [undefined];
for (const locale of locales) {
  const target = locale ? `${name}.${locale}` : name;
  const outDir = join(appDir, 'dist', target);
  const runs = [];
  for (let run = 0; run < Number(args.runs); run++) {
    runs.push(
      timed(
        process.execPath,
        [
          viteBin,
          'build',
          '--config',
          join(root, 'vite.load.config.ts'),
          '--logLevel',
          'warn',
        ],
        {
          cwd: appDir,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            ...env,
            BENCH_LOAD_BUILD: JSON.stringify({
              source: locale ? `${variant.source}/${locale}` : variant.source,
              init: args.init ?? variant.init,
              compilerOptions,
              outDir,
              graph: `${outDir}.graph.json`,
            }),
          },
        }
      )
    );
  }
  const megabytes = (bytes) => (bytes / 2 ** 20).toFixed(0);
  const wall = summarize(runs.map((run) => run.wallMs));
  const rss = summarize(runs.map((run) => run.peakRssBytes));
  const output = emitted(outDir);
  builds.push({
    target,
    locale,
    outDir: relative(root, outDir),
    runs,
    wallMs: wall,
    peakRssBytes: rss,
    ...output,
  });
  const { js, translations, other } = output.filesByKind;
  console.log(
    `${args.app} ${target}: ${(wall.median / 1000).toFixed(2)} s, ${megabytes(rss.median)} MB peak, ${output.files} files (${js} JS, ${translations} translations, ${other} other), ${megabytes(output.bytes)} MB (median of ${wall.n})`
  );
}

mkdirSync(join(root, 'results', 'load'), { recursive: true });
writeFileSync(
  join(root, 'results', 'load', `build-${args.app}-${name}.json`),
  JSON.stringify(
    {
      kind: 'build',
      ...environment(),
      app: args.app,
      messages: manifest.messages,
      locales: manifest.locales,
      name,
      variant: args.variant,
      env,
      compilerOptions,
      init: args.init ?? variant.init,
      builds,
    },
    null,
    2
  ) + '\n'
);
