/**
 * One Node measurement in a fresh process:
 *   TZ=UTC NODE_ENV=production node --expose-gc src/node-cell.ts <format> <mix> <n> <locales>
 * Not timed: importing the library, reading the file, warming the engine's
 * Intl data, one gc(). Timed, in this order: loading the messages, the first
 * render (library setup and every message once), the second render, and then
 * the warm throughput.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MixId } from './corpus.ts';
import { catalogFile, formatOf, workDir } from './formats.ts';
import { intlFloor, valuesFor, type Runtime } from './values.ts';

const WARM_UP_MS = 100;
const MEASURE_MS = 100;

const [id, mix, size, localeCount] = process.argv.slice(2);
const now = () => performance.now();

if (id === 'floor') {
  process.stdout.write(JSON.stringify(intlFloor(now)));
  process.exit(0);
}

const format = formatOf(id!);
const n = Number(size);
const runtime: Runtime = await import(`./runtimes/${format.module}.ts`);
const read = (file: string) => readFileSync(join(workDir, file), 'utf8');
const text = read(catalogFile(format, mix as MixId, n, Number(localeCount)));
const keys: string[] = JSON.parse(read(`catalogs/${mix}-keys.json`));
intlFloor(now);
// Start-up garbage otherwise triggers a scavenge inside whichever phase runs
// when the young generation fills: always the same phase for a given cell.
globalThis.gc!();

let chars = 0;
const start = now();
const catalog = (runtime.parse ?? JSON.parse)(text);
const loaded = now();
const render = runtime.make(catalog as never);
for (let i = 0; i < n; i++) chars += render(keys[i]!, valuesFor(i), i).length;
const first = now();
const printed = chars;
for (let i = 0; i < n; i++) chars += render(keys[i]!, valuesFor(i), i).length;
const second = now();

/** Formats the whole catalog over and over for `ms`; returns messages per millisecond. */
function throughput(ms: number): number {
  // The clock is read once per 1,000 messages or more, so reading it is not what is measured.
  const passes = Math.max(1, Math.ceil(1000 / n));
  const from = now();
  let messages = 0;
  let elapsed = 0;
  do {
    for (let pass = 0; pass < passes; pass++)
      for (let i = 0; i < n; i++)
        chars += render(keys[i]!, valuesFor(i), i).length;
    messages += passes * n;
    elapsed = now() - from;
  } while (elapsed < ms);
  return messages / elapsed;
}
throughput(WARM_UP_MS);
const messagesPerMs = throughput(MEASURE_MS);

if (format.catalogType === 'json' && JSON.stringify(catalog) !== text)
  throw new Error('the catalog changed while it was formatted');
process.stdout.write(
  JSON.stringify({
    parse: loaded - start,
    firstRender: first - loaded,
    reRender: second - first,
    messagesPerMs,
    chars: printed,
  })
);
