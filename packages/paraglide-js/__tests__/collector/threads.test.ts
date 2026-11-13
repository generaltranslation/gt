// The CLI's analysis in worker threads, which run the built package: these
// tests need `dist` (CI builds it before testing).
import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ModuleSummary } from '../../src/compiler/analysis/module-store.js';
import {
  ChunkQueue,
  widelyImported,
} from '../../src/compiler/collector/analysis-pool.js';
import { nameList } from '../../src/compiler/utils/name-list.js';
import { writeProject } from '../helpers/fixture.js';

const DIST = path.resolve(import.meta.dirname, '../../dist/src/compiler');
const CLI = path.join(DIST, 'cli/index.js');

type Pool = typeof import('../../src/compiler/collector/analysis-pool.js');

/** The built pool, whose threads run the built analysis. */
const builtPool = (): Promise<Pool> =>
  import(pathToFileURL(path.join(DIST, 'collector/analysis-pool.js')).href);

const run = promisify(execFile);

/** Many modules pass messages to a function of another: the threads load each other's modules. */
function pages(count: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `src/pages/page${index}.ts`,
      [
        `import { m } from "../paraglide/messages.js";`,
        `import { show } from "../show.js";`,
        `import { label${(index + 1) % count} } from "./page${(index + 1) % count}.js";`,
        `export const label${index} = (text: () => string) => show(text);`,
        index % 3 === 0
          ? `export const title${index} = label${(index + 1) % count}(m.greeting);`
          : `export const title${index} = label${(index + 1) % count}(() => "plain");`,
      ].join('\n'),
    ])
  );
}

/** A module that imports `imported` and re-exports everything of `reexported`. */
const summary = (
  file: string,
  imported: readonly string[],
  reexported: readonly string[] = []
): ModuleSummary => ({
  file,
  parts: [
    {
      resolved: [...imported, ...reexported].map((target) => [target, target]),
      links: reexported.map((source) => ({ type: 'star', source })),
      untrackedExports: nameList([]),
      globalNames: [],
    },
  ],
});

async function collectWith(
  root: string,
  threads: number
): Promise<{ metadata: string; log: string }> {
  const metadataFile = path.join(root, 'messages/en.metadata.json');
  await fs.rm(metadataFile, { force: true });

  const { stdout, stderr } = await run(
    process.execPath,
    [CLI, root, '--verbose'],
    { env: { ...process.env, PARAGLIDE_CONTEXT_THREADS: String(threads) } }
  );

  return {
    metadata: await fs.readFile(metadataFile, 'utf8'),
    log: stdout + stderr,
  };
}

describe.skipIf(!existsSync(CLI))('analysis threads', () => {
  test('write what the main thread writes, for scripts and generated components', async () => {
    const root = await writeProject('threads', {
      'src/show.ts': `export function show(label: () => string) { return label(); }\n`,
      ...pages(40),
      'src/Card.vue': `<script setup>\nimport { m } from "./paraglide/messages.js";\nimport { show } from "./show.js";\n</script>\n<template><p>{{ show(m.greeting) }}</p></template>\n`,
      'src/Card.svelte': `<script>\n  import { m } from "./paraglide/messages.js";\n</script>\n<p title={m.greeting()}></p>\n`,
      'app/page.astro': `---\nimport { m } from "../src/paraglide/messages.js";\n---\n<p>{m.greeting()}</p>\n`,
      // The Vue tooling's TypeScript imports from "vue", which an app has installed.
      'node_modules/vue/package.json': `{ "name": "vue", "main": "index.js" }`,
      'node_modules/vue/index.js': '',
    });

    const inMainThread = await collectWith(root, 0);
    const inThreads = await collectWith(root, 2);

    expect(inMainThread.metadata).toContain('src/Card.vue');
    expect(inMainThread.metadata).toContain('src/show.ts');
    expect(inThreads).toEqual(inMainThread);
  });

  describe('how many', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    });

    test('as many as the memory a container is given holds', async () => {
      const { analysisThreads } = await builtPool();
      vi.stubEnv('PARAGLIDE_CONTEXT_THREADS', '');
      vi.spyOn(os, 'availableParallelism').mockReturnValue(18);
      vi.spyOn(os, 'totalmem').mockReturnValue(128_000_000_000);
      const constrained = vi.spyOn(process, 'constrainedMemory');

      constrained.mockReturnValue(0);
      expect(analysisThreads(144_000_000, 16_000_000)).toBe(17);

      constrained.mockReturnValue(8_000_000_000);
      expect(analysisThreads(144_000_000, 16_000_000)).toBe(0);
    });

    test.each([
      [16_000_000, 3],
      [32_000_000, 2],
    ])(
      'fewer, the larger their budget: %i characters, %i threads',
      async (budget, threads) => {
        const { analysisThreads } = await builtPool();
        vi.stubEnv('PARAGLIDE_CONTEXT_THREADS', '');
        vi.spyOn(os, 'availableParallelism').mockReturnValue(18);
        vi.spyOn(os, 'totalmem').mockReturnValue(16_000_000_000);
        vi.spyOn(process, 'constrainedMemory').mockReturnValue(0);

        expect(analysisThreads(144_000_000, budget)).toBe(threads);
      }
    );

    test('PARAGLIDE_CONTEXT_THREADS, a whole number', async () => {
      const { analysisThreads } = await builtPool();

      vi.stubEnv('PARAGLIDE_CONTEXT_THREADS', '3');
      expect(analysisThreads(0, 0)).toBe(3);

      for (const invalid of ['0.5', '-1', 'Infinity', 'two']) {
        vi.stubEnv('PARAGLIDE_CONTEXT_THREADS', invalid);
        expect(() => analysisThreads(0, 0)).toThrow(
          `PARAGLIDE_CONTEXT_THREADS is a number of threads, 0 or more; it is "${invalid}".`
        );
      }
    });
  });

  test('fail, rather than wait, when one fails or exits', async () => {
    const { AnalysisPool } = await builtPool();
    const root = await writeProject('threads-failure', { 'src/a.ts': '' });
    const file = path.join(root, 'src/a.ts');

    // A summary without parts fails the threads' indexing.
    const failing = new AnalysisPool(2, root);
    const broken = {
      summaries: [{ file, parts: null as never }],
      outdirs: [],
      globals: [],
      budget: 0,
    };
    await expect(
      failing.analyze(broken, [file], async () => {})
    ).rejects.toThrow('null');
    await failing.close();

    // Closed while it has a request.
    const exiting = new AnalysisPool(1, root);
    const pending = exiting.summarize(file);
    await new Promise((resolve) => setImmediate(resolve));
    await exiting.close();

    await expect(pending).rejects.toThrow('an analysis thread exited');
    await expect(exiting.summarize(file)).rejects.toThrow(
      'an analysis thread exited'
    );
  });

  // The file whose usages fail, how many modules import it, and the files
  // analyzed. One thread: the chunk after the failing file's is analyzed
  // while its usages fail.
  test.each([
    ['in its share', 0, 0, [...Array(32).keys()]],
    // Alone, before the shares.
    ['widely imported', 40, 1000, [40, ...Array(16).keys()]],
  ])(
    'fail with the error recording a file gave, once the chunks started are done: %s',
    async (_, failing, importers, analyzed) => {
      const { AnalysisPool } = await builtPool();
      const root = await writeProject('threads-callback', {});
      // Three chunks of files the index does not list: each has no usages.
      const files = Array.from({ length: 48 }, (_, index) =>
        path.join(root, `src/file${index}.ts`)
      );
      const summaries = Array.from({ length: importers }, (_, index) =>
        summary(path.join(root, `src/importer${index}.ts`), [files[failing]!])
      );
      const failure = new Error('could not read');
      const recorded: string[] = [];

      const pool = new AnalysisPool(1, root);
      const index = { summaries, outdirs: [], globals: [], budget: 0 };
      try {
        await expect(
          pool.analyze(index, files, async (file) => {
            recorded.push(file);
            if (file === files[failing]) throw failure;
          })
        ).rejects.toBe(failure);
      } finally {
        await pool.close();
      }

      expect(recorded).toEqual(analyzed.map((at) => files[at]));
    }
  );
});

// Stand-in threads, from the sources: these tests do not need `dist`.
describe('starting the analysis threads', () => {
  let started: FakeWorker[] = [];
  /** The index of the thread that fails to start. */
  let failing = -1;

  class FakeWorker extends EventEmitter {
    readonly workerData: { concurrentReads: number };
    readonly terminate = vi.fn(async () => 0);

    constructor(
      _url: URL,
      options: { workerData: { concurrentReads: number } }
    ) {
      super();
      if (started.length === failing) {
        throw new Error('ERR_WORKER_INIT_FAILED');
      }

      this.workerData = options.workerData;
      started.push(this);
    }
  }

  async function sourcePool(): Promise<Pool> {
    vi.doMock('node:worker_threads', async (importOriginal) => ({
      ...(await importOriginal<typeof import('node:worker_threads')>()),
      Worker: FakeWorker,
    }));
    vi.resetModules();

    return import('../../src/compiler/collector/analysis-pool.js');
  }

  beforeEach(() => {
    started = [];
    failing = -1;
  });

  afterEach(() => {
    vi.doUnmock('node:worker_threads');
    vi.resetModules();
  });

  test.each([
    [3, 3, 21],
    [100, 64, 1],
  ])(
    'asked for %i, start %i that read %i files at once each',
    async (size, threads, reads) => {
      const { AnalysisPool } = await sourcePool();

      const pool = new AnalysisPool(size, '/app');

      expect(
        started.map(({ workerData }) => workerData.concurrentReads)
      ).toEqual(Array(threads).fill(reads));
      await pool.close();
    }
  );

  test('end the ones started when another fails to start', async () => {
    const { AnalysisPool } = await sourcePool();
    failing = 2;

    expect(() => new AnalysisPool(3, '/app')).toThrow('ERR_WORKER_INIT_FAILED');
    expect(started.map(({ terminate }) => terminate.mock.calls.length)).toEqual(
      [1, 1]
    );
  });
});

// From the sources: these tests do not need `dist`.
describe('the order files are analyzed in', () => {
  const [F, G, B1, B2] = ['/f.ts', '/g.ts', '/b1.ts', '/b2.ts'] as const;

  const importers = (count: number, imported: string[], first = 0) =>
    Array.from({ length: count }, (_, index) =>
      summary(`/importer${first + index}.ts`, imported)
    );

  test.each([
    ['999 modules import it', importers(999, [F]), []],
    ['1000 modules import it', importers(1000, [F]), [F]],
    [
      '600 modules import it through both of two barrels: 602 modules',
      [summary(B1, [], [F]), summary(B2, [], [F]), ...importers(600, [B1, B2])],
      [],
    ],
    [
      '500 modules import it through each of two barrels: 1002 modules',
      [
        summary(B1, [], [F]),
        summary(B2, [], [F]),
        ...importers(500, [B1]),
        ...importers(500, [B2], 500),
      ],
      [F],
    ],
    [
      '1000 modules import it through barrels that re-export each other',
      [
        summary(B1, [], [F, B2]),
        summary(B2, [], [B1]),
        ...importers(1000, [B2]),
      ],
      [F],
    ],
    [
      '500 modules import it through both barrels that re-export each other: 502 modules',
      [
        summary(B1, [], [F, B2]),
        summary(B2, [], [B1]),
        ...importers(500, [B1, B2]),
      ],
      [],
    ],
  ])('a widely imported file is analyzed first: %s', (_, summaries, first) => {
    expect(widelyImported([F], summaries)).toEqual(first);
  });

  test('the most imported first', () => {
    const summaries = [...importers(1000, [F]), ...importers(1001, [G], 1000)];

    expect(widelyImported([F, G, B1], summaries)).toEqual([G, F]);
  });

  test('each thread takes the first files one at a time, then its share; each file once', () => {
    const files = Array.from({ length: 40 }, (_, index) => `/file${index}.ts`);
    const first = [files[20]!, files[5]!];
    const rest = files.filter((file) => !first.includes(file));
    // Three chunks of the others: thread 0's share is the first, thread 1's the others.
    const queue = new ChunkQueue(files, 2, first);

    expect([0, 1, 0, 0, 1, 1, 0].map((thread) => queue.take(thread))).toEqual([
      [files[20]],
      [files[5]],
      rest.slice(0, 16),
      // Done with its share: from the end of the largest one left.
      rest.slice(32),
      rest.slice(16, 32),
      undefined,
      undefined,
    ]);
  });
});
