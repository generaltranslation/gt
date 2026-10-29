// Compares ICU strings, the formatjs AST tree and the compact tree, and
// today's hash against the XOR + FNV-1a proposal. Prints Markdown.
//
//   node prototypes/icu-tree-wire-and-hash/bench.mjs [corpus.txt]
//
// A corpus is one ICU message per line; the default is sample-corpus.txt.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { loadCorpus } from './corpus.mjs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const here = new URL('.', import.meta.url).pathname;
const root = join(here, '../..');
const tsdown = createRequire(join(root, 'packages/icu/package.json')).resolve(
  'tsdown'
);
const { rolldown } = await import(createRequire(tsdown).resolve('rolldown'));
const out = mkdtempSync(join(tmpdir(), 'gt-proto-'));

async function bundle(input, { minify = false, name = 'bundle' } = {}) {
  const build = await rolldown({ input, platform: 'node', logLevel: 'silent' });
  const { output } = await build.generate({ format: 'esm', minify });
  const file = join(out, `${name}.mjs`);
  writeFileSync(file, output[0].code);
  return { file, code: output[0].code };
}

const libFile = (await bundle(join(here, 'entry.ts'))).file;
const lib = await import(pathToFileURL(libFile).href);
// µs per operation, timed in a fresh process (see measure.mjs).
const run = (name) =>
  Number(
    execFileSync(
      process.execPath,
      [join(here, 'measure.mjs'), libFile, corpusPath, name],
      { encoding: 'utf8' }
    )
  );

// ---------- corpus ----------
const corpusPath = process.argv[2] ?? join(here, 'sample-corpus.txt');
const { entries, skipped } = loadCorpus(lib, corpusPath);

const count = (k) => entries.filter((e) => e.kind === k).length;
const lines = [];
const log = (s = '') => lines.push(s);
const table = (head, rows) => {
  log(`| ${head.join(' | ')} |`);
  log(`|${head.map((_, i) => (i ? '---:' : '---')).join('|')}|`);
  for (const r of rows) log(`| ${r.join(' | ')} |`);
  log();
};
const kb = (n) => (n / 1000).toFixed(1) + ' kB';
const gz = (s) => gzipSync(s, { level: 9 }).length;
const br = (s) =>
  brotliCompressSync(s, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
    .length;

const us = (n) => n.toFixed(2) + ' µs';

log(
  `Corpus: ${entries.length} messages (${count('plain')} plain, ${count('args')} with arguments, ${count('branches')} with branches), ${skipped} unparseable skipped.`
);
log();

// ---------- 1. wire size ----------
log('## 1. Wire size');
log();
log('A catalog is `{ [hash]: value }` JSON, as the CDN serves it.');
log();
const formats = {
  'ICU string': (e) => e.icu,
  'AST tree (current)': (e) => e.ast,
  'compact tree': (e) => e.compact,
};
const sizeRows = (subset) => {
  const base = {};
  return Object.entries(formats).map(([name, pick], i) => {
    const json = JSON.stringify(
      Object.fromEntries(subset.map((e) => [lib.hashString(e.icu), pick(e)]))
    );
    const r = [Buffer.byteLength(json), gz(json), br(json)];
    if (!i) [base.raw, base.gz] = r;
    return [
      name,
      kb(r[0]),
      kb(r[1]),
      kb(r[2]),
      (r[0] / base.raw).toFixed(2) + 'x',
      (r[1] / base.gz).toFixed(2) + 'x',
    ];
  });
};
table(
  ['All messages', 'raw', 'gzip', 'brotli', 'raw vs ICU', 'gzip vs ICU'],
  sizeRows(entries)
);
const nonPlain = entries.filter((e) => e.kind !== 'plain');
if (nonPlain.length)
  table(
    [
      'Arguments or branches only',
      'raw',
      'gzip',
      'brotli',
      'raw vs ICU',
      'gzip vs ICU',
    ],
    sizeRows(nonPlain)
  );
table(
  ['Mean value bytes', ...Object.keys(formats)],
  ['plain', 'args', 'branches'].filter(count).map((k) => [
    k,
    ...Object.values(formats).map((pick) => {
      const s = entries
        .filter((e) => e.kind === k)
        .map((e) => Buffer.byteLength(JSON.stringify(pick(e))));
      return (s.reduce((a, b) => a + b, 0) / s.length).toFixed(0);
    }),
  ])
);

// ---------- 2. runtime cost ----------
log('## 2. Client cost');
log();
table(
  ['JSON.parse of the `{ [hash]: value }` catalog', 'time'],
  [
    ['ICU string', us(run('parse:icu'))],
    ['AST tree (current)', us(run('parse:ast'))],
    ['compact tree', us(run('parse:compact'))],
    [
      'compact tree, decoded to the AST on load',
      us(run('parse:compact-decode')),
    ],
  ]
);
table(
  ['Render every message once (en)', 'µs per message'],
  [
    ['ICU string: formatMessage (parses each call)', us(run('format:icu'))],
    ['AST tree: formatAst', us(run('format:ast'))],
    ['compact tree: formatCompact', us(run('format:compact'))],
    [
      'compact tree: formatAst(fromCompact()) (decodes on every render)',
      us(run('format:decode')),
    ],
  ]
);
for (const e of entries) {
  const want = JSON.stringify(lib.formatAst(e.ast, 'en', e.variables));
  if (JSON.stringify(lib.formatCompact(e.compact, 'en', e.variables)) !== want)
    throw new Error(`format mismatch: ${e.icu}`);
}

const src = (p) => JSON.stringify(join(root, 'packages', p));
const sizeOf = async (name, code) => {
  const file = join(out, `${name}.ts`);
  writeFileSync(file, code);
  const { code: min } = await bundle(file, {
    minify: true,
    name: `${name}.min`,
  });
  return [Buffer.byteLength(min), gz(min)];
};
const bundles = [
  [
    'formatAst (AST tree today)',
    `export { formatAst } from ${src('icu/src/formatter/formatAst.ts')};`,
  ],
  [
    'formatCompact',
    `export { formatCompact } from ${src('icu/src/prototype/formatCompact.ts')};`,
  ],
  [
    'fromCompact + formatAst',
    `export { formatAst } from ${src('icu/src/formatter/formatAst.ts')}; export { fromCompact } from ${src('icu/src/prototype/compactTree.ts')};`,
  ],
  [
    'formatMessage (parser + formatter)',
    `export { formatMessage } from ${src('icu/src/parser.ts')};`,
  ],
  [
    'validateMessageTree (AST, not ported)',
    `export { validateMessageTree } from ${src('icu/src/tree/validateMessageTree.ts')};`,
  ],
];
const bundleRows = [];
for (const [name, code] of bundles) {
  const [raw, g] = await sizeOf(name.replace(/\W+/g, '-'), code);
  bundleRows.push([name, kb(raw), kb(g)]);
}
table(['Minified bundle', 'raw', 'gzip'], bundleRows);

// ---------- 3. hashing ----------
log('## 3. Hashing');
log();
const nodeSha = (s) =>
  createHash('sha256').update(s).digest('hex').slice(0, 16);
const sources = entries.map((e) => ({ source: e.icu, dataFormat: 'ICU' }));
if (!sources.every((s) => lib.hashSource(s, nodeSha) === lib.hashSource(s)))
  throw new Error('node:crypto differs');
table(
  ['hashSource on corpus strings', 'per message'],
  [
    ['default (sorted JSON + SHA-256, @noble/hashes)', us(run('hash:default'))],
    [
      'default with node:crypto SHA-256 (identical hashes)',
      us(run('hash:node')),
    ],
    ['fnv32 (proposal)', us(run('hash:fnv32'))],
    ['linear (proposal, SHA-256 per pair)', us(run('hash:linear'))],
    ['&nbsp;&nbsp;sorted JSON alone', us(run('hash:json-only'))],
    ['&nbsp;&nbsp;fnv32 encoding alone', us(run('hash:fnv32-only'))],
  ]
);
table(
  ['Tree hash on corpus messages', 'per message'],
  [
    ['hashMessageTree(AST)', us(run('tree:ast'))],
    ['hashCompactTree(compact)', us(run('tree:compact'))],
  ]
);

// The proposal's synthetic shapes, against the current serializer (not
// fast-json-stable-stringify, which core dropped in #1242).
table(
  ['Synthetic object', 'sorted JSON + SHA-256', 'fnv32 + SHA-256', 'speedup'],
  [
    ['5 keys × 10 chars', 's5'],
    ['100 keys × 10 chars', 's100'],
    ['20 keys × 1,000 chars', 'long'],
    ['depth 4 × breadth 4', 'deep'],
  ].map(([name, key]) => {
    const a = run(`synthetic:${key}:default`);
    const b = run(`synthetic:${key}:fnv32`);
    return [name, us(a), us(b), (a / b).toFixed(2) + 'x'];
  })
);

// ---------- 4. collisions ----------
log('## 4. Collisions');
log();
const trials = [];
for (let t = 0; t < 7; t++) {
  const seen = new Set();
  for (let i = 1; ; i++) {
    const h = lib.hashSource(
      {
        source: `Message ${randomBytes(9).toString('base64')}`,
        dataFormat: 'ICU',
      },
      undefined,
      'fnv32'
    );
    if (seen.has(h)) {
      trials.push(i);
      break;
    }
    seen.add(h);
  }
}
trials.sort((a, b) => a - b);
log(
  `fnv32: random messages hashed until the first collision, 7 trials: ${trials.join(', ')} (median ${trials[3]}). The default mode keeps 64 bits.`
);
log();
const p = (n, bits) => 1 - Math.exp(-(n * n) / (2 * 2 ** bits));
table(
  ['Entries', 'P(any collision), fnv32', 'P(any collision), default'],
  [4_000, 20_000, 100_000].map((n) => [
    n.toLocaleString('en'),
    (p(n, 32) * 100).toFixed(2) + '%',
    (p(n, 64) * 100).toExponential(0) + '%',
  ])
);

// Compact keys must group the shared fixture exactly like version 1 keys.
const fixture = JSON.parse(
  readFileSync(join(root, 'test-fixtures/icu-tree-wire-format.json'), 'utf8')
);
const groups = (hash) =>
  JSON.stringify(
    fixture.map((c) => fixture.findIndex((d) => hash(d) === hash(c)))
  );
const sameGroups =
  groups((c) => c.hash) ===
  groups((c) => lib.hashCompactTree(lib.toCompact(c.tree), c.options));
log(
  `Shared wire fixture: compact (v2) hashes group the ${fixture.length} cases exactly like v1 hashes: ${sameGroups ? 'yes' : 'NO'}.`
);

process.stdout.write(lines.join('\n') + '\n');
