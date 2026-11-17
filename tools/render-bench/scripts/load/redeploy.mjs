// What a returning user fetches again after a deploy that changed one
// translation: builds the app a second time with one message of one locale
// changed, then visits the routes on the first build and again once the
// second has replaced it.
//   node scripts/load/redeploy.mjs --app flat-5k --variant baseline [--locale fr-CA]
//     [--as name]     the first build, apps/<app>/dist/<name>; built when missing
//     [--env NAME=value] [--compiler-options json] [--init name]   as build.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { appsRoot } from './generate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const { values: args } = parseArgs({
  options: {
    app: { type: 'string' },
    variant: { type: 'string', default: 'baseline' },
    as: { type: 'string' },
    locale: { type: 'string', default: 'fr-CA' },
    env: { type: 'string', multiple: true, default: [] },
    'compiler-options': { type: 'string' },
    init: { type: 'string' },
  },
});
if (!args.app) throw new Error('Pass --app, a directory of apps/');
const name = args.as ?? args.variant;
const appDir = join(appsRoot, args.app);
const dist = (build) => join(appDir, 'dist', build);

function run(script, scriptArgs) {
  const result = spawnSync(
    process.execPath,
    [join(here, script), ...scriptArgs],
    { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] }
  );
  if (result.status !== 0) throw new Error(`${script} failed`);
}
const build = (as) =>
  run('build.mjs', [
    '--app',
    args.app,
    '--variant',
    args.variant,
    '--as',
    as,
    ...args.env.flatMap((pair) => ['--env', pair]),
    ...(args['compiler-options']
      ? ['--compiler-options', args['compiler-options']]
      : []),
    ...(args.init ? ['--init', args.init] : []),
  ]);

if (!existsSync(dist(name))) build(name);

// The second build differs by the translation of the catalog's last message
// that is plain text.
const catalogPath = join(appDir, 'src', '_gt', `${args.locale}.json`);
const original = readFileSync(catalogPath, 'utf8');
const catalog = JSON.parse(original);
const hash = Object.keys(catalog).findLast(
  (key) => typeof catalog[key] === 'string'
);
catalog[hash] = `${catalog[hash]} édited`;
try {
  writeFileSync(catalogPath, JSON.stringify(catalog));
  build(`${name}-redeploy`);
} finally {
  writeFileSync(catalogPath, original);
}

const out = join(
  root,
  'results',
  'load',
  `redeploy-${args.app}-${name}-${args.locale}.json`
);
run('measure.mjs', [
  '--dist',
  dist(name),
  '--redeploy',
  dist(`${name}-redeploy`),
  '--locale',
  args.locale,
  '--n',
  '1',
  '--networks',
  'none',
  '--label',
  name,
  '--out',
  out,
]);

const result = JSON.parse(readFileSync(out, 'utf8'));
const kib = (bytes) => (bytes / 1024).toFixed(1);
const { redeploy, bytes } = result;
const visit = (transfer) =>
  `${kib(transfer.total.bytes)} KiB in ${transfer.total.requests} requests (JavaScript ${kib(transfer.js.bytes + transfer.other.bytes)}, translations ${kib(transfer.translations.bytes)} in ${transfer.translations.requests}; gzip level ${result.gzipLevel}: ${kib(transfer.total.gzipBytes)} KiB)`;
console.log(
  [
    `${args.app} ${name}, ${args.locale}: one translation changed (${hash}).`,
    `Translation files of the locale with another URL: ${redeploy.translationFilesRenamed} of ${redeploy.translationFiles}. JavaScript files with another URL: ${redeploy.scriptsRenamed} of ${redeploy.scripts}.`,
    `First visit of ${result.routes.length} routes: ${visit(bytes.afterRoutes)}.`,
    `The same visit after the deploy: ${visit(redeploy.afterRoutes)}.`,
  ].join('\n')
);
