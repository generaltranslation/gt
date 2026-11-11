import path from 'node:path';
import type { CollectorLogger } from '../collector/collector.js';
import { nodeResolver } from './node-resolver.js';
import { createCollector, isTestEnvironment } from '../collector/create.js';
import type { ParaglideContextOptions } from '../options.js';
import { fileOfId, taskQueue } from './queue.js';

/** The parts of esbuild's `PluginBuild` this plugin uses. */
type ResolveResult = {
  path: string;
  external: boolean;
  namespace: string;
  errors: unknown[];
};

type PluginBuild = {
  initialOptions: {
    absWorkingDir?: string;
    outdir?: string;
    outfile?: string;
    logLevel?: string;
    alias?: Record<string, string>;
    conditions?: string[];
  };
  resolve(
    path: string,
    options: {
      kind: string;
      resolveDir: string;
      importer?: string;
      pluginData?: unknown;
      namespace?: string;
    }
  ): Promise<ResolveResult>;
  onResolve(
    options: { filter: RegExp; namespace?: string },
    callback: (args: {
      path: string;
      importer: string;
      resolveDir: string;
      kind: string;
      namespace: string;
      pluginData?: unknown;
    }) => Promise<undefined> | undefined
  ): void;
  onLoad(
    options: { filter: RegExp; namespace?: string },
    callback: (args: { path: string }) => undefined
  ): void;
  onEnd(callback: () => Promise<void>): void;
};

export type ParaglideContextEsbuildPlugin = {
  name: string;
  setup(build: PluginBuild): void;
};

/**
 * Writes the source context of Paraglide's message usages to a metadata file
 * next to each message file, for esbuild. The analysis runs when a build
 * ends, so that Paraglide's own plugin (whose `onStart` compiles the outdirs)
 * has finished: esbuild runs `onStart` callbacks concurrently.
 *
 * esbuild cannot resolve once a build has ended, so the imports it resolves
 * during the build are recorded, with every plugin applied. The rest (imports
 * of files it did not bundle) are resolved like esbuild does by default: its
 * `alias` and `conditions` options, tsconfig `paths`, package `exports`.
 */
export function paraglideContextEsbuild(
  options: ParaglideContextOptions = {}
): ParaglideContextEsbuildPlugin {
  return {
    name: 'paraglide-context',
    setup(build) {
      if (!(options.enabled ?? !isTestEnvironment())) return;
      const { initialOptions } = build;
      const root = initialOptions.absWorkingDir ?? process.cwd();
      const verbose = ['info', 'debug', 'verbose'].includes(
        initialOptions.logLevel ?? ''
      );
      const logger: CollectorLogger = {
        warn: (message) => console.warn(message),
        info: (message) => (verbose ? console.info(message) : undefined),
      };
      const output =
        initialOptions.outdir ??
        (initialOptions.outfile && path.dirname(initialOptions.outfile));
      const collector = createCollector(options, {
        root,
        logger,
        ignoredDirectories: output ? [path.resolve(root, output)] : [],
      });
      const resolved = recordResolutions(build);
      const fallback = nodeResolver({
        alias: Object.fromEntries(
          Object.entries(initialOptions.alias ?? {}).map(
            ([find, replacement]) => [
              find,
              replacement.startsWith('.')
                ? path.resolve(root, replacement)
                : replacement,
            ]
          )
        ),
        conditions: initialOptions.conditions && [
          ...initialOptions.conditions,
          'import',
          'browser',
          'default',
        ],
      });
      collector.resolver = async (specifier, importer) =>
        resolved.get(key(specifier, importer)) ?? fallback(specifier, importer);
      const run = taskQueue((error) =>
        console.error(`[paraglide-context] ${error.stack}`)
      );

      let loaded = new Set<string>();
      build.onLoad({ filter: /.*/, namespace: 'file' }, (args) => {
        const file = fileOfId(args.path);
        if (file && collector.isSourceFile(file)) loaded.add(file);
        return undefined;
      });
      // Each build and rebuild (`context.rebuild()`, watch mode) re-scans.
      build.onEnd(async () => {
        const files = loaded;
        loaded = new Set();
        await run(collector, async (collector) => {
          await collector.scanAll();
          await collector.addLoaded(files);
        });
      });
    },
  };
}

const RECORDING = Symbol('paraglide-context');
const key = (specifier: string, importer: string) =>
  `${importer}\0${specifier}`;

/**
 * Records what each import of a bundled file resolves to, by resolving it
 * again with every plugin (and this one skipped through `pluginData`).
 */
function recordResolutions(
  build: PluginBuild
): Map<string, string | undefined> {
  const resolved = new Map<string, string | undefined>();
  build.onResolve({ filter: /.*/, namespace: 'file' }, async (args) => {
    if (args.pluginData === RECORDING || !args.importer) return undefined;
    const result = await build.resolve(args.path, {
      kind: args.kind,
      resolveDir: args.resolveDir,
      importer: args.importer,
      namespace: args.namespace,
      pluginData: RECORDING,
    });
    const ok =
      result.errors.length === 0 &&
      !result.external &&
      result.namespace === 'file';
    resolved.set(key(args.path, args.importer), ok ? result.path : undefined);
    return undefined;
  });
  return resolved;
}
