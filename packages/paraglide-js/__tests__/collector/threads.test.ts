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
      expect(analysisThreads(144_000_000)).toBe(17);

      constrained.mockReturnValue(8_000_000_000);
      expect(analysisThreads(144_000_000)).toBe(0);
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
    };
    await expect(failing.analyze(broken, [file])).rejects.toThrow('null');
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
