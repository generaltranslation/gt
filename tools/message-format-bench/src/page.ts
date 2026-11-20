/**
 * The page of one first-load measurement, in a fresh browser. Not timed:
 * fetching the files, warming the engine's Intl data, one gc(). Timed, in this
 * order: evaluating the runtime script, loading the messages (JSON.parse, or
 * evaluating them when they are JavaScript), and setting the library up and
 * formatting the first page of messages.
 */
import { PAGE_MESSAGES, intlFloor, valuesFor, type Runtime } from './values.ts';

declare global {
  var __bench: Runtime;
  var __result: unknown;
}

const query = new URLSearchParams(globalThis.location.search);
const now = () => performance.now();
const text = (name: string) =>
  fetch(query.get(name)!).then((response) => response.text());

async function measure() {
  if (query.has('floor'))
    return { ...intlFloor(now), isolated: globalThis.crossOriginIsolated };
  const [harness, catalogText, keysText] = await Promise.all([
    text('harness'),
    text('catalog'),
    text('keys'),
  ]);
  const keys: string[] = JSON.parse(keysText);
  const count = Math.min(PAGE_MESSAGES, Number(query.get('n')));
  intlFloor(now);
  globalThis.gc!();

  const start = now();
  (0, eval)(harness);
  const evaluated = now();
  const runtime = globalThis.__bench;
  const catalog = (runtime.parse ?? JSON.parse)(catalogText);
  const loaded = now();
  const render = runtime.make(catalog as never);
  let chars = 0;
  for (let i = 0; i < count; i++)
    chars += render(keys[i]!, valuesFor(i), i).length;
  const rendered = now();
  return {
    evalRuntime: evaluated - start,
    load: loaded - evaluated,
    render: rendered - loaded,
    chars,
    isolated: globalThis.crossOriginIsolated,
  };
}

measure().then(
  (result) => (globalThis.__result = result),
  (error) => (globalThis.__result = { error: String(error?.stack ?? error) })
);
