// Prints results of measure.mjs and build.mjs as Markdown tables.
//   node scripts/load/report.mjs [--against baseline] results/load/*.json
// `--against` names the build whose startup JavaScript the others are
// compared with.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const kib = (bytes) => (bytes / 1024).toFixed(1);
const signedKib = (bytes) => `${bytes >= 0 ? '+' : '−'}${kib(Math.abs(bytes))}`;
const mb = (bytes) => (bytes / 2 ** 20).toFixed(0);
const ms = (value) => value.toFixed(0);
const seconds = (value) => (value / 1000).toFixed(2);

/** A median with its interquartile range and its extremes. */
const spread = (summary, format) =>
  summary.n === 1
    ? format(summary.median)
    : `${format(summary.median)} [${format(summary.p25)}–${format(summary.p75)}] (${format(summary.min)}–${format(summary.max)})`;

function table(header, rows) {
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

const name = (result) =>
  `${result.app ?? result.dist} ${result.label}, ${result.locale}`;

/** `size` reads the bytes of a kind of file: as served, or as gzip would make them. */
function bytesTable(loads, size) {
  const cells = (transfer) => [
    kib(size(transfer.js) + size(transfer.other)),
    kib(size(transfer.translations)),
    `**${kib(size(transfer.total))}**`,
    transfer.total.requests,
  ];
  return table(
    [
      'build, locale',
      'JS, KiB',
      'translations, KiB',
      'first load, KiB',
      'requests',
      'JS after 3 routes, KiB',
      'translations after 3 routes, KiB',
      'total after 3 routes, KiB',
      'requests after 3 routes',
    ],
    loads.map((result) => [
      name(result) + (result.bytes.stable ? '' : ' (varied between loads)'),
      ...cells(result.bytes.firstLoad),
      ...cells(result.bytes.afterRoutes),
    ])
  );
}

function startupTable(loads, against) {
  return table(
    [
      'build, locale',
      'files',
      'raw, KiB',
      'gzip, KiB',
      'brotli, KiB',
      `raw against ${against}, KiB`,
      `gzip against ${against}, KiB`,
      `brotli against ${against}, KiB`,
    ],
    loads.map((result) => {
      const startup = result.bytes.startupJs;
      const reference = loads.find(
        (other) =>
          other !== result &&
          other.label === against &&
          other.app === result.app &&
          other.locale === result.locale
      )?.bytes.startupJs;
      return [
        name(result),
        startup.files,
        kib(startup.rawBytes),
        kib(startup.gzipBytes),
        kib(startup.bytes),
        ...(reference
          ? [
              signedKib(startup.rawBytes - reference.rawBytes),
              signedKib(startup.gzipBytes - reference.gzipBytes),
              signedKib(startup.bytes - reference.bytes),
            ]
          : ['', '', '']),
      ];
    })
  );
}

function timingsTable(loads) {
  return table(
    [
      'build, locale',
      'network, ms / Mbps',
      'cold load → route rendered, ms',
      'behind the source locale, ms',
      'warm load → route rendered, ms',
      'route change → rendered, ms',
      'loads that painted source text',
    ],
    loads.flatMap((result) => {
      const source = loads.find(
        (other) =>
          !other.translated &&
          other.label === result.label &&
          other.app === result.app
      );
      return Object.entries(result.timings).map(([network, { cold, warm }]) => [
        name(result),
        network,
        spread(cold.rendered, ms),
        result.translated && source?.timings[network]
          ? `+${ms(cold.rendered.median - source.timings[network].cold.rendered.median)}`
          : '',
        spread(warm.rendered, ms),
        cold.navigation ? spread(cold.navigation, ms) : '',
        result.translated
          ? `${cold.flashes + warm.flashes} of ${cold.rendered.n + warm.rendered.n}`
          : 'source locale',
      ]);
    })
  );
}

function buildsTable(results) {
  return table(
    [
      'app',
      'messages',
      'translated locales',
      'build',
      'wall time, s',
      'peak resident memory, MB',
      'JS files',
      'translation files',
      'other files',
      'output, MB',
      'builds timed',
    ],
    results.flatMap((result) =>
      result.builds.map((build) => [
        result.app,
        result.messages.toLocaleString('en-US'),
        result.locales.length,
        build.target,
        spread(build.wallMs, seconds),
        spread(build.peakRssBytes, mb),
        build.filesByKind.js.toLocaleString('en-US'),
        build.filesByKind.translations.toLocaleString('en-US'),
        build.filesByKind.other.toLocaleString('en-US'),
        mb(build.bytes),
        build.wallMs.n,
      ])
    )
  );
}

export function report(results, { against = 'baseline' } = {}) {
  const loads = results.filter((result) => result.kind === 'load');
  const builds = results.filter((result) => result.kind === 'build');
  const sections = [];
  if (loads.length) {
    const [first] = loads;
    sections.push(
      `${first.sha}, ${first.machine}, ${first.os}, Chromium ${first.chromium}, ${first.protocol}. Times are the median of ${first.samples} page loads, with [the middle half] and (the extremes). 1 KiB = 1,024 bytes.`,
      `**Transferred bytes** (response bodies as served: ${first.compression})`,
      bytesTable(loads, (transfer) => transfer.bytes),
      `**The same responses with gzip at level ${first.gzipLevel}**`,
      bytesTable(loads, (transfer) => transfer.gzipBytes),
      '**Startup JavaScript** (the JavaScript a page had loaded when it rendered its first route; translation files are not counted)',
      startupTable(loads, against),
      '**Navigation → the route rendered in the user’s language**',
      timingsTable(loads)
    );
  }
  if (builds.length) {
    const [first] = builds;
    sections.push(
      `**Build cost** (${first.sha}, ${first.machine}, Node ${first.node}; median [middle half] (extremes))`,
      buildsTable(builds)
    );
  }
  return sections.join('\n\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    options: { against: { type: 'string', default: 'baseline' } },
    allowPositionals: true,
  });
  console.log(
    report(
      positionals.map((path) => JSON.parse(readFileSync(path, 'utf8'))),
      values
    )
  );
}
