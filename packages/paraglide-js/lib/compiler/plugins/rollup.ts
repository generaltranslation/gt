import type { CollectorLogger, Resolver } from '../collector/collector.js';
import { createCollector, isTestEnvironment } from '../collector/create.js';
import type { ContextCollector } from '../collector/collector.js';
import type { ParaglideContextOptions } from '../options.js';
import { fileOfId, taskQueue } from './queue.js';

/** The parts of Rollup's and Rolldown's plugin context this plugin uses. */
type PluginContext = {
  resolve(
    source: string,
    importer?: string,
    options?: { skipSelf?: boolean }
  ): Promise<{ id: string; external?: boolean | string } | null>;
  warn(message: string): void;
  info?(message: string): void;
  error?(message: string): never;
};

/** A Rollup / Rolldown plugin; the hooks are typed loosely so both accept it. */
export type ParaglideContextRollupPlugin = {
  name: string;
  buildStart: {
    order: 'post';
    sequential: true;
    handler(this: PluginContext): Promise<void>;
  };
  transform(this: PluginContext, code: string, id: string): null;
  buildEnd: { order: 'post'; handler(this: PluginContext): Promise<void> };
};

/**
 * Writes the source context of Paraglide's message usages to a metadata file
 * next to each message file, for Rollup and Rolldown. Paths in the options are relative to the project root
 * (the nearest package.json at or above `root`, default: the working directory).
 */
export function paraglideContextRollup(
  options: ParaglideContextOptions & { root?: string } = {}
): ParaglideContextRollupPlugin {
  const enabled = options.enabled ?? !isTestEnvironment();
  let collector: ContextCollector | undefined;
  let logger: CollectorLogger | undefined;
  const run = taskQueue((error) =>
    logger?.warn(`[paraglide-context] ${error.stack}`)
  );
  const loaded = new Set<string>();

  return {
    name: 'paraglide-context',

    buildStart: {
      // Run after Paraglide's `buildStart`, which compiles the outdirs.
      order: 'post',
      sequential: true,
      async handler() {
        if (!enabled) return;
        const context = this;
        logger = {
          warn: (message) => context.warn(message),
          info: (message) => (context.info ? context.info(message) : undefined),
        };
        collector ??= createCollector(options, {
          root: options.root ?? process.cwd(),
          logger,
        });
        collector.resolver = contextResolver(this);
        loaded.clear();
        // Every build re-scans, watch rebuilds included.
        await run(collector, (collector) => collector.scanAll());
      },
    },

    transform(_code, id) {
      const file = fileOfId(id);
      if (file && collector?.isSourceFile(file)) loaded.add(file);
      return null;
    },

    buildEnd: {
      order: 'post',
      async handler() {
        if (!collector) return;
        collector.resolver = contextResolver(this);
        const files = [...loaded];
        loaded.clear();
        await run(collector, (collector) => collector.addLoaded(files));
      },
    },
  };
}

/** Resolves with the build's plugins and options. External ids are not files. */
function contextResolver(context: PluginContext): Resolver {
  return async (specifier, importer) => {
    const resolved = await context.resolve(specifier, importer, {
      skipSelf: true,
    });
    return resolved && !resolved.external ? resolved.id : undefined;
  };
}
