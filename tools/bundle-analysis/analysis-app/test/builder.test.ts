import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBuildManager } from '../server/builder.ts';
import type { ExampleDefinition } from '../server/examples.ts';
import type { Analysis } from '../shared/types.ts';

const example: ExampleDefinition = {
  id: 'demo',
  title: 'Demo',
  pkg: 'gt-react',
  framework: 'Test',
  description: 'Test example',
  dir: '/nonexistent',
  collect: { client: () => [] },
};

/** A build manager whose builds are fake processes the test finishes. */
/** One-module client bundle of the given size, for comparing builds. */
const bundlesOf = (bytes: number): Analysis['bundles'] => ({
  client: {
    kind: 'client',
    files: [{ path: 'a.js', bytes, gzip: bytes }],
    totalBytes: bytes,
    gzipBytes: bytes,
    modules: [
      { id: 'gt-react/a.mjs', pkg: 'gt-react', path: 'a.mjs', gt: true, bytes },
    ],
  },
});

function setup(
  analyzeImpl?: () => void,
  sizes: (build: number) => number = () => 0
) {
  const children: (EventEmitter & { finish: (code: number) => void })[] = [];
  let analyses = 0;
  const manager = createBuildManager({
    examples: [example],
    packages: () => [],
    cacheDir: mkdtempSync(join(tmpdir(), 'bundle-analysis-test-')),
    onState: () => {},
    runBuild: () => {
      const child = Object.assign(new EventEmitter(), {
        stdout: null,
        stderr: null,
        pid: undefined,
        kill: () => true,
        finish: (code: number) => child.emit('close', code),
      });
      children.push(child);
      return child as unknown as ChildProcess;
    },
    analyze: (_example, settings, _packages, startedAt): Analysis => {
      analyses++;
      analyzeImpl?.();
      return {
        example: 'demo',
        settings,
        builtAt: startedAt.toISOString(),
        buildMs: analyses,
        bundles: bundlesOf(sizes(analyses)),
      };
    },
  });
  return { manager, children, analysisCount: () => analyses };
}

describe('createBuildManager', () => {
  it('keeps waiters pending until a change queued during the build is built', async () => {
    const { manager, children } = setup();
    manager.ensureFresh('demo');
    let resolved = false;
    const idle = manager.whenIdle('demo').then((state) => {
      resolved = true;
      return state;
    });

    manager.invalidateExample('demo', 'Edited src/App.tsx');
    children[0]!.finish(0);
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(children).toHaveLength(2);
    expect(manager.getState('demo').status.state).toBe('building');

    children[1]!.finish(0);
    const state = await idle;
    expect(state.status.state).toBe('idle');
    expect(state.current?.buildMs).toBe(2);
    expect(manager.isStale('demo')).toBe(false);
  });

  it('builds a change queued during a failing build', () => {
    const { manager, children } = setup();
    manager.ensureFresh('demo');
    manager.invalidateExample('demo', 'Fixed the compile error');
    children[0]!.finish(1);
    expect(children).toHaveLength(2);
    children[1]!.finish(0);
    expect(manager.getState('demo').status.state).toBe('idle');
    expect(manager.isStale('demo')).toBe(false);
  });

  it('does not retry an unchanged failing build on its own', () => {
    const { manager, children } = setup();
    manager.ensureFresh('demo');
    children[0]!.finish(1);
    expect(children).toHaveLength(1);
    expect(manager.getState('demo').status.state).toBe('error');
  });

  it('keeps a measurement stale after a failed refresh so it can be retried', () => {
    const { manager, children } = setup();
    manager.ensureFresh('demo');
    children[0]!.finish(0);
    expect(manager.isStale('demo')).toBe(false);

    manager.invalidate('Rebuilt gt-react', ['demo']);
    expect(children).toHaveLength(2);
    children[1]!.finish(1);
    expect(manager.isStale('demo')).toBe(true);

    manager.ensureFresh('demo');
    expect(children).toHaveLength(3);
    children[2]!.finish(0);
    expect(manager.isStale('demo')).toBe(false);
  });

  it('resolves waiters with the error when a build fails without queued work', async () => {
    const { manager, children } = setup();
    manager.ensureFresh('demo');
    const idle = manager.whenIdle('demo');
    children[0]!.finish(2);
    const state = await idle;
    expect(state.status.state).toBe('error');
  });

  it('replaces a running build and ignores the superseded one', () => {
    const { manager, children } = setup();
    manager.ensureFresh('demo');
    manager.rebuild('demo', 'Requested through the API');
    expect(children).toHaveLength(2);
    // The superseded build finishing late must not change the state.
    children[0]!.finish(1);
    expect(manager.getState('demo').status.state).toBe('building');
    children[1]!.finish(0);
    expect(manager.getState('demo').status.state).toBe('idle');
  });

  it('builds once more when the output disappears during analysis', () => {
    let calls = 0;
    const { manager, children } = setup(() => {
      calls++;
      if (calls === 1) {
        throw Object.assign(new Error('ENOENT: chunk.js'), { code: 'ENOENT' });
      }
    });
    manager.ensureFresh('demo');
    children[0]!.finish(0);
    expect(children).toHaveLength(2);
    children[1]!.finish(0);
    expect(manager.getState('demo').status.state).toBe('idle');
  });

  it('reports an analysis error when the output is missing twice', () => {
    const { manager, children } = setup(() => {
      throw Object.assign(new Error('ENOENT: chunk.js'), { code: 'ENOENT' });
    });
    manager.ensureFresh('demo');
    children[0]!.finish(0);
    children[1]!.finish(0);
    expect(children).toHaveLength(2);
    expect(manager.getState('demo').status.state).toBe('error');
  });

  it('marks measurements outdated without building', () => {
    const { manager, children } = setup();
    manager.ensureFresh('demo');
    children[0]!.finish(0);
    manager.markOutdated();
    expect(children).toHaveLength(1);
    expect(manager.isStale('demo')).toBe(true);
    manager.ensureFresh('demo');
    expect(children).toHaveLength(2);
  });

  it('retries a failed settings change or manual rebuild after a success', () => {
    const { manager, children } = setup();
    manager.ensureFresh('demo');
    children[0]!.finish(0);
    expect(manager.isStale('demo')).toBe(false);

    manager.setSettings('demo', { minify: false, treeShake: true });
    children[1]!.finish(1);
    expect(manager.isStale('demo')).toBe(true);
    manager.ensureFresh('demo');
    expect(children).toHaveLength(3);
    children[2]!.finish(0);

    manager.rebuild('demo', 'Requested through the API');
    children[3]!.finish(1);
    expect(manager.isStale('demo')).toBe(true);
    manager.ensureFresh('demo');
    expect(children).toHaveLength(5);
  });

  it('keeps a build that missed a change outdated without queuing an early pass', () => {
    const { manager, children } = setup();
    manager.ensureFresh('demo');
    // A dist write lands mid-build; the debounced invalidation has not fired.
    manager.markOutdated();
    children[0]!.finish(0);
    expect(children).toHaveLength(1);
    expect(manager.isStale('demo')).toBe(true);
    // The debounced invalidation then builds exactly once.
    manager.invalidate('Rebuilt gt-react', ['demo']);
    expect(children).toHaveLength(2);
    children[1]!.finish(0);
    expect(manager.isStale('demo')).toBe(false);
  });

  it('keeps the comparison point when a rebuild measures the same bytes', () => {
    const { manager, children } = setup(undefined, (build) =>
      build === 1 ? 100 : 80
    );
    manager.ensureFresh('demo');
    children[0]!.finish(0);
    manager.rebuild('demo', 'Edited');
    children[1]!.finish(0);
    const changed = manager.getState('demo');
    expect(changed.previous?.bundles.client?.totalBytes).toBe(100);
    expect(changed.current?.bundles.client?.totalBytes).toBe(80);

    // A redundant rebuild with identical output keeps the −20 B change visible.
    manager.rebuild('demo', 'Redundant');
    children[2]!.finish(0);
    const after = manager.getState('demo');
    expect(after.previous?.bundles.client?.totalBytes).toBe(100);
    expect(after.current?.bundles.client?.totalBytes).toBe(80);
  });

  it('reports a build that cannot start and settles it once', async () => {
    const { manager, children } = setup();
    manager.ensureFresh('demo');
    const idle = manager.whenIdle('demo');
    children[0]!.emit('error', new Error('spawn pnpm ENOENT'));
    children[0]!.finish(-2);
    const state = await idle;
    expect(state.status).toMatchObject({
      state: 'error',
      message: 'The build could not start.',
    });
    expect(children).toHaveLength(1);
  });
});
