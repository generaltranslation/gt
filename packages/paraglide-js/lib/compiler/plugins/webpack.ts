import path from 'node:path';
import type { CollectorLogger, Resolver } from '../collector/collector.js';
import { createCollector, isTestEnvironment } from '../collector/create.js';
import type { ContextCollector } from '../collector/collector.js';
import type { ParaglideContextOptions } from '../options.js';
import { fileOfId, taskQueue } from './queue.js';

const NAME = 'paraglide-context';

/**
 * The parts of webpack's and rspack's compiler this plugin uses. Both have
 * the same hooks; rspack ships its own types, so they are described here.
 */
type Hook<T extends unknown[]> = {
  tap(name: string, callback: (...args: T) => void): void;
  tapPromise(name: string, callback: (...args: T) => Promise<void>): void;
};

type Module = { resource?: string };

type Compilation = {
  hooks: {
    succeedModule: Hook<[Module]>;
    finishModules: Hook<[Iterable<Module>]>;
  };
};

type WebpackResolver = {
  resolve(
    context: object,
    directory: string,
    request: string,
    resolveContext: object,
    callback: (error: Error | null, result?: string | false) => void
  ): void;
};

type Compiler = {
  context: string;
  options: { resolve?: object; output?: { path?: string }; mode?: string };
  modifiedFiles?: ReadonlySet<string>;
  removedFiles?: ReadonlySet<string>;
  resolverFactory: { get(type: 'normal', options?: object): WebpackResolver };
  getInfrastructureLogger(name: string): {
    warn(...args: unknown[]): void;
    info(...args: unknown[]): void;
    error(...args: unknown[]): void;
  };
  hooks: {
    thisCompilation: Hook<[Compilation]>;
    watchRun: Hook<[Compiler]>;
    afterEmit: Hook<[Compilation]>;
  };
};

/**
 * Writes the source context of Paraglide's message usages to a metadata file
 * next to each message file, for webpack 5 and rspack. In Next.js:
 *
 * ```js
 * webpack(config) {
 *   config.plugins.push(new ParaglideContextWebpackPlugin());
 *   return config;
 * }
 * ```
 *
 * Next.js runs one compiler each for the client, the server and the edge; their
 * results are merged into one file.
 */
export class ParaglideContextWebpackPlugin {
  constructor(private readonly options: ParaglideContextOptions = {}) {}

  apply(compiler: Compiler): void {
    if (!(this.options.enabled ?? !isTestEnvironment(compiler.options.mode)))
      return;
    const logger = compiler.getInfrastructureLogger(NAME);
    const collectorLogger: CollectorLogger = {
      warn: (message) => logger.warn(message),
      info: (message) => logger.info(message),
    };
    const collector = createCollector(this.options, {
      root: compiler.context,
      logger: collectorLogger,
      ignoredDirectories: compiler.options.output?.path
        ? [compiler.options.output.path]
        : [],
    });
    const run = taskQueue((error) => logger.error(`[${NAME}] ${error.stack}`));

    let scanned = false;
    /** Files changed since the last compilation, from watch mode. */
    let changed: { modified: string[]; removed: string[] } | undefined;
    compiler.hooks.watchRun.tap(NAME, (watching) => {
      changed = {
        modified: [...(watching.modifiedFiles ?? [])],
        removed: [...(watching.removedFiles ?? [])],
      };
    });

    compiler.hooks.thisCompilation.tap(NAME, (compilation) => {
      const loaded = new Set<string>();
      compilation.hooks.succeedModule.tap(NAME, (module) => {
        const file = fileOfId(module.resource);
        if (file && collector.isSourceFile(file)) loaded.add(file);
      });
      // Every module is built, including what Paraglide's plugin compiled.
      compilation.hooks.finishModules.tapPromise(NAME, async () => {
        collector.resolver ??= webpackResolver(compiler);
        const changes = changed;
        changed = undefined;
        await run(collector, async (collector) => {
          if (!scanned || !changes || changes.removed.length > 0) {
            scanned = true;
            await collector.scanAll();
          } else {
            await updateChanged(collector, changes.modified);
          }
          await collector.addLoaded(loaded);
        });
      });
    });
  }
}

/** Re-analyzes changed files; a new file can change how any import resolves. */
async function updateChanged(
  collector: ContextCollector,
  files: string[]
): Promise<void> {
  for (const file of files) {
    const normalized = path.normalize(file);
    if (collector.isWatched(normalized))
      await collector.updateChangedFileFromPath(normalized);
  }
}

/** Resolves like the compiler, with its `resolve` options: aliases, `exports`, resolver plugins. */
function webpackResolver(compiler: Compiler): Resolver {
  const resolver = compiler.resolverFactory.get('normal', {
    ...compiler.options.resolve,
    dependencyType: 'esm',
  });
  return (specifier, importer) =>
    new Promise((resolve) => {
      resolver.resolve(
        {},
        path.dirname(importer),
        specifier,
        {},
        (error, result) => {
          resolve(error || !result ? undefined : result);
        }
      );
    });
}
