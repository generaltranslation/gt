import fs from 'node:fs';
import path from 'node:path';
import type {
  CollectorLogger,
  ContextCollector,
} from '../collector/collector.js';
import { createCollector } from '../collector/create.js';
import { findProjectRoot } from '../project/roots.js';
import type { ParaglideContextOptions } from '../options.js';
import {
  ProjectResolver,
  type ProjectResolverOptions,
} from './project-resolver.js';
import { taskQueue } from './queue.js';

export type CollectContextOptions = ParaglideContextOptions &
  ProjectResolverOptions & {
    /** The project, or a directory in it. Default: the working directory. */
    root?: string;
    /** Default: `console`, without info messages. */
    logger?: CollectorLogger;
  };

type NodeCollector = { collector: ContextCollector; resolver: ProjectResolver };

const quietConsole: CollectorLogger = {
  warn: (message) => console.warn(message),
  info: () => {},
};

/**
 * Writes the metadata files once, without running a bundler. Only `include` is
 * analyzed, since no bundler reports the modules it loads.
 */
export async function collectContext(
  options: CollectContextOptions = {}
): Promise<void> {
  const { collector, resolver } = createNodeCollector(options);
  await collector.scanAll();
  await collector.write();
  await resolver.warnUnresolved();
}

export type ContextWatcher = {
  /** Resolves after the first scan is written. */
  ready: Promise<void>;
  close(): void;
};

/** Like `collectContext`, then keeps the files up to date as sources change. */
export function watchContext(
  options: CollectContextOptions = {}
): ContextWatcher {
  const { collector, resolver } = createNodeCollector(options);
  const logger = options.logger ?? quietConsole;
  const queue = taskQueue((error) =>
    logger.warn(`[paraglide-context] ${error.stack}`)
  );
  const run = (task: (collector: ContextCollector) => Promise<unknown>) =>
    queue(collector, task).then(() => resolver.warnUnresolved());
  const ready = run((collector) => collector.scanAll());
  const root = findProjectRoot(path.resolve(options.root ?? process.cwd()));

  let pending = new Map<string, boolean>();
  let timer: NodeJS.Timeout | undefined;
  const flush = () => {
    const changes = pending;
    pending = new Map();
    // A new or deleted file can change how any import resolves.
    const rescan = [...changes.values()].some((renamed) => renamed);
    void run(async (collector) => {
      if (rescan) return collector.scanAll();
      for (const file of changes.keys())
        await collector.updateChangedFileFromPath(file);
    });
  };
  const watcher = fs.watch(root, { recursive: true }, (event, name) => {
    if (!name) return;
    const file = path.join(root, name.toString());
    if (
      file.split(path.sep).includes('node_modules') ||
      !collector.isWatched(file)
    )
      return;
    pending.set(file, (pending.get(file) ?? false) || event === 'rename');
    clearTimeout(timer);
    timer = setTimeout(flush, 50);
  });
  return {
    ready,
    close() {
      clearTimeout(timer);
      watcher.close();
    },
  };
}

function createNodeCollector(options: CollectContextOptions): NodeCollector {
  const root = path.resolve(options.root ?? process.cwd());
  const logger = options.logger ?? quietConsole;
  const collector = createCollector(options, { root, logger });
  const resolver = new ProjectResolver(options, { root, logger });
  collector.resolver = resolver.resolve;

  return { collector, resolver };
}
