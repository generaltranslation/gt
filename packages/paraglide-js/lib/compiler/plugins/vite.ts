import path from 'node:path';
import type { Logger, Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import type { ContextCollector, Resolver } from '../collector/collector.js';
import { createCollector, isTestEnvironment } from '../collector/create.js';
import type { ParaglideContextOptions } from '../options.js';

export type { ParaglideContextOptions };

/** Hook contexts differ between Vite versions; only `resolve` is used. */
type ResolveContext = {
  resolve(
    source: string,
    importer?: string,
    options?: { skipSelf?: boolean }
  ): Promise<{ id: string } | null>;
  environment?: { name: string };
};

/** Writes the source context of Paraglide's message usages to a metadata file next to each message file. */
export function paraglideContext(
  options: ParaglideContextOptions = {}
): Plugin {
  let collector: ContextCollector | undefined;
  let logger: Logger | undefined;
  let queue = Promise.resolve();
  /** In dev, resolves with the client environment's plugins at any time. */
  let devResolver: Resolver | undefined;
  /** Environments whose `buildStart` ran; another start means a watch rebuild. */
  const started = new Set<string>();
  /** Files loaded during a build, analyzed at `buildEnd`. */
  const loaded = new Set<string>();

  /**
   * Frameworks reuse one plugin object for several Vite instances one after
   * another, e.g. Astro's dev server for build info, then the build. Each
   * `configResolved` starts a new instance; tasks of an earlier one are dropped.
   */
  let instance = 0;

  /** Runs tasks one at a time; writes when a task returns anything but `false`. */
  const run = (task: (collector: ContextCollector) => Promise<unknown>) => {
    const current = instance;
    const live = () => current === instance && collector !== undefined;
    queue = queue
      .then(async () => {
        if (!live()) return;
        const result = await task(collector!);
        if (live() && result !== false) await collector!.write();
      })
      .catch((error: Error) =>
        logger?.error(`[paraglide-context] ${error.stack}`)
      );
    return queue;
  };

  return {
    name: 'paraglide-context',

    apply: (_config, env) => options.enabled ?? !isTestEnvironment(env.mode),

    configResolved(config) {
      instance++;
      devResolver = undefined;
      started.clear();
      loaded.clear();
      logger = config.logger;
      collector = createCollector(options, {
        root: config.root,
        logger: config.logger,
        ignoredDirectories: viteOutputDirectories(config),
      });
    },

    configureServer(server) {
      if (!collector) return;
      devResolver = createDevResolver(server);
      collector.resolver = devResolver;
      const current = instance;
      const watched = (file: string) =>
        current === instance && collector!.isWatched(path.normalize(file));
      server.watcher.on('change', (file) => {
        if (watched(file)) {
          void run((collector) =>
            collector.updateChangedFileFromPath(path.normalize(file))
          );
        }
      });
      // A new or deleted file can change how any import resolves.
      for (const event of ['add', 'unlink'] as const) {
        server.watcher.on(event, (file) => {
          if (watched(file)) void run((collector) => collector.scanAll());
        });
      }
    },

    buildStart: {
      // Run after Paraglide's `buildStart`, which compiles the outdirs.
      order: 'post',
      sequential: true,
      async handler() {
        if (!collector) return;
        const context = this as unknown as ResolveContext;
        const environment = context.environment?.name ?? 'default';
        // A further environment of the same build reuses the scan.
        const rescan = started.size === 0 || started.has(environment);
        started.add(environment);
        if (!rescan) return;
        collector.resolver = devResolver ?? contextResolver(context);
        await run((collector) => collector.scanAll());
      },
    },

    transform(_code, id) {
      const file = fileOf(id);
      if (!file || !collector?.isSourceFile(file)) return;
      if (devResolver) void run((collector) => collector.addLoaded([file]));
      else loaded.add(file);
    },

    closeBundle() {
      // A closed dev server's resolver fails; its pending tasks are dropped.
      if (devResolver) {
        instance++;
        devResolver = undefined;
      }
    },

    buildEnd: {
      order: 'post',
      async handler() {
        if (!collector || devResolver || loaded.size === 0) return;
        collector.resolver = contextResolver(this as unknown as ResolveContext);
        const files = [...loaded];
        loaded.clear();
        await run((collector) => collector.addLoaded(files));
      },
    },
  };
}

/** Vite's build output, dependency cache and static assets are never sources. */
function viteOutputDirectories(config: ResolvedConfig): string[] {
  return [
    path.resolve(config.root, config.build.outDir),
    config.cacheDir,
    ...(config.publicDir ? [config.publicDir] : []),
  ];
}

/**
 * Resolves with every plugin of the client environment (Vite 6+) or the
 * server's plugin container (Vite 5). `scan` keeps the dependency optimizer
 * from registering what it resolves.
 */
function createDevResolver(server: ViteDevServer): Resolver {
  const environments = (
    server as { environments?: Record<string, { pluginContainer?: unknown }> }
  ).environments;
  const container = (environments?.client?.pluginContainer ??
    server.pluginContainer) as {
    resolveId(
      id: string,
      importer?: string,
      options?: { scan?: boolean; ssr?: boolean }
    ): Promise<{ id: string } | null>;
  };
  return async (specifier, importer) =>
    (await container.resolveId(specifier, importer, { scan: true, ssr: false }))
      ?.id;
}

/** Resolves with the build's plugins, from a hook's context. */
function contextResolver(context: ResolveContext): Resolver {
  return async (specifier, importer) =>
    (await context.resolve(specifier, importer, { skipSelf: true }))?.id;
}

/** `/src/App.vue?vue&type=script` → `/src/App.vue`; virtual modules → undefined */
function fileOf(id: string): string | undefined {
  const file = id.split('?', 1)[0]!;
  if (file.startsWith('\0') || !path.isAbsolute(file)) return undefined;
  return path.normalize(file);
}
