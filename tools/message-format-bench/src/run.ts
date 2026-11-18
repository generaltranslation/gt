/**
 * Times every cell that build.ts prepared and writes results/bench-grid.json.
 * Usage: node src/run.ts [processesPerCell=21] [--resume]
 * `--resume` continues a run that was stopped, from its last whole round.
 *
 * Each measurement is one fresh process: a Node process for the server
 * scenario (node-cell.ts) and a Chromium process for the first-load scenario
 * (page.ts). The order of the formats rotates between rounds and cells.
 * `control` is the `tree` format measured a second time under another name
 * (the A/A control).
 */
import { execFileSync } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import { join, normalize } from 'node:path';
import { chromium } from 'playwright-core';
import type { StaticCell } from './build.ts';
import { LOCALE_COUNTS, SIZES, type MixId } from './corpus.ts';
import {
  CONTROL,
  FORMATS,
  catalogFile,
  formatOf,
  harnessFile,
  localeCountsOf,
  packageDir,
  workDir,
} from './formats.ts';
import { TABLES_START, writeReport } from './report.ts';
import { PAGE_MESSAGES } from './values.ts';

const ROUNDS = Number(process.argv[2] ?? 21);
/** Chromium's CPU throttling rate: the main thread runs this many times slower. */
const CPU_THROTTLE = 4;

type Summary = { med: number; min: number; max: number };
type NodeSample = {
  parse: number;
  firstRender: number;
  reRender: number;
  messagesPerMs: number;
  chars: number;
};
type BrowserSample = {
  evalRuntime: number;
  load: number;
  render: number;
  chars: number;
  isolated: boolean;
};
type Floor = { plural: number; all: number };

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: packageDir, encoding: 'utf8' }).trim();
/** The commit of `samsara` that gt was built from. */
function gtCommit(): string {
  if (git('status', '--porcelain', '--', '../../packages/icu'))
    throw new Error('packages/icu has uncommitted changes');
  try {
    const base = git('merge-base', 'HEAD', 'origin/samsara');
    if (!git('diff', '--stat', base, 'HEAD', '--', '../../packages/icu'))
      return base;
  } catch {
    // No origin/samsara here.
  }
  return git('rev-parse', 'HEAD');
}

// Checked before hours of measuring, not after.
const commit = gtCommit();
if (!readFileSync(join(packageDir, 'README.md'), 'utf8').includes(TABLES_START))
  throw new Error('README.md has no tables section');
const loadAverage = os.loadavg()[0]!;

const stat = JSON.parse(readFileSync(join(workDir, 'static.json'), 'utf8'));
const staticCells: StaticCell[] = stat.cells;
const mixes: MixId[] = stat.mixes.map((mix: { id: MixId }) => mix.id);

const summary = (values: number[]): Summary => {
  const sorted = [...values].sort((a, b) => a - b);
  const round = (value: number) => +value.toPrecision(4);
  return {
    med: round(sorted[sorted.length >> 1]!),
    min: round(sorted[0]!),
    max: round(sorted.at(-1)!),
  };
};

const env = { ...process.env, TZ: 'UTC', NODE_ENV: 'production' };
function nodeSample<T>(...args: string[]): T {
  const cell = join(packageDir, 'src/node-cell.ts');
  const out = execFileSync(process.execPath, ['--expose-gc', cell, ...args], {
    encoding: 'utf8',
    env,
  });
  return JSON.parse(out);
}

const HEADERS = {
  // Cross-origin isolation gives the page a 5 microsecond clock instead of 100.
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cache-Control': 'no-store',
};
const server = createServer((request, response) => {
  const { pathname } = new URL(request.url!, 'http://localhost');
  if (pathname === '/page.html') {
    response.writeHead(200, { ...HEADERS, 'Content-Type': 'text/html' });
    response.end(
      '<!doctype html><meta charset="utf-8"><script src="/harness/page.js"></script>'
    );
    return;
  }
  const file = normalize(join(workDir, pathname));
  if (!file.startsWith(workDir)) {
    response.writeHead(403).end();
    return;
  }
  const type = file.endsWith('.json') ? 'application/json' : 'text/javascript';
  response.writeHead(200, { ...HEADERS, 'Content-Type': type });
  createReadStream(file).pipe(response);
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

let browserVersion = '';
async function launchAndMeasure<T>(query: Record<string, string>): Promise<T> {
  const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] });
  try {
    browserVersion = browser.version();
    const context = await browser.newContext({
      timezoneId: 'UTC',
      locale: 'en-US',
    });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', {
      rate: CPU_THROTTLE,
    });
    await page.goto(`${origin}/page.html?${new URLSearchParams(query)}`);
    const handle = await page.waitForFunction(
      () => (globalThis as { __result?: unknown }).__result,
      null,
      { timeout: 120_000 }
    );
    const result = (await handle.jsonValue()) as T & { error?: string };
    if (result.error) throw new Error(result.error);
    return result;
  } finally {
    await browser.close();
  }
}

/** A browser that fails to start is not a measurement, so it is started once more. */
async function browserSample<T>(query: Record<string, string>): Promise<T> {
  try {
    return await launchAndMeasure<T>(query);
  } catch (error) {
    console.error(`retrying ${JSON.stringify(query)}: ${error}`);
    return launchAndMeasure<T>(query);
  }
}

type Entry = { id: string; locales: number };
const ENTRIES: Entry[] = [
  ...FORMATS.flatMap((format) =>
    localeCountsOf(format, LOCALE_COUNTS).map((locales) => ({
      id: format.id,
      locales,
    }))
  ),
  { id: CONTROL, locales: 1 },
];
const keyOf = (id: string, mix: string, n: number, locales: number) =>
  `${id}|${mix}|${n}|${locales}`;

type Samples = {
  node: Record<string, NodeSample[]>;
  browser: Record<string, BrowserSample[]>;
  floor: { node: Floor[]; browser: Floor[] };
};
const timesFile = join(workDir, 'times.json');
const { node, browser, floor }: Samples =
  process.argv.includes('--resume') && existsSync(timesFile)
    ? JSON.parse(readFileSync(timesFile, 'utf8'))
    : { node: {}, browser: {}, floor: { node: [], browser: [] } };
const started = Date.now();
for (let round = floor.node.length; round < ROUNDS; round++) {
  floor.node.push(nodeSample('floor'));
  floor.browser.push(await browserSample({ floor: '1' }));
  let group = 0;
  for (const mix of mixes)
    for (const n of SIZES) {
      group++;
      const rotated = ENTRIES.map(
        (_, i) => ENTRIES[(i + round + group) % ENTRIES.length]!
      );
      for (const { id, locales } of rotated)
        (node[keyOf(id, mix, n, locales)] ??= []).push(
          nodeSample(id, mix, String(n), String(locales))
        );
      for (const { id, locales } of rotated) {
        const format = formatOf(id);
        const sample = await browserSample<BrowserSample>({
          harness: `/${harnessFile(format, mix, n, locales)}`,
          catalog: `/${catalogFile(format, mix, n, locales)}`,
          keys: `/catalogs/${mix}-keys.json`,
          n: String(n),
        });
        (browser[keyOf(id, mix, n, locales)] ??= []).push(sample);
      }
    }
  writeFileSync(timesFile, JSON.stringify({ floor, node, browser }));
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  console.error(`round ${round + 1}/${ROUNDS} ${seconds}s`);
}
server.close();

const NODE_METRICS = ['parse', 'firstRender', 'reRender'] as const;
type Measured = {
  ms: Record<(typeof NODE_METRICS)[number], Summary>;
  scenarios: {
    firstLoad: {
      messagesRendered: number;
      ms: Record<'total' | 'load' | 'render' | 'evalRuntime', Summary>;
    };
    serverRender: { messagesPerMs: Summary };
  };
};

function measured(id: string, mix: MixId, n: number, locales: number) {
  const key = keyOf(id, mix, n, locales);
  const format = formatOf(id);
  const expected = staticCells.find(
    (cell) =>
      cell.format === format.id &&
      cell.mix === mix &&
      cell.n === n &&
      cell.locales === locales
  )!;
  const pages = browser[key]!;
  if (pages.some((sample) => sample.chars !== expected.chars.page))
    throw new Error(`${key} did not print the expected text in the browser`);
  if (node[key]!.some((sample) => sample.chars !== expected.chars.all))
    throw new Error(`${key} did not print the expected text in Node`);
  if (pages.some((sample) => !sample.isolated))
    throw new Error('the page was not cross-origin isolated');
  const result: Measured = {
    ms: Object.fromEntries(
      NODE_METRICS.map((metric) => [
        metric,
        summary(node[key]!.map((sample) => sample[metric])),
      ])
    ) as Measured['ms'],
    scenarios: {
      firstLoad: {
        messagesRendered: Math.min(PAGE_MESSAGES, n),
        ms: {
          total: summary(pages.map((sample) => sample.load + sample.render)),
          load: summary(pages.map((sample) => sample.load)),
          render: summary(pages.map((sample) => sample.render)),
          evalRuntime: summary(pages.map((sample) => sample.evalRuntime)),
        },
      },
      serverRender: {
        messagesPerMs: summary(
          node[key]!.map((sample) => sample.messagesPerMs)
        ),
      },
    },
  };
  return { expected, result };
}

const CONTROL_METRICS = {
  firstLoad: (m: Measured) => m.scenarios.firstLoad.ms.total.med,
  serverRender: (m: Measured) => m.scenarios.serverRender.messagesPerMs.med,
  parse: (m: Measured) => m.ms.parse.med,
  firstRender: (m: Measured) => m.ms.firstRender.med,
  reRender: (m: Measured) => m.ms.reRender.med,
};
type ControlMetric = keyof typeof CONTROL_METRICS;
const spread = Object.fromEntries(
  Object.keys(CONTROL_METRICS).map((metric) => [metric, [] as number[]])
) as Record<ControlMetric, number[]>;

const cells = [];
for (const mix of mixes)
  for (const n of SIZES) {
    for (const { id, locales } of ENTRIES) {
      if (id === CONTROL) continue;
      const { expected, result } = measured(id, mix, n, locales);
      const { bytes, runtimeBytes } = expected;
      cells.push({
        format: id,
        mix,
        n,
        locales,
        bytes,
        runtimeBytes,
        ...result,
      });
    }
    const a = measured('tree', mix, n, 1).result;
    const b = measured(CONTROL, mix, n, 1).result;
    for (const [metric, read] of Object.entries(CONTROL_METRICS))
      spread[metric as ControlMetric].push(
        (Math.abs(read(a) - read(b)) / Math.min(read(a), read(b))) * 100
      );
  }
const spreadOf = Object.fromEntries(
  Object.entries(spread).map(([metric, list]) => {
    const { med, max } = summary(list);
    return [metric, { medianPct: +med.toFixed(1), maxPct: +max.toFixed(1) }];
  })
) as Record<ControlMetric, { medianPct: number; maxPct: number }>;

/**
 * y = fixed + perMessage * n, by least squares on the relative error, so the
 * small catalogs weigh as much as the large ones.
 */
function fit(points: [n: number, y: number][]) {
  let sw = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const [x, y] of points) {
    const w = 1 / (y * y);
    sw += w;
    sx += w * x;
    sy += w * y;
    sxx += w * x * x;
    sxy += w * x * y;
  }
  const perMessage = (sw * sxy - sx * sy) / (sw * sxx - sx * sx);
  const fixed = (sy - perMessage * sx) / sw;
  const worst = Math.max(
    ...points.map(([x, y]) => Math.abs(fixed + perMessage * x - y) / y)
  );
  return {
    fixed: +fixed.toPrecision(4),
    perMessage: +perMessage.toPrecision(4),
    maxErrorPct: +(worst * 100).toFixed(1),
  };
}
const exact = fit([
  [10, 25],
  [100, 205],
  [1000, 2005],
]);
if (exact.fixed !== 5 || exact.perMessage !== 2 || exact.maxErrorPct !== 0)
  throw new Error('fit() does not recover y = 5 + 2n');

type Cell = (typeof cells)[number];
const FIT_METRICS: Record<string, { from: number; read: (c: Cell) => number }> =
  {
    // What a user downloads: the catalog and the runtime library, gzipped.
    downloadGzipBytes: {
      from: 0,
      read: (c) => c.bytes.gzip + c.runtimeBytes.gzip,
    },
    // Below a page of messages the render is smaller too, so the line starts at one page.
    firstLoadMs: {
      from: PAGE_MESSAGES,
      read: (c) => c.scenarios.firstLoad.ms.total.med,
    },
  };
const fits = [];
for (const [metric, { from, read }] of Object.entries(FIT_METRICS))
  for (const mix of mixes)
    for (const { id, locales } of ENTRIES) {
      if (id === CONTROL) continue;
      const points = cells
        .filter(
          (c) =>
            c.format === id &&
            c.mix === mix &&
            c.locales === locales &&
            c.n >= from
        )
        .map((c): [number, number] => [c.n, read(c)]);
      if (points.length < 3) continue;
      fits.push({ metric, format: id, mix, locales, ...fit(points) });
    }

const floorOf = (list: Floor[], key: keyof Floor) => {
  const { med, min, max } = summary(list.map((sample) => sample[key]));
  return `${med} ms (min ${min}, max ${max})`;
};
const rt = stat.runtime;
const b = (x: { min: number; gzip: number; brotli: number }) =>
  `${x.min} min / ${x.gzip} gzip / ${x.brotli} brotli`;
const differ = (mix: string) =>
  JSON.stringify(stat.check[mix].messagesThatDiffer.intlayer ?? {});
const NOTES: Record<string, string> = {
  icu: 'Parses the string on every call: gt keeps no parsed-message cache, so a re-render parses again.',
  'icu-fjs': `Parses once per key; the IntlMessageFormat object is cached per key. With react-intl's formatter cache (@formatjs/intl createFormatters) the bundle is ${b(rt['icu-fjs / fjs-ast + react-intl formatter cache'])}.`,
  'fjs-ast': `runtimeBytes is with @formatjs/icu-messageformat-parser aliased to its no-parser.js. Without that alias the parser stays in the bundle: ${b(rt['fjs-ast (parser not aliased away)'])}.`,
  lingui:
    'Plain text is stored as a one-element array. Formats on each call; nothing is cached per key.',
  minify: `runtimeBytes is icu-minify/format alone. It needs the caller's formatter cache and named-style table; with next-intl's (use-intl format-only wrapper + formatter cache) the bundle is ${b(rt['minify + next-intl wrapper and formatter cache'])}.`,
  tree: 'The catalog holds the tree alone. Formatting context (`formats`) is empty for every message of this corpus.',
  paraglide:
    'Not a catalog: one JavaScript function per message, produced from the ICU strings by @inlang/plugin-icu1 and bundled by Vite with paraglideVitePlugin. `bytes` is the chunk of message functions and holds no keys, because an app calls each function by name and the bundler drops the names; compare it with `valuesGzip` of the catalogs. Each function holds the text of every locale, so `bytes` grows with the locale count. `runtimeBytes` is the chunk the functions import (locale detection and Intl helpers) and is per cell.',
  'paraglide-static':
    'The `en` bundle of experimentalPerLocaleBuild (Vite 8, Rolldown): the other locales and the locale detection are compiled out. The build checks that it is the same file for 1, 5 and 20 locales.',
  intlayer: `One dictionary of n fields, built from the ICU JSON files by @intlayer/sync-json-plugin (format: 'icu'), with every locale in it (import mode 'static', the default), so \`bytes\` grows with the locale count. Formatted the way @intlayer/react-intl formats: getDictionary, then the ICU resolver, which still parses a plain-text message as ICU on each call. Not the same output as ICU: \`#\` prints without grouping (1234, not 1,234) and a select on a variable not named \`value\` takes its fallback branch. Messages that differ, of ${stat.check.app.messages}: app ${differ('app')}, rich ${differ('rich')}. \`runtimeBytes\` is built by vite-intlayer, which drops the node types a project does not use, and is per cell.`,
  'intlayer-dynamic':
    "The dictionary of one locale (import mode 'dynamic'). It lists the id of every locale's source file, about 80 bytes per locale, so it is measured for each locale count.",
};

const grid = {
  meta: {
    date: new Date().toISOString(),
    machine: `${os.cpus()[0]!.model}, ${os.cpus().length} cores, ${Math.round(os.totalmem() / 2 ** 30)} GB`,
    // The machine is not isolated: this is what else it was doing.
    loadAverageAtStart: +loadAverage.toFixed(1),
    os: `${os.type()} ${os.release()} ${os.arch()}${process.platform === 'darwin' ? ` (macOS ${execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim()})` : ''}`,
    node: `${process.version} (V8 ${process.versions.v8}, ICU ${process.versions.icu})`,
    browser: `Chromium ${browserVersion} (headless, Playwright ${stat.versions['playwright-core']})`,
    cpuThrottle: CPU_THROTTLE,
    gtCommit: commit,
    versions: stat.versions,
    seed: stat.seed,
    processesPerCell: ROUNDS,
    controlSpreadPct: Math.max(
      spreadOf.firstLoad.maxPct,
      spreadOf.serverRender.maxPct
    ),
    controlSpread: spreadOf,
    notes: [
      `controlSpreadPct is the largest difference between the medians of two identical runs (tree vs tree) over all ${mixes.length * SIZES.length} (mix, n) cells, for the two scenarios. controlSpread has the median and the largest difference of each metric. Treat two formats closer than about twice this as the same.`,
      `Scenario firstLoad: one fresh headless Chromium process per measurement, CPU throttled ${CPU_THROTTLE}x. \`load\` is JSON.parse of the catalog text, or evaluating the script for the Paraglide formats (which includes their runtime chunk). \`render\` is setting the library up and formatting the first ${PAGE_MESSAGES} messages of the catalog once (all of them when n is smaller). \`total\` is load + render. \`evalRuntime\` is evaluating the library's script; it is reported apart and is not in \`total\`. Not timed: fetching the files.`,
      'Scenario serverRender: one fresh Node process per measurement. After the timed parse, first render and re-render of the whole catalog, it formats the whole catalog over and over for 100 ms without timing, then for 100 ms more: messagesPerMs is messages formatted per millisecond in that second window.',
      'ms.parse, ms.firstRender and ms.reRender are single calls for the whole catalog in that Node process, in this order, after one gc(): parse and firstRender run with cold JIT. For the Paraglide formats parse is evaluating the script.',
      `Intl is warmed before the timed section in both scenarios (one Intl.PluralRules, two Intl.NumberFormat, one Intl.DateTimeFormat are built and used, untimed), so the numbers are the library's own work. The Intl floor, in a fresh process with no message library: Node, PluralRules + NumberFormat ${floorOf(floor.node, 'plural')}, plus a percent NumberFormat and a DateTimeFormat ${floorOf(floor.node, 'all')} in total; Chromium at ${CPU_THROTTLE}x, ${floorOf(floor.browser, 'plural')} and ${floorOf(floor.browser, 'all')}. A process pays this once, whatever the format.`,
      'bytes: the catalog JSON `{16-hex key: value}`; gzip level 6; brotli quality 11; valuesGzip is gzip of the JSON array of values without keys. icu and icu-fjs read the same catalog. Sizes do not change on a rerun with the same Node version; gzip sizes differ slightly between zlib versions.',
      'runtimeBytes: the one import that formats, bundled and minified for the browser (esbuild; Vite for Paraglide and Intlayer, which need their own plugins); gzip level 6, brotli quality 11.',
      'locales: how many locales the app has. Each locale has the same messages, with the letters of the text substituted, so every locale has the same size. A format with `localeInvariant` ships one file per locale: what a user downloads does not depend on the locale count, and its cells are at locales = 1.',
      'fits: metric = fixed + perMessage * n for each (format, mix, locales), by least squares on the relative error; maxErrorPct is the worst relative error of the line. downloadGzipBytes is bytes.gzip + runtimeBytes.gzip over all sizes; firstLoadMs is the firstLoad total over the sizes from one page up.',
      `Corpus is synthetic (seeded). Every format printed the same string for all ${stat.check.app.messages} messages of both mixes before timing, except Intlayer as its note says. See README for what was left out and what favours or hurts each format.`,
    ],
  },
  formats: FORMATS.map((format) => {
    const { id, label, runtime, parserAtRuntime, localeInvariant } = format;
    const largest = staticCells.findLast(
      (cell) => cell.format === id && cell.locales === 1
    )!;
    return {
      id,
      label,
      runtime,
      parserAtRuntime,
      localeInvariant,
      ...(format.variantOf ? { variantOf: format.variantOf } : {}),
      runtimeBytes: largest.runtimeBytes,
      note: NOTES[id]!,
    };
  }),
  mixes: stat.mixes,
  sizes: SIZES,
  locales: LOCALE_COUNTS,
  check: stat.check,
  fits,
  examples: stat.examples,
  cells,
};

/** Indented like the rest of the file, with one cell or fit per line. */
const json = JSON.stringify(
  grid,
  (key, value) =>
    key === 'cells' || key === 'fits'
      ? value.map((item: unknown) => `@@${JSON.stringify(item)}@@`)
      : value,
  1
).replace(/"@@(.*)@@"/g, (_, item) => JSON.parse(`"${item}"`));
const resultsFile = join(packageDir, 'results/bench-grid.json');
writeFileSync(resultsFile, json + '\n');
writeReport(JSON.parse(json));
console.error(`wrote ${resultsFile}`);
