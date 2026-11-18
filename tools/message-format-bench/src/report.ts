/**
 * Rewrites the tables of README.md from results/bench-grid.json, so the
 * README never quotes a number the results file does not hold.
 * Usage: node src/report.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Summary = { med: number; min: number; max: number };
type Cell = {
  format: string;
  mix: string;
  n: number;
  locales: number;
  bytes: { raw: number; gzip: number; brotli: number; valuesGzip: number };
  runtimeBytes: { min: number; gzip: number; brotli: number };
  ms: { parse: Summary; firstRender: Summary; reRender: Summary };
  scenarios: {
    firstLoad: { ms: { total: Summary; load: Summary; render: Summary } };
    serverRender: { messagesPerMs: Summary };
  };
};
type Fit = {
  metric: string;
  format: string;
  mix: string;
  locales: number;
  fixed: number;
  perMessage: number;
  maxErrorPct: number;
};
type Grid = {
  meta: {
    date: string;
    machine: string;
    os: string;
    node: string;
    browser: string;
    cpuThrottle: number;
    gtCommit: string;
    processesPerCell: number;
    controlSpread: Record<string, { medianPct: number; maxPct: number }>;
  };
  formats: { id: string; localeInvariant: boolean; variantOf?: string }[];
  mixes: { id: string }[];
  locales: number[];
  cells: Cell[];
  fits: Fit[];
};

const HEADLINE_N = 1000;
/** A grid of fewer sizes (BENCH_SIZES) has too few points for a line. */
const NO_FIT = ['-', '-', '-'];
const file = (name: string) =>
  fileURLToPath(new URL(`../${name}`, import.meta.url));

const int = (value: number) => Math.round(value).toLocaleString('en');
const num = (value: number) =>
  value < 1
    ? value.toFixed(3)
    : value < 10
      ? value.toFixed(2)
      : value < 100
        ? value.toFixed(1)
        : int(value);
const range = ({ med, min, max }: Summary) =>
  `${num(med)} [${num(min)}-${num(max)}]`;
const table = (head: string[], rows: string[][]) =>
  [
    `| ${head.join(' | ')} |`,
    `|${head.map((_, i) => (i === 0 ? '---' : '---:')).join('|')}|`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');

function tables(grid: Grid): string {
  const { meta, cells, fits } = grid;
  const cellOf = (format: string, mix: string, locales: number) =>
    cells.find(
      (cell) =>
        cell.format === format &&
        cell.mix === mix &&
        cell.n === HEADLINE_N &&
        cell.locales === locales
    )!;
  const out: string[] = [
    `Run of ${meta.date.slice(0, 10)} on ${meta.machine}, ${meta.os}; Node ${meta.node}; ${meta.browser}, CPU throttled ${meta.cpuThrottle}x; gt at \`${meta.gtCommit.slice(0, 9)}\`. Each time is the median [min-max] of ${meta.processesPerCell} fresh processes. A/A control (the tree against itself), largest difference of medians over all cells: first load ${meta.controlSpread.firstLoad!.maxPct}%, server render ${meta.controlSpread.serverRender!.maxPct}%.`,
  ];

  for (const { id: mix } of grid.mixes) {
    out.push(
      `### \`${mix}\` mix, ${int(HEADLINE_N)} messages, one locale`,
      table(
        [
          'format',
          'catalog raw',
          'gzip',
          'brotli',
          'values gzip',
          'runtime gzip',
          'first load, browser (ms)',
          'server render (messages/ms)',
          'parse (ms)',
          'first render (ms)',
          're-render (ms)',
        ],
        grid.formats.map(({ id }) => {
          const cell = cellOf(id, mix, 1);
          return [
            `\`${id}\``,
            int(cell.bytes.raw),
            int(cell.bytes.gzip),
            int(cell.bytes.brotli),
            int(cell.bytes.valuesGzip),
            int(cell.runtimeBytes.gzip),
            range(cell.scenarios.firstLoad.ms.total),
            range(cell.scenarios.serverRender.messagesPerMs),
            range(cell.ms.parse),
            range(cell.ms.firstRender),
            range(cell.ms.reRender),
          ];
        })
      )
    );
  }

  const byLocale = [
    'tree',
    ...grid.formats
      .filter((format) => !format.localeInvariant || format.variantOf)
      .map((format) => format.id),
  ];
  for (const { id: mix } of grid.mixes) {
    out.push(
      `### \`${mix}\` mix, ${int(HEADLINE_N)} messages, by locale count`,
      table(
        [
          'format',
          ...grid.locales.map((count) => `download gzip, ${count} locales`),
          ...grid.locales.map((count) => `first load (ms), ${count} locales`),
        ],
        byLocale.map((id) => {
          const invariant = grid.formats.find(
            (f) => f.id === id
          )!.localeInvariant;
          const at = grid.locales.map((count) =>
            cellOf(id, mix, invariant ? 1 : count)
          );
          return [
            `\`${id}\``,
            ...at.map((cell) => int(cell.bytes.gzip + cell.runtimeBytes.gzip)),
            ...at.map((cell) => num(cell.scenarios.firstLoad.ms.total.med)),
          ];
        })
      )
    );
  }

  for (const { id: mix } of grid.mixes) {
    const fitOf = (metric: string, format: string, locales: number) =>
      fits.find(
        (fit) =>
          fit.metric === metric &&
          fit.format === format &&
          fit.mix === mix &&
          fit.locales === locales
      );
    out.push(
      `### \`${mix}\` mix, how each format scales with catalog size`,
      table(
        [
          'format',
          'locales',
          'download gzip: fixed (B)',
          'per message (B)',
          'worst error',
          'first load: fixed (ms)',
          'per 1,000 messages (ms)',
          'worst error',
        ],
        grid.formats.flatMap(({ id, localeInvariant }) =>
          (localeInvariant ? [1] : grid.locales).map((locales) => {
            const bytes = fitOf('downloadGzipBytes', id, locales);
            const time = fitOf('firstLoadMs', id, locales);
            return [
              `\`${id}\``,
              localeInvariant ? 'any' : String(locales),
              ...(bytes
                ? [
                    int(bytes.fixed),
                    num(bytes.perMessage),
                    `${bytes.maxErrorPct}%`,
                  ]
                : NO_FIT),
              ...(time
                ? [
                    num(time.fixed),
                    num(time.perMessage * 1000),
                    `${time.maxErrorPct}%`,
                  ]
                : NO_FIT),
            ];
          })
        )
      )
    );
  }
  return out.join('\n\n');
}

export const TABLES_START = '<!-- tables:start (written by src/report.ts) -->';
const END = '<!-- tables:end -->';

export function writeReport(grid: Grid) {
  const readme = readFileSync(file('README.md'), 'utf8');
  const [before, rest] = readme.split(TABLES_START);
  const after = rest?.split(END)[1];
  if (before === undefined || after === undefined)
    throw new Error('README.md has no tables section');
  writeFileSync(
    file('README.md'),
    `${before}${TABLES_START}\n\n${tables(grid)}\n\n${END}${after}`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  writeReport(
    JSON.parse(readFileSync(file('results/bench-grid.json'), 'utf8'))
  );
