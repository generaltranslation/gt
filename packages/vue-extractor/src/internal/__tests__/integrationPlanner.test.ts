import fs from 'node:fs';
import path from 'node:path';
import { hashSource } from 'generaltranslation/id';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  planVueExtraction,
  type InlineExtractionOutput,
} from '../../integration.js';
import {
  createProjectFixture,
  linkInstalledVue,
  removeProjectFixture,
  translatableSfc,
} from './projectTestUtils.js';

const temporaryDirectories: string[] = [];
const initialCwd = process.cwd();

afterEach(() => {
  process.chdir(initialCwd);
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    removeProjectFixture(directory);
  }
});

describe('planVueExtraction activation', () => {
  it.each(['dependencies', 'devDependencies'] as const)(
    'activates for a direct root %s declaration',
    (field) => {
      const root = createFixture({
        'package.json': JSON.stringify({ [field]: { 'gt-vue': '*' } }),
      });

      const plan = planVueExtraction({
        library: 'gt-react',
        projectRoot: root,
      });

      expect(plan).not.toBeInstanceOf(Promise);
      expect(plan.handled).toBe(true);
    }
  );

  it('activates for an explicitly selected gt-vue runtime', () => {
    const root = createFixture({
      'package.json': JSON.stringify({ dependencies: { react: '*' } }),
    });

    expect(
      planVueExtraction({ library: 'gt-vue', projectRoot: root }).handled
    ).toBe(true);
  });

  it.each([
    ['peer dependency', { peerDependencies: { 'gt-vue': '*' } }],
    ['optional dependency', { optionalDependencies: { 'gt-vue': '*' } }],
    [
      'dependency overridden by an optional dependency',
      {
        dependencies: { 'gt-vue': '*' },
        optionalDependencies: { 'gt-vue': '*' },
      },
    ],
    [
      'development dependency overridden by an optional dependency',
      {
        devDependencies: { 'gt-vue': '*' },
        optionalDependencies: { 'gt-vue': '*' },
      },
    ],
    [
      'peer and optional dependencies',
      {
        peerDependencies: { 'gt-vue': '*' },
        optionalDependencies: { 'gt-vue': '*' },
      },
    ],
  ])('does not activate for a root %s', (_name, manifest) => {
    const root = createFixture({
      'package.json': JSON.stringify(manifest),
    });

    expect(
      planVueExtraction({ library: 'gt-react', projectRoot: root })
    ).toEqual({ handled: false });
  });

  it('ignores child, wrapper, transitive, and source-code evidence', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        private: true,
        workspaces: ['packages/*'],
        dependencies: { '@fixture/vue-wrapper': 'workspace:*' },
      }),
      'packages/vue-wrapper/package.json': JSON.stringify({
        name: '@fixture/vue-wrapper',
        dependencies: { 'gt-vue': '*' },
      }),
      'packages/vue-wrapper/src/index.ts':
        "export { T as VueT } from 'gt-vue';",
      'src/App.tsx':
        "import { VueT } from '@fixture/vue-wrapper'; export const App = () => <VueT>Ignored</VueT>;",
    });
    const readdir = vi.spyOn(fs, 'readdirSync');
    const readFile = vi.spyOn(fs, 'readFileSync');

    const plan = planVueExtraction({
      library: 'gt-react',
      projectRoot: root,
    });

    expect(plan).toEqual({ handled: false });
    expect(readdir).not.toHaveBeenCalled();
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(path.resolve(String(readFile.mock.calls[0]?.[0]))).toBe(
      path.join(fs.realpathSync(root), 'package.json')
    );
  });

  it.each([
    ['missing manifest', {}],
    ['malformed manifest', { 'package.json': '{' }],
    ['non-object manifest', { 'package.json': '[]' }],
  ])('returns the inert plan for a %s', (_name, files) => {
    const root = createFixture(files);

    const plan = planVueExtraction({
      library: 'gt-react',
      projectRoot: root,
    });

    expect(plan).toEqual({ handled: false });
    expect('run' in plan).toBe(false);
  });
});

describe('handled Vue extraction plans', () => {
  it('starts the default primary extractor synchronously with exact patterns', async () => {
    const root = createVueFixture({});
    const primaryUpdate = update('Primary default', 'primary-default');
    const primary = output([primaryUpdate]);
    const calls: Array<string[] | undefined> = [];
    const plan = planVueExtraction({
      library: 'gt-react',
      projectRoot: root,
    });
    if (!plan.handled) throw new Error('Expected handled plan');

    const resultPromise = plan.run({
      extractPrimary(patterns) {
        calls.push(patterns);
        return Promise.resolve(primary);
      },
    });

    expect(calls).toEqual([undefined]);
    const result = await resultPromise;
    expect(calls).toHaveLength(1);
    expect(result.updates).toEqual([primaryUpdate]);
    expect(result.updates[0]).toBe(primaryUpdate);
  });

  it('preserves synchronous and asynchronous primary error identity', async () => {
    const root = createVueFixture({});
    const synchronousError = new Error('synchronous primary failure');
    const asynchronousError = new Error('asynchronous primary failure');
    const plan = planVueExtraction({
      library: 'gt-react',
      projectRoot: root,
    });
    if (!plan.handled) throw new Error('Expected handled plan');

    const synchronous = plan.run({
      extractPrimary() {
        throw synchronousError;
      },
    });
    await expect(synchronous).rejects.toBe(synchronousError);

    const asynchronous = plan.run({
      extractPrimary() {
        return Promise.reject(asynchronousError);
      },
    });
    await expect(asynchronous).rejects.toBe(asynchronousError);
  });

  it('handles an early default rejection before yielding to Vue inspection', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        private: true,
        workspaces: ['packages/*'],
        devDependencies: { 'gt-vue': '*' },
      }),
      'packages/child/package.json': JSON.stringify({
        name: '@fixture/child',
      }),
    });
    linkInstalledVue(root);
    const primaryError = new Error('early primary failure');
    const unhandledReasons: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledReasons.push(reason);
    };
    const plan = planVueExtraction({
      library: 'gt-react',
      projectRoot: root,
    });
    if (!plan.handled) throw new Error('Expected handled plan');
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      let primaryStarted = false;
      const resultPromise = plan.run({
        extractPrimary(patterns) {
          primaryStarted = true;
          expect(patterns).toBeUndefined();
          return Promise.reject(primaryError);
        },
      });
      expect(primaryStarted).toBe(true);

      // Observe the outer promise immediately so any event can only come from
      // the early primary rejection held while Vue inspection is in flight.
      const settlementPromise = resultPromise.then(
        () => ({ fulfilled: true as const, error: undefined }),
        (error: unknown) => ({ fulfilled: false as const, error })
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      const settlement = await settlementPromise;
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(unhandledReasons).toEqual([]);
      expect(settlement.fulfilled).toBe(false);
      expect(settlement.error).toBe(primaryError);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });

  it('passes unchanged explicit non-SFC patterns and merges Vue updates', async () => {
    const root = createVueFixture({
      'src/messages.ts': `
        import { msg } from 'gt-vue';
        export const title = msg('Vue planner message');
      `,
    });
    const patterns = Object.freeze(['src/messages.ts']) as unknown as string[];
    const primaryUpdate = update('Primary explicit', 'primary-explicit');
    const calls: Array<string[] | undefined> = [];
    const plan = planVueExtraction({
      library: 'gt-react',
      projectRoot: root,
      filePatterns: patterns,
    });
    if (!plan.handled) throw new Error('Expected handled plan');
    process.chdir(root);

    const result = await plan.run({
      extractPrimary(received) {
        calls.push(received);
        return Promise.resolve(output([primaryUpdate]));
      },
    });

    expect(calls).toEqual([patterns]);
    expect(calls[0]).toBe(patterns);
    expect(result.updates.map(({ source }) => source)).toEqual([
      'Primary explicit',
      'Vue planner message',
    ]);
  });

  it('partitions definitive Vue SFCs away from the primary extractor', async () => {
    const root = createVueFixture({
      'src/App.vue': translatableSfc('Partitioned Vue message'),
    });
    const patterns = ['src/**/*.vue'];
    const calls: Array<string[] | undefined> = [];
    const plan = planVueExtraction({
      library: 'gt-react',
      projectRoot: root,
      filePatterns: patterns,
    });
    if (!plan.handled) throw new Error('Expected handled plan');
    process.chdir(root);

    const result = await plan.run({
      extractPrimary(received) {
        calls.push(received);
        return Promise.resolve(output([update('Primary SFC', 'primary-sfc')]));
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toBe(patterns);
    expect(calls[0]?.[0]).toBe(patterns[0]);
    expect(calls[0]?.[1]).toBe(
      `!${path.join(fs.realpathSync(root), 'src/App.vue')}`
    );
    expect(result.updates.map(({ source }) => source)).toEqual([
      'Primary SFC',
      'Partitioned Vue message',
    ]);
  });

  it('anchors relative primary patterns when cwd changes during inspection', async () => {
    const root = createVueFixture({
      'src/messages.ts': `
        import { msg } from 'gt-vue';
        export const title = msg('Anchored Vue message');
      `,
    });
    const otherDirectory = createFixture({});
    const absolutePattern = path.join(root, 'absolute.ts');
    const patterns = [
      './src/messages.ts',
      '!src/ignored.ts',
      absolutePattern,
      '!(src/ignored).ts',
    ];
    let received: string[] | undefined;
    const plan = planVueExtraction({
      library: 'gt-react',
      projectRoot: root,
      filePatterns: patterns,
    });
    if (!plan.handled) throw new Error('Expected handled plan');
    process.chdir(root);

    const resultPromise = plan.run({
      extractPrimary(primaryPatterns) {
        received = primaryPatterns;
        return Promise.resolve(output([]));
      },
    });
    process.chdir(otherDirectory);
    const result = await resultPromise;

    expect(received).toEqual([
      path.join(fs.realpathSync(root), 'src/messages.ts'),
      `!${path.join(fs.realpathSync(root), 'src/ignored.ts')}`,
      absolutePattern,
      path.join(fs.realpathSync(root), '!(src/ignored).ts'),
    ]);
    expect(result.updates.map(({ source }) => source)).toEqual([
      'Anchored Vue message',
    ]);
  });

  it('runs Vue extraction without a primary callback', async () => {
    const root = createVueFixture({
      'src/messages.ts': `
        import { msg } from 'gt-vue';
        export const title = msg('Vue-only planner message');
      `,
    });
    const plan = planVueExtraction({
      library: 'gt-vue',
      projectRoot: root,
      filePatterns: ['src/messages.ts'],
    });
    if (!plan.handled) throw new Error('Expected handled plan');

    const result = await plan.run();

    expect(result.errors).toEqual([]);
    expect(result.updates.map(({ source }) => source)).toEqual([
      'Vue-only planner message',
    ]);
  });

  it('lets an explicitly selected gt-vue runtime own an undeclared root', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({ private: true }),
      'src/messages.ts': `
        import { msg } from 'gt-vue';
        export const title = msg('Explicit Vue runtime message');
      `,
    });
    linkInstalledVue(root);
    const plan = planVueExtraction({
      library: 'gt-vue',
      projectRoot: root,
    });
    if (!plan.handled) throw new Error('Expected handled plan');

    const result = await plan.run();

    expect(result.errors).toEqual([]);
    expect(result.updates.map(({ source }) => source)).toEqual([
      'Explicit Vue runtime message',
    ]);
  });

  it('deduplicates matching primary and Vue hashes during the merge', async () => {
    const root = createVueFixture({
      'src/messages.ts': `
        import { msg } from 'gt-vue';
        export const title = msg('Shared planner message');
      `,
    });
    const hash = hashSource({
      source: 'Shared planner message',
      dataFormat: 'STRING',
    });
    const primaryUpdate = {
      ...update('Shared planner message', hash),
      metadata: { hash, filePaths: ['src/primary.ts'] },
    };
    const plan = planVueExtraction({
      library: 'gt-react',
      projectRoot: root,
      filePatterns: ['src/messages.ts'],
    });
    if (!plan.handled) throw new Error('Expected handled plan');
    process.chdir(root);

    const result = await plan.run({
      extractPrimary: () =>
        Promise.resolve({
          updates: [primaryUpdate],
          errors: ['primary error'],
          warnings: ['primary warning'],
        }),
    });

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toBe(primaryUpdate);
    expect(result.updates[0]?.metadata.filePaths).toEqual([
      'src/primary.ts',
      'src/messages.ts',
    ]);
    expect(result.errors).toEqual(['primary error']);
    expect(result.warnings).toEqual(['primary warning']);
  });
});

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  return root;
}

function createVueFixture(files: Record<string, string>): string {
  const root = createFixture({
    'package.json': JSON.stringify({
      name: 'vue-planner-fixture',
      private: true,
      devDependencies: { 'gt-vue': '*' },
    }),
    ...files,
  });
  linkInstalledVue(root);
  return root;
}

function output(
  updates: InlineExtractionOutput['updates']
): InlineExtractionOutput {
  return { updates, errors: [], warnings: [] };
}

function update(source: string, hash: string) {
  return {
    dataFormat: 'STRING' as const,
    source,
    metadata: { hash },
  };
}
