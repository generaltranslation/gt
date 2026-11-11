import path from 'node:path';
import type { CollectorLogger } from './collector/collector.js';
import { createCollector } from './collector/create.js';
import type { ParaglideContextOptions } from './options.js';
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

const QUIET_CONSOLE: CollectorLogger = {
  warn: (message) => console.warn(message),
  info: () => {},
};

/**
 * Analyzes the project and writes its metadata files. `include` is what
 * is analyzed. Imports are followed as the project's bundler would follow
 * them, as far as its config tells: see `ProjectResolver`.
 */
export async function collectContext(
  options: CollectContextOptions = {}
): Promise<void> {
  const root = path.resolve(options.root ?? process.cwd());
  const logger = options.logger ?? QUIET_CONSOLE;
  const resolver = new ProjectResolver(options, { root, logger });
  const collector = createCollector(options, {
    root,
    logger,
    resolver: resolver.resolve,
  });

  await collector.scanAll();
  await collector.write();
  await resolver.warnUnresolved();
}
