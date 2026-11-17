import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  kinds,
  routes,
  useMicroSites,
  type Kind,
  type Values,
} from '@generated';
import { init } from '@init';

type RouteLoader = (typeof routes)[number];
type MicroSites = ReturnType<typeof useMicroSites>;

const WARMUP_PASSES = 50;
const MEASURED_PASSES = 200;

// The count changes on every call, so no result can be reused by value.
const valuesFor = (i: number): Values => ({
  name: 'Ada',
  count: (i % 7) + 1,
  role: 'admin',
});

// A page's first number format and plural rules load ICU's data, which takes
// milliseconds, so no variant is charged for it.
new Intl.NumberFormat(navigator.language).format(1);
new Intl.PluralRules(navigator.language).select(1);

await init();

const root = createRoot(document.getElementById('root')!);
let mounted: Awaited<ReturnType<RouteLoader>>[] = [];
let renders = 0;

function commit(): void {
  const values = valuesFor(renders++);
  flushSync(() =>
    root.render(mounted.map(({ Route }, i) => <Route key={i} {...values} />))
  );
}

/** Milliseconds from importing the routes until React has committed them. */
async function mount(loaders: RouteLoader[]): Promise<number> {
  const start = performance.now();
  mounted = await Promise.all(loaders.map((load) => load()));
  commit();
  return performance.now() - start;
}

/** Nanoseconds per call, for the first call of each site and once warm. */
function measureSites(sites: MicroSites[keyof MicroSites]) {
  let length = 0;
  const pass = (offset: number) => {
    for (let i = 0; i < sites.length; i++) {
      length += sites[i](valuesFor(i + offset)).length;
    }
  };
  let start = performance.now();
  pass(0);
  const first = performance.now() - start;
  for (let i = 0; i < WARMUP_PASSES; i++) pass(i);
  start = performance.now();
  for (let i = 0; i < MEASURED_PASSES; i++) pass(i);
  const warm = (performance.now() - start) / MEASURED_PASSES;
  const nanoseconds = (ms: number) => (ms * 1e6) / sites.length;
  // Returned so the calls cannot be removed as unused.
  return { first: nanoseconds(first), warm: nanoseconds(warm), length };
}

const bench = {
  mount: (routeCount: number) => mount(routes.slice(0, routeCount)),
  mountKind: (kind: Kind) => mount([kinds[kind]]),
  /** Milliseconds to render the mounted routes again and commit. */
  update(): number {
    const start = performance.now();
    commit();
    return performance.now() - start;
  },
  items: () =>
    Array.from(document.querySelectorAll('li'), (item) => item.textContent),
  /** Measures every kind, or only `kind`, which a profile reads best. */
  micro(kind?: keyof MicroSites) {
    let sites: MicroSites | undefined;
    function Probe() {
      sites = useMicroSites();
      return null;
    }
    flushSync(() => root.render(<Probe />));
    return Object.fromEntries(
      Object.entries(sites!)
        .filter(([name]) => kind === undefined || name === kind)
        .map(([name, kindSites]) => [name, measureSites(kindSites)])
    );
  },
};

declare global {
  interface Window {
    __bench: typeof bench;
  }
}
window.__bench = bench;
