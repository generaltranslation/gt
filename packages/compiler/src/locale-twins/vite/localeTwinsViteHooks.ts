/**
 * Vite hooks for the `'locale-twins'` translation splitting strategy. They go
 * in the unplugin `vite:` override, which unplugin merges into the plugin.
 *
 * - `buildStart`: in the client environment of a build, watches the
 *   translation files the twins are filled from (`vite build --watch`).
 * - `buildEnd`: records the module graph for the vendor chunk.
 * - `outputOptions`: adds the default vendor chunk to the client environment
 *   of a build (never over the user's own chunking).
 * - `writeBundle` (post): in the client environment of a build, generates the
 *   twins and writes them and the manifest into the outDir, rewrites HTML
 *   documents (SPA `index.html`) to load their locale's entry twin, and
 *   writes the build report under `<root>/node_modules/.cache/gt/` (out of
 *   the public outDir).
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
import { COMPILER_DIAGNOSTIC_SOURCE } from '../../utils/diagnostics';
import {
  createVendorChunkSkippedDiagnostic,
  LOCALE_TWINS_DEV_NOTICE,
  LOCALE_TWINS_WITH_CHUNK_IMPORT_MAP,
  LOCALE_TWINS_WITHOUT_COMPILE_TIME_HASH,
} from '../buildDiagnostics';
import type { LocaleTwinInputFile } from '../generateLocaleTwins';
import {
  toUnattributedReportEntry,
  type UnattributedEntryLocation,
} from '../../utils/locale-twins/unattributedEntries';
import {
  writeLocaleTwinReport,
  writeLocaleTwinSpaDocuments,
  writeLocaleTwins,
} from '../writeLocaleTwins';
import {
  LOCALE_TWIN_MANIFEST_MODULE_ID,
  loadManifestModule,
  RESOLVED_LOCALE_TWIN_MANIFEST_MODULE_ID,
} from './manifestModule';
import {
  createVendorChunkOutputOptions,
  findUserChunking,
  VendorChunkSelector,
  type ModuleGraph,
} from './vendorChunk';

export type LocaleTwinsViteHooksOptions = {
  /** Locale twins are on (and the bundler is Vite). */
  enabled: boolean;
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
  /** The client build's unattributed entries, for the build report. */
  getUnattributed?: () => UnattributedEntryLocation[];
};

type Consumer = 'client' | 'server';

/** The output options Vite passes to `outputOptions` (Rolldown or Rollup). */
type OutputOptions = Parameters<
  Extract<NonNullable<VitePlugin['outputOptions']>, (...args: never) => unknown>
>[0];

/** The parts of Vite's resolved (environment) config used here. */
type ConfigLike = {
  root: string;
  command: 'build' | 'serve';
  consumer?: Consumer;
  build: {
    outDir: string;
    ssr?: unknown;
    chunkImportMap?: unknown;
    rolldownOptions?: { experimental?: { chunkImportMap?: unknown } };
  };
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
  const { enabled } = options;
  const quiet = options.logLevel === 'silent' || options.logLevel === 'error';
  let resolvedConfig: ConfigLike | undefined;
  const pendingWarnings: string[] = [];
  const vendorSelectors = new Map<string, VendorChunkSelector>();
  /** One selector per environment, shared by `buildEnd` and `outputOptions`. */
  const vendorSelector = (name: string): VendorChunkSelector => {
    let selector = vendorSelectors.get(name);
    if (!selector) {
      selector = new VendorChunkSelector();
      vendorSelectors.set(name, selector);
    }
    return selector;
  };

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

  const gtConfig = options.gtConfig ?? {};
  const defaultLocale = gtConfig.defaultLocale ?? libraryDefaultLocale;
  const locales = gtConfig.locales ?? [defaultLocale];
  const outputPattern = gtConfig.files?.gt?.output;
  /** Absolute path of a locale's `[locale].json` (`files.gt.output`). */
  const translationFile = outputPattern
    ? (locale: string) =>
        path.resolve(
          options.configDir,
          outputPattern.replace(/\[locale\]/g, locale)
        )
    : undefined;

  /** Whether this hook runs in the client environment of a build with locale twins. */
  function generatesTwins(context: HookContext | undefined): boolean {
    if (!enabled) return false;
    const { consumer, config } = describeEnvironment(context);
    return consumer === 'client' && config.command === 'build';
  }

  /** Whether this hook runs in the client environment of a vendor-chunked build. */
  function addsVendorChunk(context: HookContext | undefined): boolean {
    return options.localeTwins.vendorChunk && generatesTwins(context);
  }

  const hooks: Partial<VitePlugin> = {
    configResolved(config: ConfigLike) {
      options.onConfigResolved?.(config);
      resolvedConfig = config;
      for (const message of pendingWarnings.splice(0)) warn(message);
      if (enabled && config.command === 'build' && usesChunkImportMap(config)) {
        throw new Error(LOCALE_TWINS_WITH_CHUNK_IMPORT_MAP);
      }
    },

    // The twins are filled from the translation files, which SPA client code
    // no longer imports: watch them so `vite build --watch` regenerates the
    // twins after a translation edit (files created later included)
    buildStart(this: HookContext & { addWatchFile(id: string): void }) {
      if (!translationFile || !generatesTwins(this)) return;
      for (const locale of locales) {
        if (locale !== defaultLocale)
          this.addWatchFile(translationFile(locale));
      }
    },

    configureServer() {
      if (enabled) info(LOCALE_TWINS_DEV_NOTICE);
    },

    buildEnd(this: HookContext & ModuleGraph, error?: Error) {
      options.onBuildEnd?.(this);
      if (!addsVendorChunk(this)) return;
      if (error) return;
      const { name, config } = describeEnvironment(this);
      vendorSelector(name).record(this, config.root);
    },

    outputOptions(
      this: (HookContext & { meta?: object }) | undefined,
      outputOptions: OutputOptions
    ): OutputOptions | null {
      if (!addsVendorChunk(this)) return null;
      const { name, config } = describeEnvironment(this);
      const userChunking = findUserChunking(
        config.build as Parameters<typeof findUserChunking>[0]
      );
      if (userChunking) {
        warn(createVendorChunkSkippedDiagnostic(userChunking));
        return null;
      }
      const rolldown = Boolean(this?.meta && 'rolldownVersion' in this.meta);
      return {
        ...outputOptions,
        ...createVendorChunkOutputOptions(
          vendorSelector(name).isVendor,
          rolldown
        ),
      };
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
        if (!generatesTwins(this)) return;
        const { config } = describeEnvironment(this);
        if (!options.compileTimeHash) {
          warn(LOCALE_TWINS_WITHOUT_COMPILE_TIME_HASH);
        }
        const outDir =
          outputOptions.dir ?? path.resolve(config.root, config.build.outDir);
        const output = readOutput(bundle);
        const { manifest, report } = writeLocaleTwins({
          outDir,
          ...output,
          defaultLocale,
          locales,
          translationFile,
          missingTranslations: options.localeTwins.missingTranslations,
          vendorChunk: options.localeTwins.vendorChunk,
          unattributed: (options.getUnattributed?.() ?? []).map((entry) =>
            toUnattributedReportEntry(entry, config.root)
          ),
          warn,
        });
        // Post-build steps that need the manifest run here and may add to
        // the report before it is written.
        const spa = writeLocaleTwinSpaDocuments({
          outDir,
          documents: Object.fromEntries(
            Object.entries(output.assets).filter(([fileName]) =>
              fileName.endsWith('.html')
            )
          ),
          manifest,
          bootstrap: options.localeTwins.spaBootstrap,
          localeCookieName: options.localeTwins.localeCookieName,
          customMapping: gtConfig.customMapping,
        });
        if (spa) report.spa = spa;
        const reportPath = writeLocaleTwinReport(config.root, report);
        info(
          `[${COMPILER_DIAGNOSTIC_SOURCE}] Locale twins: ${report.twinned.length} twinned and ${report.shared.length} shared JS files, ${manifest.locales.length} locales, JS output x${report.outputMultiplier.toFixed(2)}. Report: ${path.relative(config.root, reportPath)}`
        );
      },
    },
  };
  return hooks;
}

/** Whether a build maps chunks through an import map (Vite 8). */
function usesChunkImportMap(config: ConfigLike): boolean {
  return Boolean(
    config.build?.chunkImportMap ||
    config.build?.rolldownOptions?.experimental?.chunkImportMap
  );
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
