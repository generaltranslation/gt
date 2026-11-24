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
import v8 from 'node:v8';
import { MessageChannel, type MessagePort } from 'node:worker_threads';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type {
  IndexedGraphOptions,
  SharedSites,
  SitesJob,
} from '../../src/compiler/analysis/module-graph.js';
import type { ModuleSummary } from '../../src/compiler/analysis/module-store.js';
import type { TrackedSymbol } from '../../src/compiler/analysis/types.js';
import {
  ChunkQueue,
  widelyImported,
  type ChunkMessage,
  type SharedChannel,
  type SharedJob,
  type WorkerRequest,
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

const value = (name: string): TrackedSymbol => ({
  type: 'value',
  target: 'message',
  name,
  methods: [],
  file: '/app/src/paraglide/messages.js',
});

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
    beforeEach(() => {
      // A heap flag the tests run with would size the threads.
      vi.stubEnv('NODE_OPTIONS', '');
    });

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
      expect(analysisThreads(144_000_000)).toBe(17);

      // Half of it, for threads of 1.5 GB of heap and 0.5 GB besides.
      constrained.mockReturnValue(8 * 1024 ** 3);
      expect(analysisThreads(144_000_000)).toBe(2);

      constrained.mockReturnValue(4 * 1024 ** 3);
      expect(analysisThreads(144_000_000)).toBe(0);
    });

    test('as many as PARAGLIDE_CONTEXT_MEMORY_MB holds, a number of megabytes', async () => {
      const { analysisThreads } = await builtPool();
      vi.stubEnv('PARAGLIDE_CONTEXT_THREADS', '');
      vi.spyOn(os, 'availableParallelism').mockReturnValue(18);
      vi.spyOn(os, 'totalmem').mockReturnValue(128_000_000_000);

      vi.stubEnv('PARAGLIDE_CONTEXT_MEMORY_MB', String(8 * 1024));
      expect(analysisThreads(144_000_000)).toBe(2);

      for (const invalid of ['0', '-1', 'Infinity', 'eight']) {
        vi.stubEnv('PARAGLIDE_CONTEXT_MEMORY_MB', invalid);
        expect(() => analysisThreads(144_000_000)).toThrow(
          `PARAGLIDE_CONTEXT_MEMORY_MB is a number of megabytes, more than 0; it is "${invalid}".`
        );
      }
    });

    test("a thread's module budget is sized by its heap, not the main thread's", async () => {
      const { threadBudget, THREAD_HEAP_MB } = await builtPool();

      // 10,000-line files: the heap, not the files, sets it.
      expect(threadBudget(280_000)).toBeCloseTo(
        (THREAD_HEAP_MB * 1024 * 1024) / 3.5 / 40
      );
    });

    test('by the heap a Node flag, e.g. in NODE_OPTIONS, gives every thread over its cap', async () => {
      const { analysisThreads, threadBudget } = await builtPool();
      vi.stubEnv('PARAGLIDE_CONTEXT_THREADS', '');
      vi.spyOn(os, 'availableParallelism').mockReturnValue(18);
      vi.spyOn(os, 'totalmem').mockReturnValue(128_000_000_000);
      vi.spyOn(process, 'constrainedMemory').mockReturnValue(0);
      const statistics = v8.getHeapStatistics();
      const heap = vi.spyOn(v8, 'getHeapStatistics');

      // Half of 128 GB, for threads of 8 GB of heap and 0.5 GB besides.
      vi.stubEnv('NODE_OPTIONS', '--max-old-space-size=8192');
      heap.mockReturnValue({
        ...statistics,
        heap_size_limit: 8192 * 1024 ** 2,
      });
      expect(analysisThreads(144_000_000)).toBe(7);

      // 512 MB of heap: a module budget for it, not for 1.5 GB.
      vi.stubEnv(
        'NODE_OPTIONS',
        '--require ./setup.js --max_old_space_size=512'
      );
      heap.mockReturnValue({ ...statistics, heap_size_limit: 512 * 1024 ** 2 });
      expect(threadBudget(280_000)).toBeCloseTo((512 * 1024 ** 2) / 3.5 / 40);
    });

    test('PARAGLIDE_CONTEXT_THREADS, a whole number', async () => {
      const { analysisThreads } = await builtPool();

      vi.stubEnv('PARAGLIDE_CONTEXT_THREADS', '3');
      expect(analysisThreads(0)).toBe(3);

      for (const invalid of ['0.5', '-1', 'Infinity', 'two']) {
        vi.stubEnv('PARAGLIDE_CONTEXT_THREADS', invalid);
        expect(() => analysisThreads(0)).toThrow(
          `PARAGLIDE_CONTEXT_THREADS is a number of threads, 0 or more; it is "${invalid}".`
        );
      }
    });
  });

  test('run a task again in a thread with a larger heap when one runs out of memory', async () => {
    const { AnalysisPool } = await builtPool();
    // Its syntax tree takes far more than a 16 MB heap.
    const big = Array.from(
      { length: 60_000 },
      (_, line) =>
        `export const value${line} = { key: "${line}", list: [${line}] };`
    ).join('\n');
    const root = await writeProject('threads-out-of-memory', {
      'src/big.ts': big,
      'src/small.ts': 'export const small = 1;',
    });
    const pool = new AnalysisPool(1, root, { heapMb: 16, largeHeapMb: 1024 });

    try {
      const result = await pool.summarize(path.join(root, 'src/big.ts'));
      expect(result && 'summary' in result).toBe(true);

      // Then in a thread of the usual heap again.
      const next = await pool.summarize(path.join(root, 'src/small.ts'));
      expect(next && 'summary' in next).toBe(true);
    } finally {
      await pool.close();
    }
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
describe('stand-in analysis threads', () => {
  let started: FakeWorker[] = [];
  /** The index of the thread that fails to start. */
  let failing = -1;
  /** While set, a thread told to end exits only once `exit()` is called. */
  let isExitHeld = false;
  const index = { summaries: [], outdirs: [], globals: [], budget: 0 };
  /** How a thread answers every request, if a test sets it: otherwise as `postMessage` says. */
  let respond:
    | ((worker: FakeWorker, request: WorkerRequest) => void)
    | undefined;

  class FakeWorker extends EventEmitter {
    readonly workerData: { concurrentReads: number };
    readonly heapMb: number;
    /** The type of each request it was sent. */
    readonly tasks: string[] = [];
    /** The requests it has not answered: it answers an index at once. */
    readonly pending: Array<{ id: number; files: readonly string[] }> = [];
    exit = (): void => {};
    readonly terminate = vi.fn(async () => {
      if (isExitHeld) {
        await new Promise<void>((resolve) => (this.exit = () => resolve()));
      }
      this.emit('exit', 1);
      return 1;
    });

    reply(id: number, response: { result?: unknown; error?: string }): void {
      setImmediate(() => this.emit('message', { id, ...response }));
    }

    constructor(
      _url: URL,
      options: {
        workerData: { concurrentReads: number };
        resourceLimits: { maxOldGenerationSizeMb: number };
      }
    ) {
      super();
      if (started.length === failing) {
        throw new Error('ERR_WORKER_INIT_FAILED');
      }

      this.workerData = options.workerData;
      this.heapMb = options.resourceLimits.maxOldGenerationSizeMb;
      started.push(this);
    }

    /** Answers an index at once, and holds the other requests until `answer()`. */
    postMessage(request: WorkerRequest): void {
      this.tasks.push(request.type);
      if (respond) {
        respond(this, request);
      } else if (request.type === 'index') {
        queueMicrotask(() => this.emit('message', { id: request.id }));
      } else if ('files' in request) {
        this.pending.push(request);
      }
    }

    /** Answers its oldest request, or the one at `at`: `{ file }` for each file. */
    answer(at = 0): void {
      const { id, files } = this.pending.splice(at, 1)[0]!;
      this.emit('message', { id, result: files.map((file) => ({ file })) });
    }
  }

  /** Once what the pool does next has run. */
  const settle = () => new Promise((resolve) => setImmediate(resolve));

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
    isExitHeld = false;
    respond = undefined;
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

  test('analyze in new threads, started once the ones that indexed exited', async () => {
    const { AnalysisPool, THREAD_HEAP_MB } = await sourcePool();
    const pool = new AnalysisPool(2, '/app');
    isExitHeld = true;

    const analysis = pool.analyze(index, [], async () => {});
    await settle();
    expect(started.map(({ terminate }) => terminate.mock.calls.length)).toEqual(
      [1, 1]
    );

    isExitHeld = false;
    for (const worker of started) worker.exit();
    await analysis;
    expect(started.map(({ heapMb, tasks }) => [heapMb, tasks])).toEqual([
      [THREAD_HEAP_MB, []],
      [THREAD_HEAP_MB, []],
      [THREAD_HEAP_MB, ['index']],
      [THREAD_HEAP_MB, ['index']],
    ]);
    await pool.close();
  });

  test('fail to analyze, ending the new threads, when one fails to start', async () => {
    const { AnalysisPool } = await sourcePool();
    const pool = new AnalysisPool(2, '/app');
    failing = 3;

    await expect(pool.analyze(index, [], async () => {})).rejects.toThrow(
      'ERR_WORKER_INIT_FAILED'
    );
    expect(started.map(({ terminate }) => terminate.mock.calls.length)).toEqual(
      [1, 1, 1]
    );
    await pool.close();
  });

  test('end an analysis thread once no file is left for it, while another still analyzes', async () => {
    const { AnalysisPool } = await sourcePool();
    const pool = new AnalysisPool(2, '/app');
    // A chunk for each thread.
    const files = Array.from({ length: 32 }, (_, at) => `/app/file${at}.ts`);
    const analyzed: unknown[] = [];

    const analysis = pool.analyze(index, files, async (file, usages) => {
      analyzed.push([file, usages]);
    });
    await settle();
    const [, , done, busy] = started;
    done!.answer();
    await settle();
    expect(started.map(({ terminate }) => terminate.mock.calls.length)).toEqual(
      [1, 1, 1, 0]
    );

    busy!.answer();
    await analysis;
    expect(analyzed).toEqual(files.map((file) => [file, { file }]));
    await pool.close();
  });

  test('when one exits, fail once the files the others analyzed are recorded', async () => {
    const { AnalysisPool } = await sourcePool();
    // Two chunks: one for each thread.
    const files = Array.from({ length: 32 }, (_, at) => `/app/f${at}.ts`);
    const pool = new AnalysisPool(2, '/app');
    const recorded: string[] = [];

    try {
      const analysis = pool.analyze(index, files, async (file) => {
        // As a file read, which ends after the thread exited.
        await new Promise((resolve) => setImmediate(resolve));
        recorded.push(file);
      });
      await settle();
      // The analysis starts threads of its own: one answers, the other exits on its chunk.
      const [answering, exiting] = started.slice(-2);
      answering!.answer();
      exiting!.emit('exit', 1);

      await expect(analysis).rejects.toThrow(
        'an analysis thread exited with code 1'
      );
    } finally {
      await pool.close();
    }

    expect(recorded).toEqual(files.slice(0, 16));
  });

  describe('running out of memory', () => {
    /** What a thread fails with when it reaches its heap limit. */
    const outOfMemory = () =>
      Object.assign(new Error('JS heap out of memory'), {
        code: 'ERR_WORKER_OUT_OF_MEMORY',
      });

    test('analyze a chunk again with a larger heap, then the next with the usual one, each thread given the index', async () => {
      const { AnalysisPool, THREAD_HEAP_MB, LARGE_THREAD_HEAP_MB } =
        await sourcePool();
      const pool = new AnalysisPool(1, '/app');
      // Two chunks: the thread runs out of memory on the first.
      const files = Array.from({ length: 17 }, (_, at) => `/app/file${at}.ts`);
      const analyzed: unknown[] = [];

      const analysis = pool.analyze(index, files, async (file, usages) => {
        analyzed.push([file, usages]);
      });
      await settle();
      started[1]!.emit('error', outOfMemory());
      await settle();
      started[2]!.answer();
      await settle();
      started[3]!.answer();
      await analysis;

      expect(analyzed).toEqual(files.map((file) => [file, { file }]));
      expect(started.map(({ heapMb, tasks }) => [heapMb, tasks])).toEqual([
        [THREAD_HEAP_MB, []],
        [THREAD_HEAP_MB, ['index', 'analyze']],
        [LARGE_THREAD_HEAP_MB, ['index', 'analyze']],
        [THREAD_HEAP_MB, ['index', 'analyze']],
      ]);
      await pool.close();
    });

    test('fail when the thread with the larger heap runs out of memory too', async () => {
      const { AnalysisPool } = await sourcePool();
      const pool = new AnalysisPool(1, '/app');
      const analysis = pool.analyze(index, ['/app/a.ts'], async () => {});
      await settle();
      started[1]!.emit('error', outOfMemory());
      await settle();

      const again = outOfMemory();
      started[2]!.emit('error', again);
      await expect(analysis).rejects.toBe(again);
      // No thread is started after it.
      expect(started).toHaveLength(3);
      await pool.close();
    });

    test('send no other batch to a slot while its batch runs again', async () => {
      const { AnalysisPool } = await sourcePool();
      const pool = new AnalysisPool(2, '/app');
      const files = ['/app/a.ts', '/app/b.ts', '/app/c.ts'];
      // A batch for each thread.
      const summaries = files.slice(0, 2).map((file) => pool.summarize(file));
      await settle();

      // A file queued while the thread out of memory exits.
      isExitHeld = true;
      started[0]!.emit('error', outOfMemory());
      await settle();
      summaries.push(pool.summarize(files[2]!));
      await settle();
      isExitHeld = false;
      started[0]!.exit();
      await settle();

      // The batch run again is done first, and its thread ends.
      const large = started[2]!;
      large.answer(large.pending.length - 1);
      await settle();
      for (const worker of started) {
        while (worker.pending.length > 0) worker.answer();
      }

      await expect(Promise.all(summaries)).resolves.toEqual(
        files.map((file) => ({ file }))
      );
      await pool.close();
    });
  });

  test.each([
    [
      'sends values',
      { result: [{ chunk: 0, symbols: [value('greeting')] }] },
      [
        { id: 0, chunk: 0, symbols: [value('greeting')] },
        { id: 0, done: true },
      ],
    ],
    ['fails', { error: 'a helper failed' }, [{ id: 0, done: true }]],
  ])(
    'when a helper %s, tell the thread that shared the job what it sent, then that no helper holds a range',
    async (_, helped, expected) => {
      const { AnalysisPool } = await sourcePool();
      const job: SharedJob = {
        id: 0,
        file: '/app/src/show.ts',
        part: 0,
        read: 0,
        referrers: 16,
        chunks: 1,
        claims: new SharedArrayBuffer(4),
      };
      const received: ChunkMessage[] = [];
      const channels = new Map<FakeWorker, SharedChannel>();

      // The first analyzing thread shares a job and waits until no helper holds a range of it.
      respond = (worker, request) => {
        if (request.type === 'index') channels.set(worker, request.channel);
        if (request.type === 'analyze') {
          worker.emit('message', { share: job });
          channels.get(worker)!.port.on('message', (message: ChunkMessage) => {
            received.push(message);
            if ('done' in message) worker.reply(request.id, { result: [[]] });
          });
          return;
        }
        if (request.type === 'help') {
          Atomics.add(new Int32Array(job.claims), 0, 1);
          worker.reply(request.id, helped);
          return;
        }

        worker.reply(request.id, {});
      };

      const pool = new AnalysisPool(2, '/app');
      const index = { summaries: [], outdirs: [], globals: [], budget: 0 };
      await pool.analyze(index, ['/app/src/a.ts'], async () => {});
      await pool.close();

      expect(received).toEqual(expected);
    }
  );
});

// A thread's side of sharing a function's sites, from the sources, with a
// stand-in parent port and graph: these tests do not need `dist`.
describe("sharing a function's sites in a thread", () => {
  let parent: EventEmitter & { postMessage(message: unknown): void };
  let shared: SharedSites;
  let helpers: MessagePort;
  const evaluateSharedSites = vi.fn();

  /** What the pool and other threads do once the thread shares a job, before it waits. */
  let onShare: (job: SharedJob) => void;

  const send = (request: WorkerRequest) =>
    new Promise<unknown>((resolve) => {
      parent.on('posted', (message: { id?: number; result?: unknown }) => {
        if (message.id === request.id) resolve(message.result);
      });
      parent.emit('message', request);
    });

  beforeEach(async () => {
    parent = Object.assign(new EventEmitter(), {
      postMessage(message: { share?: SharedJob }) {
        if (message.share) onShare(message.share);
        else parent.emit('posted', message);
      },
    });
    onShare = () => {};
    evaluateSharedSites.mockReset();

    vi.doMock('node:worker_threads', async (importOriginal) => ({
      ...(await importOriginal<typeof import('node:worker_threads')>()),
      parentPort: parent,
      workerData: { projectRoot: '/app', concurrentReads: 1 },
    }));
    vi.doMock(
      '../../src/compiler/analysis/module-graph.js',
      async (importOriginal) => ({
        ...(await importOriginal<
          typeof import('../../src/compiler/analysis/module-graph.js')
        >()),
        ModuleGraph: class {
          evaluateSharedSites = evaluateSharedSites;
          constructor(options: IndexedGraphOptions) {
            shared = options.shared!;
          }
        },
      })
    );
    vi.resetModules();
    await import('../../src/compiler/collector/analysis-worker.js');

    const serialized = v8.serialize({
      summaries: [],
      outdirs: [],
      globals: [],
      generated: { fd: -1, places: [] },
      budget: 0,
    });
    const index = new SharedArrayBuffer(serialized.length);
    serialized.copy(Buffer.from(index));
    const { port1, port2 } = new MessageChannel();
    helpers = port1;
    const flag = new Int32Array(new SharedArrayBuffer(4));
    await send({ id: 0, type: 'index', index, channel: { port: port2, flag } });
  });

  afterEach(() => {
    helpers.close();
    vi.doUnmock('node:worker_threads');
    vi.doUnmock('../../src/compiler/analysis/module-graph.js');
    vi.resetModules();
  });

  /** Of a function with `referrers` referrers: `values` gives what a range of them passes. */
  function sitesJob(
    referrers: number,
    values: (from: number) => TrackedSymbol[],
    evaluated: Array<[number, number]> = []
  ): SitesJob {
    return {
      file: '/app/src/show.ts',
      part: 0,
      read: 40,
      referrers,
      own: () => [value('own')],
      range: (from, to) => {
        evaluated.push([from, to]);
        return values(from);
      },
    };
  }

  test('use the values helpers sent, and evaluate the ranges they did not', () => {
    // Four ranges: helpers take the first three. The first's values are
    // sent, the second's cannot be, and the third's helper fails.
    onShare = ({ id, claims }) => {
      Atomics.add(new Int32Array(claims), 0, 3);
      helpers.postMessage({ id, chunk: 0, symbols: [value('sent')] });
      helpers.postMessage({ id, chunk: 1, symbols: null });
      helpers.postMessage({ id, done: true });
    };
    const evaluated: Array<[number, number]> = [];

    const values = shared.share(
      sitesJob(64, (from) => [value(`from${from}`)], evaluated)
    );

    expect(values).toEqual(
      ['own', 'sent', 'from16', 'from32', 'from48'].map(value)
    );
    expect(evaluated).toEqual([
      [48, 64],
      [16, 32],
      [32, 48],
    ]);
  });

  test('join more values than a call takes arguments, without repeats', () => {
    // More than V8 passes to `push(...values)`, even with a thread's 4 MB stack.
    const many = Array<TrackedSymbol>(600_000).fill(value('greeting'));

    expect(shared.share(sitesJob(32, () => many))).toEqual([
      value('own'),
      value('greeting'),
    ]);
  });

  test('help with the ranges left: send the values of each, null for one that cannot be sent', async () => {
    const claims = new SharedArrayBuffer(4);
    // The thread that shared it took the first.
    Atomics.add(new Int32Array(claims), 0, 1);
    evaluateSharedSites.mockImplementation((_job: SharedJob, from: number) =>
      from === 16 ? [value('greeting')] : undefined
    );
    const job: SharedJob = {
      id: 0,
      file: '/app/src/show.ts',
      part: 0,
      read: 40,
      referrers: 40,
      chunks: 3,
      claims,
    };

    expect(await send({ id: 1, type: 'help', job })).toEqual([
      { chunk: 1, symbols: [value('greeting')] },
      { chunk: 2, symbols: null },
    ]);
    expect(evaluateSharedSites.mock.calls).toEqual([
      [job, 16, 32],
      [job, 32, 40],
    ]);
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
