import { describe, expect, test } from 'vitest';
import { ModuleGraph } from '../../src/compiler/analysis/module-graph.js';
import {
  defaultLanguages,
  svelteLanguage,
  vueLanguage,
} from '../../src/compiler/languages/index.js';
import {
  NO_PACKAGES,
  type SourceLanguage,
} from '../../src/compiler/languages/language.js';
import {
  ToolingPool,
  toolingThreads,
  toolingWorkerData,
  type ToolingRequest,
  type ToolingResponse,
  type ToolingThread,
  type ToolingWorkerData,
} from '../../src/compiler/languages/tooling-pool.js';
import {
  runTooling,
  toolingHandler,
} from '../../src/compiler/languages/tooling.js';
import { defaultTargets } from '../../src/compiler/paraglide/targets.js';
import { projectPackages } from '../../src/compiler/project/packages.js';
import { OUTDIR, REPO_PACKAGES } from '../helpers/project.js';

/** A seeded order of delays: threads finish in another order than they start. */
function delays(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state % 7;
  };
}

/**
 * A thread on this one: it answers with the worker's own handler, after a
 * delay. `fails` makes it fail on a request, as a crashed thread does.
 */
class FakeThread implements ToolingThread {
  referenced = false;
  terminated = false;
  handled: string[] = [];
  private readonly listeners = new Map<string, Array<(value: never) => void>>();

  constructor(
    private readonly handle: (
      request: ToolingRequest
    ) => Promise<ToolingResponse>,
    private readonly delay: (request: ToolingRequest) => number,
    private readonly fails: (request: ToolingRequest) => boolean = () => false
  ) {}

  postMessage(request: ToolingRequest): void {
    setTimeout(async () => {
      if (this.terminated) return;
      if (this.fails(request)) {
        this.emit('error', new Error('the thread failed'));
        this.emit('exit', 1);
        return;
      }

      this.handled.push(request.file);
      this.emit('message', await this.handle(request));
    }, this.delay(request));
  }

  on(event: string, listener: (value: never) => void): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  ref(): void {
    this.referenced = true;
  }

  unref(): void {
    this.referenced = false;
  }

  async terminate(): Promise<number> {
    this.terminated = true;
    this.emit('exit', 1);
    return 1;
  }

  private emit(event: string, value: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(value as never);
    }
  }
}

const ALL_LANGUAGES: ToolingWorkerData = {
  languages: defaultLanguages.map((_, index) => index),
};

/** The languages, with the tools installed in this repo. */
const WITH_TOOLS: ToolingWorkerData = {
  ...ALL_LANGUAGES,
  packagesRoot: REPO_PACKAGES.root,
};

/** A pool of `size` fake threads; the threads it started. */
function fakePool(
  size: number,
  seed = 1,
  fails?: (request: ToolingRequest, thread: number) => boolean,
  data = WITH_TOOLS
) {
  const threads: FakeThread[] = [];
  const delay = delays(seed);
  const pool = new ToolingPool(size, () => {
    const index = threads.length;
    const thread = new FakeThread(
      toolingHandler(data),
      delay,
      fails && ((request) => fails(request, index))
    );
    threads.push(thread);
    return thread;
  });

  return { pool, threads };
}

const vue = (id: string) =>
  `<script setup lang="ts">\nimport { m } from "./paraglide/messages.js";\n</script>\n<template><p>{{ m.${id}() }}</p></template>\n`;
const svelte = (id: string) =>
  `<script>\n  import { m } from "./paraglide/messages.js";\n</script>\n<p>{m.${id}()}</p>\n`;

describe('ToolingPool', () => {
  test('runs each file on the next free thread, and answers each caller with its own file', async () => {
    const { pool, threads } = fakePool(3);
    const files = Array.from({ length: 24 }, (_, index) =>
      index % 2
        ? { file: `/app/src/C${index}.vue`, code: vue(`v${index}`) }
        : { file: `/app/src/C${index}.svelte`, code: svelte(`s${index}`) }
    );

    const results = await Promise.all(
      files.map(({ file, code }) => pool.run(file, code))
    );
    const expected = await Promise.all(
      files.map(({ file, code }) =>
        runTooling(file, code, defaultLanguages, REPO_PACKAGES)
      )
    );

    expect(results).toEqual(expected);
    expect(results.every((result) => result?.type === 'generated')).toBe(true);
    expect(threads).toHaveLength(3);
    expect(threads.every((thread) => thread.handled.length > 0)).toBe(true);
    // Idle threads do not keep the process alive.
    expect(threads.some((thread) => thread.referenced)).toBe(false);

    await pool.close();
    expect(threads.every((thread) => thread.terminated)).toBe(true);
  });

  test('runs the files that will take longest first, by what files of their kind took', async () => {
    const handled: string[] = [];
    const thread = new FakeThread(
      toolingHandler(WITH_TOOLS),
      // Vue's tooling is the slow one.
      ({ file }) => (file.endsWith('.vue') ? 30 : 1)
    );
    const pool = new ToolingPool(1, () => thread);
    const files = ['a.md', 'b.vue', 'c.md', 'd.md', 'e.vue', 'f.md', 'g.vue'];

    await Promise.all(
      files.map((name) =>
        pool.run(
          `/app/src/${name}`,
          name.endsWith('.vue') ? vue(name) : `# ${name}`
        )
      )
    );
    handled.push(
      ...thread.handled.map((file) => file.slice('/app/src/'.length))
    );

    // The first file; a Vue file, the longest of a kind not run yet; then, Vue
    // known to be slow, the other Vue files.
    expect(handled).toEqual([
      'a.md',
      'b.vue',
      'e.vue',
      'g.vue',
      'c.md',
      'd.md',
      'f.md',
    ]);
    await pool.close();
  });

  test('starts no more threads than there are files', async () => {
    const { pool, threads } = fakePool(8);
    await pool.run('/app/src/A.vue', vue('a'));
    expect(threads).toHaveLength(1);
    await pool.close();
  });

  test('a file no language claims, and one its tooling rejects, are answered as on the main thread', async () => {
    const { pool } = fakePool(2);
    const broken = '<script>\n  let = ;\n</script>\n';

    expect(await pool.run('/app/src/a.txt', 'text')).toEqual({
      type: 'unclaimed',
    });
    expect(await pool.run('/app/src/Broken.svelte', broken)).toEqual(
      await runTooling(
        '/app/src/Broken.svelte',
        broken,
        defaultLanguages,
        REPO_PACKAGES
      )
    );
    await pool.close();
  });

  test('a thread that fails is not replaced: its file, and those no thread is left for, go back to the caller', async () => {
    // The first thread fails on its first file; the second runs the others.
    const { pool, threads } = fakePool(2, 3, (_, thread) => thread === 0);
    const files = Array.from(
      { length: 6 },
      (_, index) => `/app/src/C${index}.vue`
    );

    const results = await Promise.all(
      files.map((file, index) => pool.run(file, vue(`v${index}`)))
    );

    expect(threads).toHaveLength(2);
    expect(results.filter((result) => result === undefined)).toHaveLength(1);
    expect(
      results.filter((result) => result?.type === 'generated')
    ).toHaveLength(5);

    // Every thread fails: every file goes back.
    const failing = fakePool(2, 5, () => true);
    const answers = await Promise.all(
      files.map((file, index) => failing.pool.run(file, vue(`v${index}`)))
    );
    expect(answers).toEqual(files.map(() => undefined));
    expect(failing.threads).toHaveLength(2);
    expect(await failing.pool.run(files[0]!, vue('a'))).toBeUndefined();
  });

  test('closed, it answers what waits or runs with nothing, for the callers to run', async () => {
    const { pool, threads } = fakePool(1);
    const running = pool.run('/app/src/A.vue', vue('a'));
    const waiting = pool.run('/app/src/B.vue', vue('b'));

    await pool.close();
    expect(await running).toBeUndefined();
    expect(await waiting).toBeUndefined();
    expect(await pool.run('/app/src/C.vue', vue('c'))).toBeUndefined();
    expect(threads.every((thread) => thread.terminated)).toBe(true);
  });
});

describe('what the threads run', () => {
  test("the package's own languages, by position, and the project's packages by its root", () => {
    expect(toolingWorkerData(defaultLanguages, NO_PACKAGES)).toEqual(
      ALL_LANGUAGES
    );
    expect(
      toolingWorkerData([svelteLanguage, vueLanguage], NO_PACKAGES)
    ).toEqual({
      languages: [
        defaultLanguages.indexOf(svelteLanguage),
        defaultLanguages.indexOf(vueLanguage),
      ],
    });
    expect(
      toolingWorkerData(defaultLanguages, projectPackages('/app'))
    ).toEqual({ ...ALL_LANGUAGES, packagesRoot: '/app' });
  });

  test("a language or a package context of the caller's runs on the main thread", () => {
    const custom: SourceLanguage = {
      name: 'custom',
      extensions: ['.custom'],
      generate: () => undefined,
    };
    expect(
      toolingWorkerData([...defaultLanguages, custom], NO_PACKAGES)
    ).toBeUndefined();
    expect(
      toolingWorkerData(defaultLanguages, { load: async () => undefined })
    ).toBeUndefined();
  });

  test('from the TypeScript sources there is no worker to start', () => {
    expect(toolingThreads(10_000)).toBe(0);
  });
});

/** A component of each language, one whose tooling rejects it, and scripts. */
const PROJECT: Record<string, string> = {
  '/app/src/paraglide/messages.js': 'export {}',
  '/app/src/A.vue': vue('a'),
  '/app/src/B.svelte': svelte('b'),
  '/app/src/C.svelte': `<script>\n  import { m } from "./paraglide/messages.js";\n  export let label = m.c;\n</script>\n<p>{label()}</p>\n`,
  '/app/src/pages/D.astro': `---\nimport { m } from "../paraglide/messages.js";\n---\n<h1>{m.d()}</h1>\n`,
  '/app/src/E.mdx': `import { m } from "./paraglide/messages.js";\n\n# {m.e()}\n`,
  '/app/src/F.marko': `import { m } from "./paraglide/messages.js";\n<p>\${m.f()}</p>\n`,
  '/app/src/G.gts': `import { m } from "./paraglide/messages.js";\n<template><p>{{m.g}}</p></template>\n`,
  '/app/src/app/h.component.ts': `import { Component } from "@angular/core";\nimport { m } from "../paraglide/messages.js";\n@Component({ selector: "app-h", templateUrl: "./h.component.html" })\nexport class HComponent {\n  readonly m = m;\n}\n`,
  '/app/src/app/h.component.html': `<p>{{ m.h() }}</p>\n`,
  '/app/src/Broken.svelte': '<script>\n  let = ;\n</script>\n',
  '/app/src/Broken.vue': '<template><p>{{ m.( }}</p></template>\n',
  '/app/src/i.ts': `import { m } from "./paraglide/messages.js";\nexport const i = m.i();\n`,
  '/app/src/notes.txt': 'not a source',
};

/** The usages, and the files skipped in the order they were reported. */
async function analyzed(pool?: (files: number) => ToolingPool | undefined) {
  const skipped: string[] = [];
  const graph = await ModuleGraph.create({
    targets: defaultTargets,
    languages: defaultLanguages,
    packages: REPO_PACKAGES,
    outdirs: [OUTDIR],
    resolve: async (specifier, importer) => {
      const file = new URL(specifier, `file://${importer}`).pathname;
      return file in PROJECT ? file : undefined;
    },
    read: async (file) => PROJECT[file],
    onSkipped: (file, { error }) => void skipped.push(`${file}: ${error}`),
    toolingPool: pool,
  });

  const files = Object.keys(PROJECT).filter(
    (file) => !file.includes('paraglide')
  );
  await graph.loadPaths(files);
  const usages = await graph.analyze(files);

  return { usages: [...usages].sort(), skipped };
}

test('a graph whose tooling runs on threads analyzes as one whose tooling runs on the main thread', async () => {
  const expected = await analyzed();
  expect(expected.skipped).toHaveLength(2);
  expect(expected.usages.map(([file]) => file)).toEqual(
    expect.arrayContaining([
      '/app/src/A.vue',
      '/app/src/B.svelte',
      '/app/src/pages/D.astro',
      '/app/src/app/h.component.html',
      '/app/src/i.ts',
    ])
  );

  for (const seed of [1, 2, 3]) {
    const pools: ReturnType<typeof fakePool>[] = [];
    const actual = await analyzed(() => {
      const made = fakePool(4, seed);
      pools.push(made);
      return made.pool;
    });

    expect(actual).toEqual(expected);
    // The threads ran the files, and were stopped before the analysis.
    expect(
      pools
        .flatMap(({ threads }) => threads)
        .some((thread) => thread.handled.length > 0)
    ).toBe(true);
    expect(
      pools.every(({ threads }) => threads.every((thread) => thread.terminated))
    ).toBe(true);
  }
});
