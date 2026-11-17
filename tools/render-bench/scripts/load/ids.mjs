// Estimates what shorter message ids would save in a build that writes a
// translation file per chunk: rewrites every id in the built JavaScript and
// translation files under each scheme, compresses the result, and counts
// what changes when the app gains messages.
//   node scripts/load/ids.mjs --dist apps/flat-5k/dist/sidecars-map
//     --result results/load/flat-5k-sidecars-map-fr-CA.json
//     --source-result results/load/flat-5k-sidecars-map-en.json
//     [--locale fr-CA]
//     [--added 0.01]   the share of new messages for the stability counts
//     [--write dir]    also write the build under each scheme that keeps
//                      keyed files, to load it with measure.mjs
// The results are those of measure.mjs for the build, with their lists of
// requests: they say which files a page loads. The schemes:
//   prefix      the shortest prefix of the hash that no other hash has, 4 or more
//   prefix6     the same, 6 characters or more
//   prefix8     the same, 8 characters or more
//   counter     a base-62 counter in the order of the hashes
//   positional  a translation file is an array, and a call site holds the
//               index of its message in the file of its chunk, in the order
//               the chunk's code first names each message
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { brotliCompress, constants, gzipSync } from 'node:zlib';
import { createRandom } from '../generate.mjs';
import { GZIP_LEVEL } from './serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const compress = promisify(brotliCompress);
const HASHES = /(?<![0-9a-f])[0-9a-f]{16}(?![0-9a-f])/g;
const QUOTED_HASHES = /([`"'])([0-9a-f]{16})\1/g;
const MANIFEST = 'gt-chunk-translations.json';
const PREFIXES = { prefix: 4, prefix6: 6, prefix8: 8 };
const KEYED = [...Object.keys(PREFIXES), 'counter'];
const SCHEMES = [...KEYED, 'positional'];
const SEEDS = [1, 2, 3, 4, 5];

const { values: args } = parseArgs({
  options: {
    dist: { type: 'string' },
    result: { type: 'string' },
    'source-result': { type: 'string' },
    locale: { type: 'string', default: 'fr-CA' },
    added: { type: 'string', default: '0.01' },
    write: { type: 'string' },
    out: { type: 'string' },
  },
});
if (!args.dist || !args.result || !args['source-result']) {
  throw new Error('Pass --dist, --result and --source-result');
}
const dist = resolve(args.dist);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const result = readJson(args.result);
const sourceResult = readJson(args['source-result']);

// ===== The build's files ===== //

const files = readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) =>
    join(entry.parentPath, entry.name)
      .slice(dist.length + 1)
      .split(sep)
      .join('/')
  );
const manifestFile = files.find((file) => basename(file) === MANIFEST);
if (!manifestFile) throw new Error(`The build has no ${MANIFEST}`);
const manifest = readJson(join(dist, manifestFile));
const entryFiles = (locale) =>
  Object.values(manifest.entries).flatMap(
    (entry) => entry.translations[locale] ?? []
  );
/** The translation files of a locale: its entries' and its chunks'. */
const translationFiles = (locale) => [
  ...entryFiles(locale),
  ...Object.values(manifest.files).flatMap(
    (byLocale) => byLocale[locale] ?? []
  ),
];
// A catalog's chunk is the app's own loader, which such a build never calls.
const scripts = files.filter(
  (file) => /\.m?js$/.test(file) && !/\/catalog\.[^/]+$/.test(file)
);
const localeFiles = translationFiles(args.locale);
const source = new Map(
  [...scripts, ...localeFiles].map((file) => [
    file,
    readFileSync(join(dist, file), 'utf8'),
  ])
);
/** The translations of a file by hash; an entry's file holds them under `t`. */
const translationsOf = (file) => {
  const content = JSON.parse(source.get(file));
  return content.t ?? content;
};
const keysByFile = new Map(
  localeFiles.map((file) => [file, Object.keys(translationsOf(file))])
);

// An id is a hash that a chunk's code passes and a translation file is keyed by.
const keyed = new Set([...keysByFile.values()].flat());
/** The ids a chunk's code names, in its order, once per place. */
const placesByChunk = new Map(
  scripts.map((file) => [
    file,
    (source.get(file).match(HASHES) ?? []).filter((hash) => keyed.has(hash)),
  ])
);
const hashes = [...new Set([...placesByChunk.values()].flat())].sort();
const ids = new Set(hashes);
const places = [...placesByChunk.values()].reduce(
  (sum, list) => sum + list.length,
  0
);

// The file of a chunk's own messages, and the entry's, which holds the
// messages that the build left out of every other file.
const [entryFile] = entryFiles(args.locale);
const fileOfChunk = new Map(
  scripts.flatMap((chunk) => {
    const file =
      manifest.entries[chunk]?.translations[args.locale] ??
      manifest.files[chunk.replace(/\.m?js$/, '')]?.[args.locale];
    return file ? [[chunk, file]] : [];
  })
);
const chunkOfFile = new Map(
  [...fileOfChunk].map(([chunk, file]) => [file, chunk])
);

// ===== Schemes with keyed files ===== //

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function counter(index) {
  let id = '';
  do {
    id = DIGITS[index % DIGITS.length] + id;
    index = Math.floor(index / DIGITS.length);
  } while (index > 0);
  return id;
}
const shared = (a, b) => {
  let length = 0;
  while (length < a.length && a[length] === b?.[length]) length++;
  return length;
};
/** The id of each hash of `sorted` under a scheme. */
function assign(scheme, sorted) {
  return new Map(
    sorted.map((hash, i) => {
      if (scheme === 'counter') return [hash, counter(i)];
      const unique =
        Math.max(shared(hash, sorted[i - 1]), shared(hash, sorted[i + 1])) + 1;
      return [hash, hash.slice(0, Math.max(PREFIXES[scheme], unique))];
    })
  );
}
function keyedRewrite(scheme) {
  const assigned = assign(scheme, hashes);
  return (_file, text) =>
    text.replace(HASHES, (hash) => assigned.get(hash) ?? hash);
}

// ===== Positional ===== //

/**
 * The index of each message of a file: in the order its chunk's code first
 * names them (`named`), then the ones the code does not name, which the build
 * copied in from a chunk without a file of its own.
 */
function positions(file, named) {
  const own = new Set(keysByFile.get(file));
  const order = new Map();
  for (const hash of [...named, ...own]) {
    if (own.has(hash) && !order.has(hash)) order.set(hash, order.size);
  }
  return order;
}
const positionsByFile = new Map(
  localeFiles.map((file) => [
    file,
    positions(file, placesByChunk.get(chunkOfFile.get(file)) ?? []),
  ])
);
/** Where a place in a chunk reads its message: its own file, else the entry's. */
function target(chunk, hash, byFile = positionsByFile) {
  const own = fileOfChunk.get(chunk);
  if (byFile.get(own)?.has(hash)) return [own, byFile.get(own).get(hash)];
  if (byFile.get(entryFile)?.has(hash)) {
    return [entryFile, byFile.get(entryFile).get(hash)];
  }
  return undefined;
}
// Places that one index cannot serve are those whose message is in neither
// file: the build copied it into the file of each chunk that loads this one.
const reads = { own: 0, entry: 0, neither: 0 };
for (const [chunk, list] of placesByChunk) {
  for (const hash of list) {
    const read = target(chunk, hash);
    if (!read) reads.neither++;
    else if (read[0] === fileOfChunk.get(chunk)) reads.own++;
    else reads.entry++;
  }
}
function positionalRewrite(file, text) {
  if (!keysByFile.has(file)) {
    return text.replace(QUOTED_HASHES, (quoted, _quote, hash) =>
      ids.has(hash) ? String(target(file, hash)?.[1] ?? quoted) : quoted
    );
  }
  const translations = translationsOf(file);
  const values = [...positionsByFile.get(file).keys()].map(
    (hash) => translations[hash]
  );
  return JSON.stringify(file === entryFile ? { t: values } : values);
}
// No id at all, and files without keys: what the others are measured against.
const noneRewrite = (file, text) =>
  keysByFile.has(file)
    ? JSON.stringify(Object.values(translationsOf(file)))
    : text.replace(HASHES, (hash) => (ids.has(hash) ? '' : hash));

// ===== Sizes ===== //

async function sizes(text) {
  const raw = Buffer.from(text);
  return {
    raw: raw.length,
    gzip: gzipSync(raw, { level: GZIP_LEVEL }).length,
    brotli: (
      await compress(raw, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
        },
      })
    ).length,
  };
}
const isMap = (file) => /\/gt-map\.[^/]+$/.test(`/${file}`);
const isScript = (file) => /\.m?js$/.test(file);
const requested = (transfer) =>
  transfer.files
    .filter((file) => file.status === 200)
    .map((file) => file.path.slice(1));
const firstLoad = requested(result.bytes.firstLoad);
const visit = requested(result.bytes.afterRoutes);
const sourceFirstLoad = requested(sourceResult.bytes.firstLoad);
const maps = files.filter(
  (file) => isMap(file) && file.includes(`.${args.locale}.`)
);
// The files whose size is asked for: the app's code, the locale's
// translations, and whatever else a page requested.
const measured = [
  ...new Set([
    ...scripts,
    ...localeFiles,
    ...maps,
    ...firstLoad,
    ...visit,
    ...sourceFirstLoad,
  ]),
];
const original = new Map(
  await Promise.all(
    measured.map(async (file) => [
      file,
      await sizes(source.get(file) ?? readFileSync(join(dist, file), 'utf8')),
    ])
  )
);
/** The size of every file under a scheme; a file it leaves alone keeps its own. */
async function sizesUnder(rewrite) {
  return new Map(
    await Promise.all(
      measured.map(async (file) => {
        const text = source.get(file);
        const rewritten = text === undefined ? undefined : rewrite(file, text);
        return [
          file,
          rewritten === undefined || rewritten === text
            ? original.get(file)
            : await sizes(rewritten),
        ];
      })
    )
  );
}
const rewrites = {
  ...Object.fromEntries(KEYED.map((scheme) => [scheme, keyedRewrite(scheme)])),
  positional: positionalRewrite,
  none: noneRewrite,
};
const variants = { original };
for (const [scheme, rewrite] of Object.entries(rewrites)) {
  variants[scheme] = await sizesUnder(rewrite);
}

const translations = (list) =>
  list.filter((file) => localeFiles.includes(file));
const columns = {
  'startup JS, first route': firstLoad.filter(isScript),
  'all JS': scripts,
  'translations, first load': translations(firstLoad),
  'translations, 3 routes': translations(visit),
  'all translation files of the locale': localeFiles,
  'map file': maps,
  [`first load, ${sourceResult.locale}`]: sourceFirstLoad,
  [`first load, ${args.locale}`]: firstLoad,
};
const total = (variant, list) => {
  const sum = { raw: 0, gzip: 0, brotli: 0 };
  for (const file of new Set(list)) {
    for (const kind of Object.keys(sum)) sum[kind] += variant.get(file)[kind];
  }
  return sum;
};
// What an id costs: the bytes a set of files has over the same files without
// ids, for each id written in it.
const cost = (variant, list, count) => {
  const having = total(variant, list);
  const without = total(variants.none, list);
  return Object.fromEntries(
    Object.keys(having).map((kind) => [
      kind,
      (having[kind] - without[kind]) / count,
    ])
  );
};
const entries = [...keysByFile.values()].reduce(
  (sum, keys) => sum + keys.filter((key) => ids.has(key)).length,
  0
);

// ===== Stability ===== //

const range = (values) => ({
  mean: values.reduce((a, b) => a + b, 0) / values.length,
  min: Math.min(...values),
  max: Math.max(...values),
});
/**
 * The app gains messages, each at a place of a chunk's code. The chunk and
 * its file change whatever the scheme. A scheme costs more when it changes
 * the id of a message that was there, and with it other files and chunks.
 */
function stability(seed) {
  const random = createRandom(seed);
  const chunks = [...fileOfChunk.keys()].filter(
    (chunk) => placesByChunk.get(chunk).length
  );
  const weights = chunks.map((chunk) => placesByChunk.get(chunk).length);
  const weight = weights.reduce((a, b) => a + b, 0);
  const pick = () => {
    let at = random() * weight;
    return chunks.find((_, i) => (at -= weights[i]) < 0) ?? chunks.at(-1);
  };
  const added = new Map();
  const count = Math.round(hashes.length * Number(args.added));
  for (let i = 0; i < count; i++) {
    const hash = Array.from({ length: 16 }, () =>
      Math.floor(random() * 16).toString(16)
    ).join('');
    const chunk = pick();
    added.set(chunk, [
      ...(added.get(chunk) ?? []),
      {
        hash,
        at: Math.floor(random() * (placesByChunk.get(chunk).length + 1)),
      },
    ]);
  }
  const gainedChunks = new Set(added.keys());
  const gainedFiles = new Set(
    [...gainedChunks].map((chunk) => fileOfChunk.get(chunk))
  );
  const beyond = (changedFiles, changedChunks) => ({
    files: changedFiles.filter((file) => !gainedFiles.has(file)).length,
    chunks: changedChunks.filter((chunk) => !gainedChunks.has(chunk)).length,
  });

  const newHashes = [...added.values()].flat().map(({ hash }) => hash);
  const all = [...new Set([...hashes, ...newHashes])].sort();
  const keyedSchemes = Object.fromEntries(
    KEYED.map((scheme) => {
      const before = assign(scheme, hashes);
      const after = assign(scheme, all);
      const changed = new Set(
        hashes.filter((hash) => before.get(hash) !== after.get(hash))
      );
      return [
        scheme,
        {
          ids: changed.size,
          ...beyond(
            localeFiles.filter((file) =>
              keysByFile.get(file).some((key) => changed.has(key))
            ),
            scripts.filter((chunk) =>
              placesByChunk.get(chunk).some((hash) => changed.has(hash))
            )
          ),
        },
      ];
    })
  );

  // Positional, with every index assigned again: a new message moves the
  // indices of the messages its chunk names after it.
  const after = new Map(positionsByFile);
  for (const [chunk, messages] of added) {
    const named = [...placesByChunk.get(chunk)];
    for (const { hash, at } of messages.sort((a, b) => b.at - a.at)) {
      named.splice(at, 0, hash);
    }
    const file = fileOfChunk.get(chunk);
    const own = new Set([...keysByFile.get(file), ...newHashes]);
    const order = new Map();
    for (const hash of [...named, ...keysByFile.get(file)]) {
      if (own.has(hash) && !order.has(hash)) order.set(hash, order.size);
    }
    after.set(file, order);
  }
  const moved = (file) =>
    [...positionsByFile.get(file)].filter(
      ([hash, index]) => after.get(file).get(hash) !== index
    ).length;
  const positional = {
    ids: localeFiles.reduce((sum, file) => sum + moved(file), 0),
    ...beyond(
      localeFiles.filter((file) => moved(file) > 0),
      scripts.filter((chunk) =>
        placesByChunk.get(chunk).some((hash) => {
          const was = target(chunk, hash);
          const is = target(chunk, hash, after);
          return was && (was[0] !== is?.[0] || was[1] !== is?.[1]);
        })
      )
    ),
  };
  return {
    gained: { files: gainedFiles.size, chunks: gainedChunks.size },
    ...keyedSchemes,
    positional,
    // A message that was there keeps its index, and a new one takes the next.
    'positional, append-only': { ids: 0, files: 0, chunks: 0 },
  };
}
const runs = SEEDS.map(stability);
const stabilityRows = Object.keys(runs[0]).filter((row) => row !== 'gained');

// ===== Report ===== //

const idLength = (scheme) => {
  const assigned = [...assign(scheme, hashes).values()];
  return {
    mean: assigned.reduce((sum, id) => sum + id.length, 0) / assigned.length,
    max: Math.max(...assigned.map((id) => id.length)),
  };
};
const rows = ['original', ...SCHEMES];
const results = {
  kind: 'ids',
  app: result.app,
  label: result.label,
  packages: result.packages,
  locale: args.locale,
  ids: hashes.length,
  placesInJs: places,
  entriesInTranslationFiles: entries,
  translationFiles: localeFiles.length,
  chunks: scripts.length,
  // Where a place in the JavaScript would read its message under `positional`.
  positionalReads: reads,
  compression: `brotli quality 11, gzip level ${GZIP_LEVEL}`,
  idLength: Object.fromEntries(
    KEYED.map((scheme) => [scheme, idLength(scheme)])
  ),
  sizes: Object.fromEntries(
    rows.map((scheme) => [
      scheme,
      Object.fromEntries(
        Object.entries(columns).map(([name, list]) => [
          name,
          total(variants[scheme], list),
        ])
      ),
    ])
  ),
  idCost: Object.fromEntries(
    rows.map((scheme) => [
      scheme,
      {
        perPlaceInJs: cost(variants[scheme], scripts, places),
        perTranslationEntry: cost(variants[scheme], localeFiles, entries),
      },
    ])
  ),
  stability: {
    added: Number(args.added),
    seeds: SEEDS.length,
    gained: {
      files: range(runs.map((run) => run.gained.files)),
      chunks: range(runs.map((run) => run.gained.chunks)),
    },
    ...Object.fromEntries(
      stabilityRows.map((row) => [
        row,
        Object.fromEntries(
          ['ids', 'files', 'chunks'].map((kind) => [
            kind,
            range(runs.map((run) => run[row][kind])),
          ])
        ),
      ])
    ),
  },
};

const out =
  args.out ??
  join(root, 'results', 'load', `ids-${result.app}-${result.label}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(results, null, 2) + '\n');

if (args.write) {
  for (const scheme of KEYED) {
    const directory = join(resolve(args.write), scheme);
    cpSync(dist, directory, { recursive: true });
    const rewritten = [
      ...scripts,
      ...manifest.locales.flatMap((locale) => translationFiles(locale)),
    ];
    for (const file of new Set(rewritten)) {
      writeFileSync(
        join(directory, file),
        rewrites[scheme](file, readFileSync(join(dist, file), 'utf8'))
      );
    }
  }
}

const kib = (bytes) => (bytes / 1024).toFixed(1);
const cell = (size) => `${kib(size.brotli)} (${kib(size.gzip)})`;
const bytes = (size) => `${size.brotli.toFixed(1)} (${size.gzip.toFixed(1)})`;
const spread = ({ mean, min, max }) => `${mean.toFixed(0)} (${min}–${max})`;
const table = (header, body) =>
  [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
const { stability: stable } = results;
console.log(
  [
    `${results.app} ${results.label}${results.packages ? ` (${results.packages})` : ''}, ${results.locale}: ${results.ids} ids at ${places} places in ${scripts.length} chunks of JavaScript and ${entries} entries of ${localeFiles.length} translation files. KiB with brotli 11 (gzip ${GZIP_LEVEL}).`,
    table(
      [
        'ids',
        'length, mean (max)',
        ...Object.keys(columns),
        'bytes per id in the JS',
        'bytes per entry of a translation file',
      ],
      rows.map((scheme) => [
        scheme === 'original' ? '16 hex digits' : scheme,
        scheme === 'original'
          ? '16'
          : results.idLength[scheme]
            ? `${results.idLength[scheme].mean.toFixed(2)} (${results.idLength[scheme].max})`
            : '',
        ...Object.keys(columns).map((name) =>
          cell(results.sizes[scheme][name])
        ),
        bytes(results.idCost[scheme].perPlaceInJs),
        bytes(results.idCost[scheme].perTranslationEntry),
      ])
    ),
    `Under positional, ${reads.own} places read the file of their own chunk, ${reads.entry} the entry's file from another chunk, and ${reads.neither} a message that is in neither.`,
    `With ${(100 * stable.added).toFixed(0)}% more messages (mean of ${SEEDS.length} sets, with the least and the most), ${spread(stable.gained.files)} translation files and ${spread(stable.gained.chunks)} chunks gain a message and change under any scheme. Beyond those:`,
    table(
      [
        'ids',
        'ids of existing messages that change',
        'other translation files that change',
        'other chunks that change',
      ],
      stabilityRows.map((row) => [
        row,
        spread(stable[row].ids),
        spread(stable[row].files),
        spread(stable[row].chunks),
      ])
    ),
  ].join('\n\n')
);
