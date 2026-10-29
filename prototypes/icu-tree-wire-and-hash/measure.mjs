// Times one case and prints µs per operation. bench.mjs runs each case in a
// fresh process, because JIT state left by earlier cases skews later ones (a
// 20 kB FNV-1a pass measured 4x slower after the corpus cases had run).
//
//   node measure.mjs <bundle.mjs> <corpus.txt> <case>
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadCorpus } from './corpus.mjs';

const [bundle, corpusPath, name] = process.argv.slice(2);
const lib = await import(pathToFileURL(bundle).href);
const { entries } = loadCorpus(lib, corpusPath);

const nodeSha = (s) =>
  createHash('sha256').update(s).digest('hex').slice(0, 16);
const sources = entries.map((e) => ({ source: e.icu, dataFormat: 'ICU' }));
// The CDN shape: { [hash]: value }.
const catalog = (pick) =>
  JSON.stringify(
    Object.fromEntries(entries.map((e) => [lib.hashString(e.icu), pick(e)]))
  );
const obj = (keys, len) =>
  Object.fromEntries(
    Array.from({ length: keys }, (_, i) => [`key_${i}`, 'x'.repeat(len)])
  );
const nest = (depth, breadth) =>
  depth
    ? Object.fromEntries(
        Array.from({ length: breadth }, (_, i) => [
          `k${i}`,
          nest(depth - 1, breadth),
        ])
      )
    : 'leaf';
const synthetic = {
  s5: obj(5, 10),
  s100: obj(100, 10),
  long: obj(20, 1000),
  deep: nest(4, 4),
};

// [function, items, repetitions per timed run]
const once = (fn) => [fn, [0], 200];
const parseCase = (pick, after = () => {}) => {
  const json = catalog(pick);
  return once(() => after(JSON.parse(json)));
};
const cases = {
  'parse:icu': parseCase((e) => e.icu),
  'parse:ast': parseCase((e) => e.ast),
  'parse:compact': parseCase((e) => e.compact),
  // Decode on load: parse compact, then convert every value to the AST once.
  'parse:compact-decode': parseCase(
    (e) => e.compact,
    (parsed) => {
      for (const key in parsed) parsed[key] = lib.fromCompact(parsed[key]);
    }
  ),
  'format:icu': [
    (e) => lib.formatMessage(e.icu, 'en', e.variables),
    entries,
    20,
  ],
  'format:ast': [(e) => lib.formatAst(e.ast, 'en', e.variables), entries, 20],
  'format:compact': [
    (e) => lib.formatCompact(e.compact, 'en', e.variables),
    entries,
    20,
  ],
  'format:decode': [
    (e) => lib.formatAst(lib.fromCompact(e.compact), 'en', e.variables),
    entries,
    20,
  ],
  'hash:default': [(s) => lib.hashSource(s), sources, 20],
  'hash:node': [(s) => lib.hashSource(s, nodeSha), sources, 20],
  'hash:fnv32': [(s) => lib.hashSource(s, undefined, 'fnv32'), sources, 20],
  'hash:linear': [(s) => lib.hashSource(s, undefined, 'linear'), sources, 20],
  'hash:json-only': [(s) => lib.stableStringify(s), sources, 20],
  'hash:fnv32-only': [(s) => lib.encodeForHash(s, 'fnv32'), sources, 20],
  'tree:ast': [(e) => lib.hashMessageTree(e.ast), entries, 20],
  'tree:compact': [(e) => lib.hashCompactTree(e.compact), entries, 20],
};
for (const [key, value] of Object.entries(synthetic)) {
  cases[`synthetic:${key}:default`] = [
    () => lib.hashString(lib.stableStringify(value)),
    [0],
    300,
  ];
  cases[`synthetic:${key}:fnv32`] = [
    () => lib.hashString(lib.encodeForHash(value, 'fnv32')),
    [0],
    300,
  ];
}

const [fn, items, reps] = cases[name];
for (let r = 0; r < 3; r++) for (const x of items) fn(x);
let best = Infinity;
for (let k = 0; k < 5; k++) {
  const t0 = performance.now();
  for (let r = 0; r < reps; r++) for (const x of items) fn(x);
  best = Math.min(
    best,
    ((performance.now() - t0) * 1000) / (reps * items.length)
  );
}
process.stdout.write(`${best}\n`);
