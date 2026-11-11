import fs from 'node:fs';
import path from 'node:path';
import type {
  CollectorLogger,
  ContextCollector,
} from './collector/collector.js';
import { createCollector } from './collector/create.js';
import type { ParaglideContextOptions } from './options.js';
import { findProjectRoot } from './project/roots.js';
import {
  ProjectResolver,
  type ProjectResolverOptions,
} from './resolver/project-resolver.js';

export type CollectContextOptions = ParaglideContextOptions &
  ProjectResolverOptions & {
    /** The project, or a directory in it. Default: the working directory. */
    root?: string;
    /** Default: `console`, without info messages. */
    logger?: CollectorLogger;
  };

export type ContextWatcher = {
  /** Resolves after the first scan is written. */
  ready: Promise<void>;
  close(): void;
};

type Context = { collector: ContextCollector; resolver: ProjectResolver };

type CollectorTask = (collector: ContextCollector) => Promise<unknown>;

/** `true` for a file that was added or deleted, not only changed. */
type PendingChanges = Map<string, boolean>;

/** How long changes are gathered before they are analyzed together, in milliseconds. */
const WATCH_DELAY = 50;

const QUIET_CONSOLE: CollectorLogger = {
  warn: (message) => console.warn(message),
  info: () => {},
};

/**
 * Analyzes the project and writes its metadata files once. `include` is what
 * is analyzed. Imports are followed as the project's bundler would follow
 * them, as far as its config tells: see `ProjectResolver`.
 */
export async function collectContext(
  options: CollectContextOptions = {}
): Promise<void> {
  const { collector, resolver } = createContext(options);
  await collector.scanAll();
  await collector.write();
  await resolver.warnUnresolved();
}

/** Like `collectContext`, then keeps the files up to date as sources change. */
export function watchContext(
  options: CollectContextOptions = {}
): ContextWatcher {
  const { collector, resolver } = createContext(options);
  const logger = options.logger ?? QUIET_CONSOLE;
  const root = findProjectRoot(path.resolve(options.root ?? process.cwd()));
  let queue = Promise.resolve();
  let pending: PendingChanges = new Map();
  let timer: NodeJS.Timeout | undefined;

  /** Runs tasks one at a time and writes after each. A failed one is reported, not thrown. */
  const run = (task: CollectorTask): Promise<void> => {
    queue = queue
      .then(async () => {
        await task(collector);
        await collector.write();
        await resolver.warnUnresolved();
      })
      .catch((error: Error) =>
        logger.warn(`[paraglide-context] ${error.stack}`)
      );

    return queue;
  };

  const analyzePending = (): void => {
    const changes = pending;
    pending = new Map();
    // A new or deleted file can change how any import resolves.
    const isRescan = [...changes.values()].some((isRenamed) => isRenamed);

    void run(async (collector) => {
      if (isRescan) return collector.scanAll();

      for (const file of changes.keys()) {
        await collector.updateChangedFileFromPath(file);
      }
    });
  };

  const watcher = fs.watch(root, { recursive: true }, (event, name) => {
    if (!name) return;

    const file = path.join(root, name.toString());
    const isDependency = file.split(path.sep).includes('node_modules');
    if (isDependency || !collector.isWatched(file)) return;

    const isRenamed = event === 'rename' || pending.get(file) === true;
    pending.set(file, isRenamed);
    clearTimeout(timer);
    timer = setTimeout(analyzePending, WATCH_DELAY);
  });

  return {
    ready: run((collector) => collector.scanAll()),
    close() {
      clearTimeout(timer);
      watcher.close();
    },
  };
}

function createContext(options: CollectContextOptions): Context {
  const root = path.resolve(options.root ?? process.cwd());
  const logger = options.logger ?? QUIET_CONSOLE;
  const collector = createCollector(options, { root, logger });
  const resolver = new ProjectResolver(options, { root, logger });
  collector.resolver = resolver.resolve;

  return { collector, resolver };
}
