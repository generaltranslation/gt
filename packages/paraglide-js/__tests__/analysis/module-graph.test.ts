import { parseSync } from 'oxc-parser';
import { expect, test, vi } from 'vitest';
import {
  ModuleGraph,
  type ModuleGraphOptions,
} from '../../src/compiler/analysis/module-graph.js';
import { IndexedRecords } from '../../src/compiler/analysis/module-store.js';
import { nameList } from '../../src/compiler/utils/name-list.js';
import { messagesTarget } from '../../src/compiler/paraglide/targets.js';

const greeting = {
  type: 'value',
  target: 'message',
  name: 'greeting',
  methods: ['parts'],
  file: '/app/src/paraglide/messages.js',
};

/** The modules of `files`, all in /app/src, with the outdir /app/src/paraglide. */
function graphOf(
  files: Record<string, string>,
  options: Partial<ModuleGraphOptions> = {}
): ModuleGraph {
  return new ModuleGraph({
    targets: [messagesTarget],
    outdirs: ['/app/src/paraglide'],
    resolve: async (specifier) => `/app/src/${specifier.slice(2)}`,
    readModule: async (path) => {
      const code = files[path];
      if (code === undefined) return undefined;

      const { program } = parseSync(path, code, { lang: 'ts', range: true });
      return { code, program: program as never };
    },
    ...options,
  });
}

test('loading many entries walks a module they share once', async () => {
  // a0 → a1 → … → a59: every module reaches all the ones after it.
  const length = 60;
  const file = (index: number) => `/app/src/a${index}.ts`;
  const files = new Map(
    Array.from({ length }, (_, index) => [
      file(index),
      index + 1 < length ? `import "./a${index + 1}.ts";` : '',
    ])
  );

  let followChecks = 0;
  const graph = new ModuleGraph({
    targets: [],
    resolve: async (specifier) => `/app/src/${specifier.slice(2)}`,
    readModule: async (path) => {
      const code = files.get(path);
      if (code === undefined) return undefined;

      const { program } = parseSync(path, code, { lang: 'ts', range: true });
      return { code, program: program as never };
    },
    shouldFollow: () => {
      followChecks++;
      return true;
    },
  });

  await graph.loadPaths([...files.keys()]);

  expect(graph.getRecord(file(length - 1))).toBeDefined();
  // One walk from each entry would check every module after it: 1770 times.
  expect(followChecks).toBeLessThanOrEqual(length);
});

test('a name behind a chain of barrels lists the names of each module once', async () => {
  // a0 → a1 → … → a59 by `export *`: a59 exports `greeting`.
  const length = 60;
  const file = (index: number) => `/app/src/a${index}.ts`;
  const graph = graphOf(
    Object.fromEntries(
      Array.from({ length }, (_, index) => [
        file(index),
        index + 1 < length
          ? `export * from "./a${index + 1}.ts";`
          : `export { greeting } from "./paraglide/messages.js";`,
      ])
    )
  );
  await graph.loadPaths([file(0)]);

  // Every module walked is checked for a target.
  const targetChecks = vi.spyOn(graph, 'targetOf');

  expect(graph.exportOf(file(0), 'greeting')).toEqual(greeting);
  // Listing the names below each barrel anew would check 1831 times.
  expect(targetChecks.mock.calls.length).toBeLessThanOrEqual(2 * length);
});

test('a module in a cycle of barrels lists the names of the whole cycle', async () => {
  const graph = graphOf({
    '/app/src/x.ts': `export * from "./b.ts";`,
    '/app/src/y.ts': `export * from "./a.ts";`,
    '/app/src/a.ts': `export * from "./b.ts";`,
    '/app/src/b.ts': `export * from "./a.ts"; export { greeting } from "./paraglide/messages.js";`,
  });
  await graph.loadPaths(['/app/src/x.ts', '/app/src/y.ts']);

  // Lists b, then a while b is still being listed.
  expect(graph.exportOf('/app/src/x.ts', 'missing')).toBeUndefined();
  expect(graph.exportOf('/app/src/y.ts', 'greeting')).toEqual(greeting);
});

test('a name missed before the module that exports it loads resolves after', async () => {
  const graph = graphOf(
    {
      '/app/src/barrel.ts': `export * from "./i18n.ts";`,
      '/app/src/i18n.ts': `export { greeting } from "./paraglide/messages.js";`,
    },
    { shouldFollow: (file) => file !== '/app/src/i18n.ts' }
  );

  await graph.loadPaths(['/app/src/barrel.ts']);
  expect(graph.exportOf('/app/src/barrel.ts', 'greeting')).toBeUndefined();

  await graph.loadPaths(['/app/src/i18n.ts']);
  expect(graph.exportOf('/app/src/barrel.ts', 'greeting')).toEqual(greeting);
});

test('a name missed before its outdir is verified resolves after', async () => {
  let ask = () => {};
  let verify = (_verified: boolean) => {};
  const asked = new Promise<void>((resolve) => (ask = resolve));
  const graph = graphOf(
    { '/app/src/barrel.ts': `export * from "./i18n/messages.js";` },
    {
      outdirs: [],
      isOutdir: () => {
        ask();
        return new Promise((resolve) => (verify = resolve));
      },
    }
  );

  // The barrel is loaded, and the outdir of what it re-exports is being verified.
  const loading = graph.loadPaths(['/app/src/barrel.ts']);
  await asked;
  expect(graph.exportOf('/app/src/barrel.ts', 'greeting')).toBeUndefined();

  verify(true);
  await loading;
  expect(graph.exportOf('/app/src/barrel.ts', 'greeting')).toEqual({
    ...greeting,
    file: '/app/src/i18n/messages.js',
  });
});

const [a, b, c] = ['/app/src/a.ts', '/app/src/b.ts', '/app/src/c.ts'] as const;
/** Every module has this code, so a budget is a number of modules. */
const code = 'export {};';

/** An index of a.ts, b.ts and c.ts; `loads` lists the files it loaded. */
function indexedRecords(budget: number, failing = new Set<string>()) {
  const loads: string[] = [];
  const records = new IndexedRecords({
    summaries: [a, b, c].map((file) => ({
      file,
      parts: [
        {
          resolved: [],
          links: [],
          untrackedExports: nameList([]),
          globalNames: [],
        },
      ],
    })),
    budget,
    load: (file) => {
      loads.push(file);
      if (failing.has(file)) return undefined;

      const { program } = parseSync(file, code, { lang: 'ts' });
      return { code, program: program as never };
    },
  });

  return { records, loads };
}

test.each([
  [0, [a, b, c, a], [a], [b, c]],
  [2, [a, b, c, a], [c, a], [b, c]],
  [3, [a, b, c], [b, c, a], []],
])(
  'a budget of %i modules keeps the ones read last loaded',
  (modules, loadedFirst, kept, loadedAgain) => {
    const { records, loads } = indexedRecords(modules * code.length);
    for (const file of [a, b, c, a]) records.get(file);
    expect(loads).toEqual(loadedFirst);
    expect([...records.loaded()].map(({ file }) => file)).toEqual(kept);

    loads.length = 0;
    for (const file of [a, b, c]) records.get(file);
    expect(loads).toEqual(loadedAgain);
  }
);

test('a module that failed to load is loaded when it is read again', () => {
  const failing = new Set([a]);
  const { records, loads } = indexedRecords(0, failing);

  expect(records.get(a)).toBeUndefined();
  expect([...records.loaded()]).toEqual([]);

  failing.delete(a);
  expect(records.get(a)?.file).toBe(a);
  expect(loads).toEqual([a, a]);
});
