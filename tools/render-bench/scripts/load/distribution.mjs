// Reads how a build spreads an app's messages over its chunks, and what each
// lazy chunk would load of one locale's translations if they were split.
//   node scripts/load/distribution.mjs --dist apps/app-70k/dist/baseline
//     [--locale fr-CA]
//     [--catalog file]   the locale's translations by hash; default the
//                        generated app's src/_gt/<locale>.json
//     [--graph file]     the module graph that build.mjs writes next to a
//                        build; default <dist>.graph.json
// Two ways to split are compared for every lazy chunk (a route, or a chunk
// that an interaction loads): by chunk, where it loads the translations of
// every chunk it imports, and by module, where it loads those of the modules
// that its own module reaches through static imports. The second needs the
// graph. Sizes are compact JSON with gzip at level 6.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { GZIP_LEVEL } from './serve.mjs';
import { TRANSLATION_FILES } from './variants.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HASHES = /(?<![0-9a-f])[0-9a-f]{16}(?![0-9a-f])/g;
const STATIC_IMPORTS = /(?:\bfrom|\bimport)\s*["'`](\.{1,2}\/[^"'`]+)["'`]/g;
const DYNAMIC_IMPORTS = /\bimport\(\s*["'`](\.{1,2}\/[^"'`]+)["'`]\s*\)/g;

const { values: args } = parseArgs({
  options: {
    dist: { type: 'string' },
    locale: { type: 'string', default: 'fr-CA' },
    catalog: { type: 'string' },
    graph: { type: 'string' },
    out: { type: 'string' },
  },
});
if (!args.dist) throw new Error('Pass --dist, a built app');
const dist = resolve(args.dist);
const manifestPath = join(dist, 'bench-app.json');
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : {};
const catalogPath =
  args.catalog ?? join(dist, '..', '..', 'src', '_gt', `${args.locale}.json`);
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const graphPath = args.graph ?? `${dist}.graph.json`;
const graph = existsSync(graphPath)
  ? JSON.parse(readFileSync(graphPath, 'utf8'))
  : undefined;

/** The size of a translation file that holds these messages. */
function translationBytes(hashes) {
  if (hashes.size === 0) return 0;
  const entries = {};
  for (const hash of hashes) entries[hash] = catalog[hash];
  return gzipSync(JSON.stringify(entries), { level: GZIP_LEVEL }).length;
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return sorted.length
    ? { n: sorted.length, median: at(0.5), p95: at(0.95), max: sorted.at(-1) }
    : { n: 0, median: 0, p95: 0, max: 0 };
}

const union = (sets) => {
  const all = new Set();
  for (const set of sets) for (const value of set) all.add(value);
  return all;
};

/** Everything reachable from `start` through `edges`, `start` included. */
function closure(start, edges) {
  const reached = new Set([start]);
  for (const node of reached) {
    for (const next of edges(node) ?? []) reached.add(next);
  }
  return reached;
}

// ===== Chunks ===== //

// A catalog's chunk holds translations, not messages of its own.
const anyLocale = new RegExp(
  TRANSLATION_FILES.replaceAll('{locale}', '[A-Za-z]{2,3}(-[A-Za-z0-9]+)*')
);
const chunks = new Map();
for (const entry of readdirSync(dist, {
  recursive: true,
  withFileTypes: true,
})) {
  const path = join(entry.parentPath, entry.name);
  const file = relative(dist, path).split('\\').join('/');
  if (!entry.isFile() || !/\.m?js$/.test(file) || anyLocale.test(`/${file}`)) {
    continue;
  }
  const code = readFileSync(path, 'utf8');
  const imports = (pattern) =>
    Array.from(code.matchAll(pattern), (match) =>
      posix.join(posix.dirname(file), match[1])
    );
  chunks.set(file, {
    hashes: new Set(
      (code.match(HASHES) ?? []).filter((hash) => Object.hasOwn(catalog, hash))
    ),
    imports: imports(STATIC_IMPORTS),
    dynamicImports: imports(DYNAMIC_IMPORTS),
  });
}
for (const chunk of chunks.values())
  chunk.bytes = translationBytes(chunk.hashes);

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entryFile = /<script[^>]+type="module"[^>]+src="\/?([^"]+)"/.exec(
  html
)?.[1];
if (!chunks.has(entryFile)) throw new Error('index.html names no entry chunk');
const chunkClosure = (file) =>
  closure(file, (node) => chunks.get(node)?.imports);
const entryChunks = chunkClosure(entryFile);
const entryHashes = union(
  [...entryChunks].map((file) => chunks.get(file).hashes)
);

const withMessages = [...chunks.values()].filter((chunk) => chunk.hashes.size);
const allHashes = union(withMessages.map((chunk) => chunk.hashes));
const copies = new Map();
for (const chunk of withMessages) {
  for (const hash of chunk.hashes)
    copies.set(hash, (copies.get(hash) ?? 0) + 1);
}
const repeated = [...copies.values()].filter((count) => count > 1);

// ===== Lazy chunks ===== //

const lazyFiles = [
  ...new Set([...chunks.values()].flatMap((chunk) => chunk.dynamicImports)),
].filter((file) => chunks.has(file));

/** The app's own modules that `id` reaches through static imports. */
const moduleClosure = (id) =>
  closure(id, (node) => graph.modules[node]?.imports);
const moduleHashes = (ids) =>
  union(
    [...ids].map(
      (id) =>
        new Set(
          (graph.modules[id]?.hashes ?? []).filter((hash) =>
            Object.hasOwn(catalog, hash)
          )
        )
    )
  );
const entryModule = graph && graph.chunks[entryFile]?.facade;
const entryModuleHashes = graph
  ? moduleHashes(
      // Vite's entry is the HTML file; its modules are the entry chunk's.
      union(graph.chunks[entryFile].modules.map((id) => moduleClosure(id)))
    )
  : undefined;

// ===== The translation files a build wrote ===== //

// A build that writes a translation file per chunk says in a manifest which
// files a lazy chunk loads; what follows reads those files as they are.
const MANIFEST = 'gt-chunk-translations.json';
const manifestFile = readdirSync(dist, { recursive: true }).find(
  (file) => basename(file) === MANIFEST
);
const emitted =
  manifestFile && JSON.parse(readFileSync(join(dist, manifestFile), 'utf8'));
const emittedFiles = new Map();
function emittedFile(file) {
  if (!emittedFiles.has(file)) {
    const source = readFileSync(join(dist, file));
    const content = JSON.parse(source);
    emittedFiles.set(file, {
      bytes: gzipSync(source, { level: GZIP_LEVEL }).length,
      // An entry's file holds its translations under `t`.
      hashes: Object.keys(content.t ?? content),
    });
  }
  return emittedFiles.get(file);
}
/** The files of the locale that the build has a lazy chunk load. */
function emittedFor(file) {
  const files = (emitted.imports[file] ?? []).flatMap(
    (key) => emitted.files[key]?.[args.locale] ?? []
  );
  return {
    files: files.length,
    messages: union(files.map((name) => emittedFile(name).hashes)).size,
    bytes: files.reduce((sum, name) => sum + emittedFile(name).bytes, 0),
  };
}

const lazy = lazyFiles.map((file) => ({
  ...measureLazy(file),
  ...(emitted ? { emitted: emittedFor(file) } : {}),
}));

function measureLazy(file) {
  const loaded = [...chunkClosure(file)].filter(
    (chunk) => !entryChunks.has(chunk)
  );
  const byChunk = {
    chunks: loaded.length,
    files: loaded.filter((chunk) => chunks.get(chunk).hashes.size).length,
    messages: union(loaded.map((chunk) => chunks.get(chunk).hashes)).size,
    bytes: loaded.reduce((sum, chunk) => sum + chunks.get(chunk).bytes, 0),
  };
  const facade = graph?.chunks[file]?.facade;
  if (!facade) return { file, byChunk };
  const reached = moduleHashes(moduleClosure(facade));
  for (const hash of entryModuleHashes) reached.delete(hash);
  return {
    file,
    module: facade,
    byChunk,
    byModule: { messages: reached.size, bytes: translationBytes(reached) },
  };
}

function emittedSummary() {
  const entryName = emitted.entries[entryFile]?.translations[args.locale];
  const names = Object.values(emitted.files).flatMap(
    (byLocale) => byLocale[args.locale] ?? []
  );
  const sizes = names.map((name) => emittedFile(name).bytes);
  const reachable = lazy.filter((entry) => entry.byModule?.bytes);
  return {
    entry: entryName
      ? {
          file: entryName,
          messages: emittedFile(entryName).hashes.length,
          bytes: emittedFile(entryName).bytes,
        }
      : undefined,
    files: names.length,
    fileBytes: summarize(sizes),
    filesUnder1KiB: sizes.filter((bytes) => bytes < 1024).length,
    bytesOfAllFiles: sizes.reduce((a, b) => a + b, 0),
    lazy: {
      files: summarize(lazy.map((entry) => entry.emitted.files)),
      messages: summarize(lazy.map((entry) => entry.emitted.messages)),
      bytes: summarize(lazy.map((entry) => entry.emitted.bytes)),
      // How many times what its module reaches a lazy chunk loads.
      timesByModule: summarize(
        reachable.map(
          (entry) =>
            Math.round((100 * entry.emitted.bytes) / entry.byModule.bytes) / 100
        )
      ),
    },
  };
}

// ===== Report ===== //

const kib = (bytes) => (bytes / 1024).toFixed(1);
const share = (part, whole) => `${((100 * part) / whole).toFixed(1)}%`;
const line = (summary, format = String) =>
  `median ${format(summary.median)}, p95 ${format(summary.p95)}, max ${format(summary.max)}`;

const perChunk = summarize(withMessages.map((chunk) => chunk.hashes.size));
const fileBytes = summarize(withMessages.map((chunk) => chunk.bytes));
const results = {
  kind: 'distribution',
  app: manifest.name,
  label: basename(dist),
  dist: args.dist,
  locale: args.locale,
  compression: `gzip, level ${GZIP_LEVEL}, of compact JSON`,
  catalog: {
    messages: Object.keys(catalog).length,
    bytes: translationBytes(new Set(Object.keys(catalog))),
  },
  chunks: {
    total: chunks.size,
    withMessages: withMessages.length,
    messagesPerChunk: perChunk,
    translationFileBytes: fileBytes,
    translationFilesUnder1KiB: withMessages.filter(
      (chunk) => chunk.bytes < 1024
    ).length,
    translationBytesOfAllFiles: withMessages.reduce(
      (sum, chunk) => sum + chunk.bytes,
      0
    ),
  },
  messages: {
    inChunks: allHashes.size,
    inMoreThanOneChunk: repeated.length,
    inTwoChunks: repeated.filter((count) => count === 2).length,
    inThreeToTenChunks: repeated.filter((count) => count > 2 && count <= 10)
      .length,
    inElevenOrMoreChunks: repeated.filter((count) => count > 10).length,
    mostChunks: Math.max(1, ...repeated),
  },
  entry: {
    file: entryFile,
    module: entryModule,
    chunks: entryChunks.size,
    messages: entryHashes.size,
    bytes: translationBytes(entryHashes),
  },
  lazy: {
    chunks: lazy.length,
    byChunk: {
      chunksLoaded: summarize(lazy.map((entry) => entry.byChunk.chunks)),
      translationFiles: summarize(lazy.map((entry) => entry.byChunk.files)),
      messages: summarize(lazy.map((entry) => entry.byChunk.messages)),
      bytes: summarize(lazy.map((entry) => entry.byChunk.bytes)),
    },
    ...(graph
      ? {
          byModule: {
            messages: summarize(lazy.map((entry) => entry.byModule.messages)),
            bytes: summarize(lazy.map((entry) => entry.byModule.bytes)),
            bytesOfAllFiles: lazy.reduce(
              (sum, entry) => sum + entry.byModule.bytes,
              0
            ),
          },
        }
      : {}),
    ...(emitted ? { emitted: emittedSummary() } : {}),
    // The routes that measure.mjs visits, when the build says which.
    visited: Object.entries(manifest.visitModules ?? {}).flatMap(
      ([route, file]) => {
        const entry = lazy.find((candidate) =>
          candidate.module?.endsWith(`/${file}`)
        );
        return entry ? [{ route, ...entry }] : [];
      }
    ),
  },
};

const out =
  args.out ??
  join(
    root,
    'results',
    'load',
    `distribution-${manifest.name ?? 'dist'}-${basename(dist)}.json`
  );
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(results, null, 2) + '\n');

const {
  catalog: whole,
  chunks: chunk,
  messages,
  entry,
  lazy: lazyChunks,
} = results;
console.log(
  [
    `${results.app ?? results.dist} ${results.label}, ${results.locale}: ${whole.messages} messages, whole catalog ${kib(whole.bytes)} KiB (${results.compression})`,
    `Chunks: ${chunk.total} of JavaScript, ${chunk.withMessages} with messages. Messages per chunk with any: ${line(chunk.messagesPerChunk)}.`,
    `A translation file per chunk: ${line(chunk.translationFileBytes, kib)} KiB; ${chunk.translationFilesUnder1KiB} of ${chunk.withMessages} under 1 KiB; all of them together ${kib(chunk.translationBytesOfAllFiles)} KiB, ${share(chunk.translationBytesOfAllFiles, whole.bytes)} of the catalog.`,
    `Messages in more than one chunk: ${messages.inMoreThanOneChunk} of ${messages.inChunks} (${share(messages.inMoreThanOneChunk, messages.inChunks)}): ${messages.inTwoChunks} in 2, ${messages.inThreeToTenChunks} in 3 to 10, ${messages.inElevenOrMoreChunks} in 11 or more, at most in ${messages.mostChunks}.`,
    `Entry graph (${entry.chunks} chunks loaded with the HTML): ${entry.messages} messages, ${share(entry.messages, messages.inChunks)} of all, ${kib(entry.bytes)} KiB of translations.`,
    `Lazy chunks: ${lazyChunks.chunks}. What one loads beyond the entry graph, split by chunk: ${line(lazyChunks.byChunk.chunksLoaded)} chunks, ${line(lazyChunks.byChunk.translationFiles)} translation files, ${line(lazyChunks.byChunk.messages)} messages, ${line(lazyChunks.byChunk.bytes, kib)} KiB.`,
    ...(lazyChunks.byModule
      ? [
          `Split by module: one file per lazy chunk, ${line(lazyChunks.byModule.messages)} messages, ${line(lazyChunks.byModule.bytes, kib)} KiB; all of them together ${kib(lazyChunks.byModule.bytesOfAllFiles)} KiB, ${share(lazyChunks.byModule.bytesOfAllFiles, whole.bytes)} of the catalog.`,
        ]
      : ['No module graph: the split by module is not computed.']),
    ...(lazyChunks.emitted
      ? [
          `As built: ${lazyChunks.emitted.files} translation files of the locale besides the entry's (${lazyChunks.emitted.entry?.messages ?? 0} messages, ${kib(lazyChunks.emitted.entry?.bytes ?? 0)} KiB); ${line(lazyChunks.emitted.fileBytes, kib)} KiB; ${lazyChunks.emitted.filesUnder1KiB} under 1 KiB; all of them together ${kib(lazyChunks.emitted.bytesOfAllFiles)} KiB, ${share(lazyChunks.emitted.bytesOfAllFiles, whole.bytes)} of the catalog.`,
          `As built, a lazy chunk loads ${line(lazyChunks.emitted.lazy.files)} files, ${line(lazyChunks.emitted.lazy.messages)} messages, ${line(lazyChunks.emitted.lazy.bytes, kib)} KiB` +
            (lazyChunks.byModule
              ? `: ${line(lazyChunks.emitted.lazy.timesByModule)} times the split by module.`
              : '.'),
        ]
      : []),
    ...lazyChunks.visited.map(
      (visited) =>
        `${visited.route}: by chunk ${visited.byChunk.messages} messages in ${visited.byChunk.files} files, ${kib(visited.byChunk.bytes)} KiB` +
        (visited.byModule
          ? `; by module ${visited.byModule.messages} messages, ${kib(visited.byModule.bytes)} KiB`
          : '') +
        (visited.emitted
          ? `; as built ${visited.emitted.messages} messages in ${visited.emitted.files} files, ${kib(visited.emitted.bytes)} KiB`
          : '')
    ),
  ].join('\n')
);
