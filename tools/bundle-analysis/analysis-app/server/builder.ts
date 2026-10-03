import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeBundle } from './analyze.ts';
import type { ExampleDefinition } from './examples.ts';
import type { WorkspacePackage } from './workspace.ts';
import { BUNDLE_KINDS } from '../shared/types.ts';
import type {
  Analysis,
  BuildSettings,
  BundleKind,
  ExampleState,
} from '../shared/types.ts';

const DEFAULT_SETTINGS: BuildSettings = { minify: true, treeShake: true };
const LOG_LIMIT = 16_000;

interface Entry {
  state: ExampleState;
  /**
   * True while `current` may not reflect the latest sources. Only a
   * successful build clears it, so a failed refresh can be retried.
   */
  outdated: boolean;
  /** A source changed while a build was running; run another pass after it. */
  queued: boolean;
  child: ChildProcess | null;
  /** Callers waiting for the current build to finish. */
  waiters: ((state: ExampleState) => void)[];
}

export interface BuildManager {
  getState(id: string): ExampleState;
  /** Rebuilds when the example has never been built or a source changed. */
  ensureFresh(id: string): void;
  setSettings(id: string, settings: BuildSettings): void;
  /** Marks every example stale and rebuilds the ones in `active`. */
  invalidate(reason: string, active: Iterable<string>): void;
  /** Marks one example stale (its own source changed) and rebuilds it. */
  invalidateExample(id: string, reason: string): void;
  /** Starts a build now, replacing any running one. */
  rebuild(id: string, reason: string): void;
  /** True when a source changed after the current analysis was built. */
  isStale(id: string): boolean;
  /** Resolves with the state once no build is running for the example. */
  whenIdle(id: string): Promise<ExampleState>;
  stopAll(): void;
}

/** Starts a production build of an example with the given environment. */
export type RunBuild = (
  example: ExampleDefinition,
  env: Record<string, string>
) => ChildProcess;

const runPnpmBuild: RunBuild = (example, env) =>
  spawn('pnpm', ['run', 'build'], {
    cwd: example.dir,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so a superseded build can be stopped with its
    // bundler grandchildren.
    detached: true,
  });

export function createBuildManager(options: {
  examples: ExampleDefinition[];
  packages: () => WorkspacePackage[];
  cacheDir: string;
  onState: (state: ExampleState) => void;
  /** Overridable for tests. */
  runBuild?: RunBuild;
  analyze?: typeof analyzeExample;
}): BuildManager {
  const runBuild = options.runBuild ?? runPnpmBuild;
  const analyze = options.analyze ?? analyzeExample;
  const { examples, cacheDir, onState } = options;
  const entries = new Map<string, Entry>();
  mkdirSync(cacheDir, { recursive: true });

  for (const example of examples) {
    const cached = readCache(cacheDir, example.id);
    entries.set(example.id, {
      state: {
        example: example.id,
        title: example.title,
        bundles: cached?.current
          ? BUNDLE_KINDS.filter((kind) => kind in cached.current!.bundles)
          : BUNDLE_KINDS.filter((kind) => kind in example.collect),
        settings: cached?.settings ?? { ...DEFAULT_SETTINGS },
        status: { state: 'idle' },
        current: cached?.current ?? null,
        previous: cached?.previous ?? null,
      },
      // Packages may have been rebuilt while the tool was not running.
      outdated: true,
      queued: false,
      child: null,
      waiters: [],
    });
  }

  const entryFor = (id: string) => {
    const entry = entries.get(id);
    if (!entry) throw new Error(`Unknown example ${id}`);
    return entry;
  };

  /**
   * Sends the state to the UI. Waiters resolve only once the example is
   * settled: not building and with no follow-up pass about to start.
   */
  const publish = (entry: Entry) => {
    onState(entry.state);
    if (entry.state.status.state !== 'building' && !entry.queued) {
      const waiters = entry.waiters.splice(0);
      for (const resolve of waiters) resolve(entry.state);
    }
  };

  /** Publishes a finished build, then runs the queued pass if one exists. */
  const settle = (example: ExampleDefinition, entry: Entry) => {
    publish(entry);
    if (entry.queued) build(example, 'Source changed during the build');
  };

  const build = (example: ExampleDefinition, reason: string, attempt = 0) => {
    const entry = entryFor(example.id);
    if (entry.child) {
      // A newer change supersedes the running build.
      entry.child.removeAllListeners('close');
      killTree(entry.child);
      entry.child = null;
    }

    const settings = entry.state.settings;
    const startedAt = new Date();
    entry.queued = false;
    entry.state = {
      ...entry.state,
      status: { state: 'building', reason, startedAt: startedAt.toISOString() },
    };
    publish(entry);

    let log = '';
    const child = runBuild(example, {
      GT_ANALYZE: '1',
      GT_ANALYZE_MINIFY: settings.minify ? '1' : '0',
      GT_ANALYZE_TREESHAKE: settings.treeShake ? '1' : '0',
      NEXT_TELEMETRY_DISABLED: '1',
      FORCE_COLOR: '0',
    });
    entry.child = child;
    const append = (chunk: Buffer) => {
      log = (log + chunk.toString()).slice(-LOG_LIMIT);
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);

    child.on('close', (code) => {
      entry.child = null;
      if (code !== 0) {
        entry.state = {
          ...entry.state,
          status: {
            state: 'error',
            message: `The build exited with code ${code}.`,
            log,
          },
        };
        // `outdated` stays set, so reopening the example retries; a change
        // queued during the build (perhaps the fix) runs now.
        settle(example, entry);
        return;
      }
      try {
        const analysis = analyze(
          example,
          settings,
          options.packages(),
          startedAt,
          Date.now() - startedAt.getTime()
        );
        entry.state = {
          ...entry.state,
          status: { state: 'idle' },
          bundles: BUNDLE_KINDS.filter((kind) => kind in analysis.bundles),
          previous: entry.state.current,
          current: analysis,
        };
        if (!entry.queued) entry.outdated = false;
        writeCache(cacheDir, entry.state);
      } catch (error) {
        // Another process (a second analysis server, a manual build) can
        // rewrite the output dir while it is read. Build once more.
        if (
          attempt === 0 &&
          (error as NodeJS.ErrnoException).code === 'ENOENT'
        ) {
          build(example, reason, 1);
          return;
        }
        entry.state = {
          ...entry.state,
          status: {
            state: 'error',
            message: 'The build finished but its output could not be analyzed.',
            log:
              error instanceof Error
                ? (error.stack ?? error.message)
                : String(error),
          },
        };
      }
      settle(example, entry);
    });
  };

  const exampleFor = (id: string) => {
    const example = examples.find((candidate) => candidate.id === id);
    if (!example) throw new Error(`Unknown example ${id}`);
    return example;
  };

  return {
    getState: (id) => entryFor(id).state,
    ensureFresh(id) {
      const entry = entryFor(id);
      if (entry.child) return;
      if (entry.outdated || !entry.state.current) {
        build(
          exampleFor(id),
          entry.state.current ? 'Refreshing the last build' : 'First build'
        );
      }
    },
    setSettings(id, settings) {
      const entry = entryFor(id);
      const { minify, treeShake } = entry.state.settings;
      if (settings.minify === minify && settings.treeShake === treeShake)
        return;
      entry.state = { ...entry.state, settings };
      build(exampleFor(id), 'Build settings changed');
    },
    invalidate(reason, active) {
      for (const entry of entries.values()) {
        entry.outdated = true;
        // A running build may have read the old files; run another pass.
        if (entry.child) entry.queued = true;
      }
      for (const id of new Set(active)) {
        if (!entryFor(id).child) build(exampleFor(id), reason);
      }
    },
    rebuild(id, reason) {
      build(exampleFor(id), reason);
    },
    isStale(id) {
      const entry = entryFor(id);
      return entry.outdated || !entry.state.current;
    },
    whenIdle(id) {
      const entry = entryFor(id);
      if (!entry.child) return Promise.resolve(entry.state);
      return new Promise((resolve) => entry.waiters.push(resolve));
    },
    invalidateExample(id, reason) {
      const entry = entryFor(id);
      entry.outdated = true;
      if (entry.child) entry.queued = true;
      else build(exampleFor(id), reason);
    },
    stopAll() {
      for (const entry of entries.values()) {
        if (entry.child) killTree(entry.child);
      }
    },
  };
}

export function analyzeExample(
  example: ExampleDefinition,
  settings: BuildSettings,
  packages: WorkspacePackage[],
  startedAt: Date,
  buildMs: number
): Analysis {
  const projectRoot = example.projectRoot?.(example.dir);
  const bundles: Analysis['bundles'] = {};
  for (const [kind, collect] of Object.entries(example.collect) as [
    BundleKind,
    (dir: string) => string[],
  ][]) {
    const files = collect(example.dir);
    // A framework only emits some bundles (no edge output without middleware).
    if (files.length === 0) continue;
    bundles[kind] = analyzeBundle(
      kind,
      files,
      example.dir,
      packages,
      projectRoot
    );
  }
  return {
    example: example.id,
    settings,
    builtAt: startedAt.toISOString(),
    buildMs,
    bundles,
  };
}

function killTree(child: ChildProcess) {
  try {
    if (child.pid) process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function cachePath(cacheDir: string, id: string) {
  return join(cacheDir, `${id}.json`);
}

function readCache(cacheDir: string, id: string): ExampleState | null {
  const path = cachePath(cacheDir, id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ExampleState;
  } catch {
    return null;
  }
}

function writeCache(cacheDir: string, state: ExampleState) {
  const { status: _status, ...rest } = state;
  writeFileSync(cachePath(cacheDir, state.example), JSON.stringify(rest));
}
