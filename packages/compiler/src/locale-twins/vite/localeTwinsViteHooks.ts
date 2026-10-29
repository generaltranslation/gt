/**
 * Vite hooks for the `'locale-twins'` translation splitting strategy. They go
 * in the unplugin `vite:` override, which unplugin merges into the plugin.
 *
 * - `configEnvironment`: adds the default vendor chunk to the client
 *   environment of a build (never over the user's own chunking).
 * - `buildEnd`: records the module graph for the vendor chunk.
 * - `writeBundle` (post): in the client environment of a build, generates the
 *   twins and writes them, the manifest and the build report into the outDir.
 * - `resolveId`/`load`: `virtual:gt-locale-twins-manifest` in any environment.
 * - `configureServer`: the dev-mode notice.
 *
 * Every hook is inert unless locale twins are on, except the virtual module,
 * which then exports `manifest = null`.
 */
import path from 'node:path';
import type { VitePlugin } from 'unplugin';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type {
  GTConfig,
  LogLevel,
  ResolvedLocaleTwinsOptions,
} from '../../config';
import type { TranslationSplittingStrategy } from 'generaltranslation/types';
import { COMPILER_DIAGNOSTIC_SOURCE } from '../../utils/diagnostics';
import {
  createVendorChunkSkippedDiagnostic,
  LOCALE_TWINS_DEV_NOTICE,
  LOCALE_TWINS_WITHOUT_COMPILE_TIME_HASH,
} from '../buildDiagnostics';
import type { LocaleTwinInputFile } from '../generateLocaleTwins';
import { writeLocaleTwinReport, writeLocaleTwins } from '../writeLocaleTwins';
import {
  LOCALE_TWIN_MANIFEST_MODULE_ID,
  loadManifestModule,
  RESOLVED_LOCALE_TWIN_MANIFEST_MODULE_ID,
} from './manifestModule';
import {
  createVendorChunkConfig,
  findUserChunking,
  VendorChunkSelector,
  type ModuleGraph,
} from './vendorChunk';

export type LocaleTwinsViteHooksOptions = {
  splitting: TranslationSplittingStrategy;
  localeTwins: ResolvedLocaleTwinsOptions;
  gtConfig: GTConfig | undefined;
  compileTimeHash: boolean;
  /** Directory that `files.gt.output` is relative to (where gt.config.json is read). */
  configDir: string;
  logLevel: LogLevel | undefined;
  /** Runs first in `configResolved` (this override replaces any generic one). */
  onConfigResolved?: (config: { command: string }) => void;
  /**
   * Runs first in `buildEnd` with the hook context: this override replaces
   * the generic `buildEnd` hook.
   */
  onBuildEnd?: (context: unknown) => void;
};

type Consumer = 'client' | 'server';

/** The parts of Vite's resolved (environment) config used here. */
type ConfigLike = {
  root: string;
  command: 'build' | 'serve';
  consumer?: Consumer;
  build: { outDir: string; ssr?: unknown };
  environments?: Record<string, { build?: { outDir?: string } } | undefined>;
  logger: { info(message: string): void; warn(message: string): void };
};

type HookContext = {
  environment?: { name: string; config: ConfigLike };
};

type OutputItem =
  | {
      type: 'chunk';
      fileName: string;
      code: string;
      isEntry: boolean;
      map?: { toString(): string } | null;
    }
  | { type: 'asset'; fileName: string; source: string | Uint8Array };

export function createLocaleTwinsViteHooks(
  options: LocaleTwinsViteHooksOptions
): Partial<VitePlugin> {
  const enabled = options.splitting === 'locale-twins';
  const quiet = options.logLevel === 'silent' || options.logLevel === 'error';
  let resolvedConfig: ConfigLike | undefined;
  const pendingWarnings: string[] = [];
  const vendorSelectors = new Map<string, VendorChunkSelector>();

  const logger = () => resolvedConfig?.logger ?? console;
  const warn = (message: string): void => {
    if (quiet) return;
    if (resolvedConfig) logger().warn(message);
    else pendingWarnings.push(message);
  };
  const info = (message: string): void => {
    if (!quiet) logger().info(message);
  };

  function describeEnvironment(context: HookContext | undefined): {
    name: string;
    consumer: Consumer;
    config: ConfigLike;
  } {
    const config = context?.environment?.config ?? resolvedConfig!;
    const ssr = Boolean(config.build.ssr);
    return {
      name: context?.environment?.name ?? (ssr ? 'ssr' : 'client'),
      consumer: config.consumer ?? (ssr ? 'server' : 'client'),
      config,
    };
  }

  const hooks = {
    configEnvironment(
      this: { meta?: object } | undefined,
      name: string,
      config: {
        consumer?: Consumer;
        build?: Parameters<typeof findUserChunking>[0];
      },
      env: { command: 'build' | 'serve' }
    ) {
      if (!enabled || !options.localeTwins.vendorChunk) return;
      if (env.command !== 'build') return;
      const consumer =
        config.consumer ?? (name === 'client' ? 'client' : 'server');
      if (consumer !== 'client') return;
      const userChunking = findUserChunking(config.build);
      if (userChunking) {
        warn(createVendorChunkSkippedDiagnostic(userChunking));
        return;
      }
      const selector = new VendorChunkSelector(
        () => resolvedConfig?.root ?? process.cwd()
      );
      vendorSelectors.set(name, selector);
      const rolldown = Boolean(this?.meta && 'rolldownVersion' in this.meta);
      return createVendorChunkConfig(selector.isVendor, rolldown);
    },

    configResolved(config: ConfigLike) {
      options.onConfigResolved?.(config);
      resolvedConfig = config;
      for (const message of pendingWarnings.splice(0)) warn(message);
    },

    configureServer() {
      if (enabled) info(LOCALE_TWINS_DEV_NOTICE);
    },

    buildEnd(this: HookContext & ModuleGraph, error?: Error) {
      options.onBuildEnd?.(this);
      if (!enabled || error) return;
      const { name } = describeEnvironment(this);
      vendorSelectors.get(name)?.record(this);
    },

    resolveId(id: string) {
      return id === LOCALE_TWIN_MANIFEST_MODULE_ID
        ? RESOLVED_LOCALE_TWIN_MANIFEST_MODULE_ID
        : null;
    },

    load(this: HookContext & { addWatchFile?(id: string): void }, id: string) {
      if (id !== RESOLVED_LOCALE_TWIN_MANIFEST_MODULE_ID) return null;
      const { config, consumer } = describeEnvironment(this);
      const result = loadManifestModule({ enabled, config, consumer });
      if (result.manifestPath) this.addWatchFile?.(result.manifestPath);
      return result.code;
    },

    writeBundle: {
      order: 'post' as const,
      handler(
        this: HookContext,
        outputOptions: { dir?: string },
        bundle: Record<string, OutputItem>
      ) {
        if (!enabled) return;
        const { consumer, config } = describeEnvironment(this);
        if (consumer !== 'client' || config.command !== 'build') return;
        if (!options.compileTimeHash) {
          warn(LOCALE_TWINS_WITHOUT_COMPILE_TIME_HASH);
        }
        const outDir =
          outputOptions.dir ?? path.resolve(config.root, config.build.outDir);
        const output = readOutput(bundle);
        const gtConfig = options.gtConfig ?? {};
        const defaultLocale = gtConfig.defaultLocale ?? libraryDefaultLocale;
        const outputPattern = gtConfig.files?.gt?.output;
        const { manifest, report } = writeLocaleTwins({
          outDir,
          ...output,
          defaultLocale,
          locales: gtConfig.locales ?? [defaultLocale],
          translationFile: outputPattern
            ? (locale) =>
                path.resolve(
                  options.configDir,
                  outputPattern.replace(/\[locale\]/g, locale)
                )
            : undefined,
          missingTranslations: options.localeTwins.missingTranslations,
          vendorChunk: options.localeTwins.vendorChunk,
          warn,
        });
        // Seam for later post-build steps (SPA document rewrite): they run
        // here, with the manifest, and may add to the report.
        const reportPath = writeLocaleTwinReport(outDir, report);
        info(
          `[${COMPILER_DIAGNOSTIC_SOURCE}] Locale twins: ${report.twinned.length} twinned and ${report.shared.length} shared JS files, ${manifest.locales.length} locales, JS output x${report.outputMultiplier.toFixed(2)}. Report: ${path.relative(config.root, reportPath)}`
        );
      },
    },
  };
  return hooks as Partial<VitePlugin>;
}

/** Reads emitted chunks (code as written to disk) and text assets. */
function readOutput(bundle: Record<string, OutputItem>): {
  files: Record<string, LocaleTwinInputFile>;
  assets: Record<string, string>;
  entries: string[];
} {
  const files: Record<string, LocaleTwinInputFile> = {};
  const assets: Record<string, string> = {};
  const entries: string[] = [];
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk') {
      files[item.fileName] = {
        code: item.code,
        map: item.map ? item.map.toString() : null,
      };
      if (item.isEntry) entries.push(item.fileName);
    } else {
      assets[item.fileName] =
        typeof item.source === 'string'
          ? item.source
          : Buffer.from(item.source).toString('utf8');
    }
  }
  return { files, assets, entries };
}
