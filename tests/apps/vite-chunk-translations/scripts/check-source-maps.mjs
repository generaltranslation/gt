// Builds the app with source maps, without the split and with each way of
// splitting, and checks that the bundler reports no broken source map and
// where positions in the chunks it emits map back to:
//   node scripts/check-source-maps.mjs
// Prints one line per check and exits with 1 when any fails.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let failed = 0;
function check(name, passed, detail = '') {
  if (!passed) failed++;
  console.log(
    `${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`
  );
}

/** Builds the app with source maps into a directory of .check and returns what the build printed. */
function build(name, env) {
  const outDir = join(root, '.check', 'source-maps', name);
  const { status, stdout, stderr } = spawnSync(
    'pnpm',
    ['exec', 'vite', 'build', '--logLevel', 'warn', '--sourcemap'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        CHECK_OUT_DIR: outDir,
        ...env,
      },
    }
  );
  // A bundler warns on the standard error
  const log = `${stdout}${stderr}`;
  if (status !== 0) throw new Error(`The build ${name} failed:\n${log}`);
  return { outDir, log };
}

/** The line and column of a text in a file of the app, as a source map counts them. */
function locate(file, text) {
  const lines = readFileSync(join(root, file), 'utf8').split('\n');
  const index = lines.findIndex((line) => line.includes(text));
  if (index === -1) throw new Error(`${file} does not hold ${text}`);
  return { line: index + 1, column: lines[index].indexOf(text) };
}

// A call the compiler wrote a message into: its hash or id, then the
// message, or the template that follows the call
const message = (text) =>
  new RegExp(
    `[\\w$]+\\(\\{\\$_hash:\`[^\`]+\`(?:,\\$_tree:\`${text}\`\\}\\)|\\}\\)\`${text}\`)`
  );

// Where a position of the emitted code is in the source: `emitted` matches
// the code at the position, `text` is at the position it maps to
const POSITIONS = [
  {
    name: 'the second of two t templates on one line',
    emitted: message('Closed'),
    file: 'src/App.tsx',
    text: 't`Closed`',
  },
  {
    name: 'a t template in JSX',
    emitted: message('Workspace overview'),
    file: 'src/App.tsx',
    text: 't`Workspace overview`',
  },
  {
    name: 'a template of the function useGT() returns',
    emitted: message('Billing moved to a new page'),
    file: 'src/App.tsx',
    text: 't`Billing moved to a new page`',
  },
  {
    name: 'a t template of a route',
    emitted: message('Recent orders'),
    file: 'src/routes/Orders.tsx',
    text: 't`Recent orders`',
  },
  // The split writes the chunks an import loads at the import once the
  // chunk is minified, which moves the rest of the chunk
  {
    name: 'a call after the dynamic imports of its chunk',
    emitted: /(?<=\.app\?\?=\[\]\)\.)push\(performance\.now\(\)\)/,
    file: 'src/App.tsx',
    text: 'push(performance.now())',
  },
  // The split rewrites the call that starts the app
  {
    name: 'a call after the one that starts the app',
    emitted: /document\.getElementById\(`root`\)/,
    file: 'src/main.tsx',
    text: "document.getElementById('root')",
  },
];

/** Checks each position in the chunk of a build that holds it. */
function checkPositions(name, outDir) {
  const assets = join(outDir, 'assets');
  const chunks = readdirSync(assets)
    .filter((file) => file.endsWith('.js'))
    .map((file) => ({
      file,
      lines: readFileSync(join(assets, file), 'utf8').split('\n'),
    }));
  for (const position of POSITIONS) {
    const label = `${name}: ${position.name} maps to its line and column of ${position.file}`;
    const found = chunks.flatMap(({ file, lines }) =>
      lines.flatMap((line, index) => {
        const match = position.emitted.exec(line);
        return match ? [{ file, line: index + 1, column: match.index }] : [];
      })
    );
    if (found.length !== 1) {
      check(label, false, `in the emitted code ${found.length} times`);
      continue;
    }
    const [{ file, line, column }] = found;
    const map = new TraceMap(
      readFileSync(join(assets, `${file}.map`), 'utf8'),
      // A source is relative to the map
      `file://${assets}/`
    );
    const original = originalPositionFor(map, { line, column });
    const expected = {
      source: `file://${join(root, position.file)}`,
      ...locate(position.file, position.text),
    };
    const describe = ({ source, line, column }) =>
      `${source?.replace(`file://${root}/`, '')}:${line}:${column}`;
    check(
      label,
      describe(original) === describe(expected),
      `${file}:${line}:${column} maps to ${describe(original)}, the source is at ${describe(expected)}`
    );
  }
}

// Each way of splitting, without and with hash minification, which writes
// an id into every call site after the bundler has rendered its chunk
const SPLITS = [
  ['split by chunk, named by a token', 'token', { CHECK_NAMING: 'token' }],
  ['split by chunk, named by a map', 'map', { CHECK_NAMING: 'map' }],
  ['split by module', 'module', { GT_SPLIT_TRANSLATIONS_BY: 'module' }],
  [
    'split by chunk, with a chunk import map',
    'import-map',
    { CHECK_NAMING: 'token', CHECK_IMPORT_MAP: 'true' },
  ],
];
const BUILDS = [
  ['without the split', 'off', { GT_SPLIT_TRANSLATIONS: 'false' }],
  ...SPLITS.flatMap(([name, directory, env]) =>
    [false, true].map((minified) => [
      `${name}${minified ? ', with hash minification' : ''}`,
      `${directory}${minified ? '-minified' : ''}`,
      {
        GT_SPLIT_TRANSLATIONS: 'true',
        GT_MINIFY_HASHES: String(minified),
        ...env,
      },
    ])
  ),
];

for (const [name, directory, env] of BUILDS) {
  const { outDir, log } = build(directory, env);
  check(
    `${name}: the bundler reports no broken source map`,
    !log.includes('SOURCEMAP_BROKEN'),
    `${log.split('SOURCEMAP_BROKEN').length - 1} times`
  );
  checkPositions(name, outDir);
}

if (failed) {
  console.error(`\n${failed} checks failed`);
  process.exit(1);
}
console.log('\nEvery check passed');
