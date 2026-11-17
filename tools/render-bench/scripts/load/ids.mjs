// Estimates what shorter message ids would save in a build that writes a
// translation file per chunk: rewrites every id in the built JavaScript and
// translation files under three schemes, compresses the result, and counts
// the ids and files that change when the app gains messages.
//   node scripts/load/ids.mjs --dist apps/flat-5k/dist/sidecars-map
//     --result results/load/flat-5k-sidecars-map-fr-CA.json
//     --source-result results/load/flat-5k-sidecars-map-en.json
//     [--locale fr-CA]
//     [--added 0.01]   the share of new messages for the stability count
//     [--write dir]    also write the build under each scheme, to load it
// The results are those of measure.mjs for the build, with their lists of
// requests: they say which files a page loads. The schemes:
//   prefix   the shortest prefix of the hash that no other hash has, 4 or more
//   prefix6  the same, 6 characters or more
//   counter  a base-62 counter in the order of the hashes: the lower bound
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
const MANIFEST = 'gt-chunk-translations.json';
const SCHEMES = ['prefix', 'prefix6', 'counter'];
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
/** The translation files of a locale: its entries' and its chunks'. */
const translationFiles = (locale) => [
  ...Object.values(manifest.entries).flatMap(
    (entry) => entry.translations[locale] ?? []
  ),
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

// An id is a hash that a chunk's code passes and a translation file is keyed by.
const keysOf = (file) => {
  const content = JSON.parse(source.get(file));
  return Object.keys(content.t ?? content);
};
const keyed = new Set(localeFiles.flatMap(keysOf));
const callSites = new Map();
for (const file of scripts) {
  for (const hash of source.get(file).match(HASHES) ?? []) {
    if (keyed.has(hash)) callSites.set(hash, (callSites.get(hash) ?? 0) + 1);
  }
}
const hashes = [...callSites.keys()].sort();

// ===== Schemes ===== //

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
      if (scheme === 'none') return [hash, ''];
      const unique =
        Math.max(shared(hash, sorted[i - 1]), shared(hash, sorted[i + 1])) + 1;
      return [
        hash,
        hash.slice(0, Math.max(scheme === 'prefix' ? 4 : 6, unique)),
      ];
    })
  );
}
const rewrite = (text, ids) =>
  text.replace(HASHES, (hash) => ids.get(hash) ?? hash);

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
/** The size of every file under a scheme; a file without ids keeps its own. */
async function sizesUnder(ids) {
  return new Map(
    await Promise.all(
      measured.map(async (file) => {
        const text = source.get(file);
        const rewritten = text === undefined ? undefined : rewrite(text, ids);
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
// `none` writes no id at all: what the others are measured against.
const variants = { original };
for (const scheme of [...SCHEMES, 'none']) {
  variants[scheme] = await sizesUnder(assign(scheme, hashes));
}

const translations = (list) =>
  list.filter((file) => localeFiles.includes(file));
const rows = {
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
const occurrences = (list) =>
  list.reduce(
    (sum, file) =>
      sum +
      (source.get(file).match(HASHES) ?? []).filter((hash) =>
        callSites.has(hash)
      ).length,
    0
  );
const cost = (variant, list) => {
  const count = occurrences(list);
  const having = total(variant, list);
  const without = total(variants.none, list);
  return {
    brotli: (having.brotli - without.brotli) / count,
    gzip: (having.gzip - without.gzip) / count,
    raw: (having.raw - without.raw) / count,
  };
};

// ===== Stability ===== //

// The ids and translation files that change when the app gains messages,
// before counting the files the new messages go into.
const keysByFile = new Map(localeFiles.map((file) => [file, keysOf(file)]));
function stability(scheme, seed) {
  const random = createRandom(seed);
  const added = Array.from(
    { length: Math.round(hashes.length * Number(args.added)) },
    () =>
      Array.from({ length: 16 }, () =>
        Math.floor(random() * 16).toString(16)
      ).join('')
  );
  const before = assign(scheme, hashes);
  const after = assign(scheme, [...new Set([...hashes, ...added])].sort());
  const changed = new Set(
    hashes.filter((hash) => before.get(hash) !== after.get(hash))
  );
  return {
    ids: changed.size,
    files: [...keysByFile.values()].filter((keys) =>
      keys.some((key) => changed.has(key))
    ).length,
  };
}
const range = (values) => ({
  mean: values.reduce((a, b) => a + b, 0) / values.length,
  min: Math.min(...values),
  max: Math.max(...values),
});

// ===== Report ===== //

const lengths = (scheme) => {
  const ids = [...assign(scheme, hashes).values()];
  return {
    mean: ids.reduce((sum, id) => sum + id.length, 0) / ids.length,
    max: Math.max(...ids.map((id) => id.length)),
  };
};
const results = {
  kind: 'ids',
  app: result.app,
  label: result.label,
  packages: result.packages,
  locale: args.locale,
  ids: hashes.length,
  callSites: [...callSites.values()].reduce((a, b) => a + b, 0),
  translationKeys: keyed.size,
  compression: `brotli quality 11, gzip level ${GZIP_LEVEL}`,
  idLength: Object.fromEntries(
    SCHEMES.map((scheme) => [scheme, lengths(scheme)])
  ),
  sizes: Object.fromEntries(
    Object.entries(rows).map(([name, list]) => [
      name,
      Object.fromEntries(
        ['original', ...SCHEMES].map((scheme) => [
          scheme,
          total(variants[scheme], list),
        ])
      ),
    ])
  ),
  idCost: Object.fromEntries(
    ['original', ...SCHEMES].map((scheme) => [
      scheme,
      {
        perCallSite: cost(variants[scheme], scripts),
        perTranslation: cost(variants[scheme], localeFiles),
      },
    ])
  ),
  stability: {
    added: Number(args.added),
    seeds: SEEDS.length,
    translationFiles: localeFiles.length,
    ...Object.fromEntries(
      SCHEMES.map((scheme) => {
        const runs = SEEDS.map((seed) => stability(scheme, seed));
        return [
          scheme,
          {
            ids: range(runs.map((run) => run.ids)),
            files: range(runs.map((run) => run.files)),
          },
        ];
      })
    ),
  },
};

const out =
  args.out ??
  join(root, 'results', 'load', `ids-${result.app}-${result.label}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(results, null, 2) + '\n');

if (args.write) {
  for (const scheme of SCHEMES) {
    const target = join(resolve(args.write), scheme);
    cpSync(dist, target, { recursive: true });
    const ids = assign(scheme, hashes);
    const rewritten = [
      ...scripts,
      ...manifest.locales.flatMap((locale) => translationFiles(locale)),
    ];
    for (const file of new Set(rewritten)) {
      writeFileSync(
        join(target, file),
        rewrite(readFileSync(join(dist, file), 'utf8'), ids)
      );
    }
  }
}

const kib = (bytes) => (bytes / 1024).toFixed(1);
const cell = (size) => `${kib(size.brotli)} (${kib(size.gzip)})`;
const bytes = (value) => value.toFixed(1);
const table = (header, body) =>
  [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
console.log(
  [
    `${results.app} ${results.label}${results.packages ? ` (${results.packages})` : ''}, ${results.locale}: ${results.ids} ids at ${results.callSites} places in the JavaScript. KiB with brotli 11 (gzip ${GZIP_LEVEL}).`,
    table(
      ['', '16 hex digits', ...SCHEMES],
      [
        ...Object.entries(results.sizes).map(([name, row]) => [
          name,
          cell(row.original),
          ...SCHEMES.map((scheme) => cell(row[scheme])),
        ]),
        [
          'id length, mean (max)',
          '16',
          ...SCHEMES.map(
            (scheme) =>
              `${results.idLength[scheme].mean.toFixed(2)} (${results.idLength[scheme].max})`
          ),
        ],
        ...[
          ['bytes per id in the JS', 'perCallSite'],
          ['bytes per id in a translation file', 'perTranslation'],
        ].map(([name, key]) => [
          name,
          ...['original', ...SCHEMES].map(
            (scheme) =>
              `${bytes(results.idCost[scheme][key].brotli)} (${bytes(results.idCost[scheme][key].gzip)})`
          ),
        ]),
      ]
    ),
    [
      `With ${(100 * results.stability.added).toFixed(0)}% more messages (mean of ${SEEDS.length} sets, with the least and the most):`,
      ...SCHEMES.map((scheme) => {
        const { ids, files: changed } = results.stability[scheme];
        return `- ${scheme}: ${ids.mean.toFixed(0)} of ${results.ids} ids change (${ids.min}–${ids.max}), in ${changed.mean.toFixed(0)} of ${results.stability.translationFiles} translation files (${changed.min}–${changed.max}).`;
      }),
    ].join('\n'),
  ].join('\n\n')
);
