/**
 * The `'locale-twins'` translation splitting strategy's part of the compiler
 * plugin, as an extension of the regular plugin: which transforms run the
 * locale twins pass, the unattributed-entry warning and report list, and the
 * Vite hooks. `../index.ts` creates it.
 *
 * - Locale twins need the Vite integration: other bundlers get one warning
 *   and no locale twins pass.
 * - The pass (registration, msg() hashes) runs in production builds only, in
 *   every environment (the server keeps its placeholder inert but needs the
 *   msg() hashes the client uses, so SSR renders what the client renders).
 *   It runs only when the regular plugin computes compile-time hashes.
 *   `vite dev` output is exactly what it is without locale twins.
 * - Client production builds also strip attributed source text.
 */
import traverse from '@babel/traverse';
import { isLocaleTwinsSplitting } from 'generaltranslation/internal/experimental';
import type { TranslationSplittingStrategy } from 'generaltranslation/internal/experimental';
import type { GTConfig, LogLevel } from '../../config';
import type { PluginExtension } from '../createGTUnpluginFactory';
import type { ResolvedLocaleTwinsOptions } from '../config';
import { localeTwinsPass } from '../passes/localeTwinsPass';
import { LocaleTwinCollector } from '../state/LocaleTwinCollector';
import type { LocaleTwinTransform } from '../transform/twinTransform';
import {
  getBundlerEnvironment,
  isClientProductionBuild,
  isDevServerTransform,
} from '../utils/bundlerEnvironment';
import {
  createUnattributedEntriesWarning,
  formatUnattributedEntry,
  locateUnattributedEntry,
  type UnattributedEntryLocation,
} from '../utils/unattributedEntries';
import { createLocaleTwinsUnsupportedBundlerDiagnostic } from './buildDiagnostics';
import { createLocaleTwinsViteHooks } from './vite/localeTwinsViteHooks';

export type LocaleTwinsPluginOptions = {
  /** Resolved strategy (plugin option > gt.config.json > default). */
  splitting: TranslationSplittingStrategy;
  localeTwins: ResolvedLocaleTwinsOptions;
  gtConfig: GTConfig | undefined;
  compileTimeHash: boolean;
  /** Directory that `files.gt.output` is relative to. */
  configDir: string;
  logLevel: LogLevel | undefined;
  /** unplugin's `meta.framework` (`'vite'`, `'webpack'`, ...). */
  framework: string;
  /**
   * The plugin's generic end-of-build work. Vite's `buildEnd` override
   * replaces the generic hook, so the Vite hooks call it too.
   */
  onBuildEnd(context: unknown): void;
};

/**
 * The compiler plugin extension for locale twins: a per-module transform
 * (attribution, registration, stripping), the unattributed-entry warning, and
 * the Vite build hooks.
 */
export function createLocaleTwinsPlugin(
  options: LocaleTwinsPluginOptions
): PluginExtension {
  const requested = isLocaleTwinsSplitting(options.splitting);
  const supported = options.framework === 'vite';
  const enabled = requested && supported;
  const quiet = options.logLevel === 'silent' || options.logLevel === 'error';
  let unsupportedReported = false;

  // Vite command, for bundler contexts without per-environment info
  let viteCommand: string | undefined;
  // Module id → entries that keep their source text in client code
  const unattributedByModule = new Map<string, UnattributedEntryLocation[]>();
  // The last client build's list, for its build report
  let clientUnattributed: UnattributedEntryLocation[] = [];

  return {
    beginTransform(context, id, ssr) {
      if (requested && !supported && !unsupportedReported) {
        unsupportedReported = true;
        if (!quiet) {
          console.warn(
            createLocaleTwinsUnsupportedBundlerDiagnostic(options.framework)
          );
        }
      }
      const environment = getBundlerEnvironment(context);
      if (
        !enabled ||
        isDevServerTransform({ environment, command: viteCommand })
      ) {
        return undefined;
      }
      const twin: LocaleTwinTransform = {
        collector: new LocaleTwinCollector(),
        stripSourceText: isClientProductionBuild({
          environment,
          ssr,
          command: viteCommand,
        }),
        registered: false,
        runtimeRegistered: false,
      };
      if (twin.stripSourceText) unattributedByModule.delete(id);
      return {
        collector: twin.collector,
        afterInjection(_state, ast) {
          traverse(ast, localeTwinsPass(twin));
          if (twin.stripSourceText) {
            const unattributed = twin.collector.getUnattributed(
              twin.registered
            );
            if (unattributed.length > 0) {
              unattributedByModule.set(
                id,
                unattributed.map((entry) => locateUnattributedEntry(id, entry))
              );
            }
          }
          return {
            modified: twin.registered || twin.runtimeRegistered,
            // Its calls would put the stripped text back in the code
            skipRuntimeTranslate: twin.stripSourceText && twin.registered,
          };
        },
      };
    },

    buildEnd(context) {
      // Only client transforms record entries; the server build keeps the
      // client's list for its report
      if (getBundlerEnvironment(context)?.config?.consumer === 'server') {
        return;
      }
      clientUnattributed = [...unattributedByModule.values()].flat();
      unattributedByModule.clear();
      if (clientUnattributed.length > 0 && !quiet) {
        console.warn(
          createUnattributedEntriesWarning(
            clientUnattributed.map((entry) => formatUnattributedEntry(entry))
          )
        );
      }
    },

    vite: createLocaleTwinsViteHooks({
      enabled,
      localeTwins: options.localeTwins,
      gtConfig: options.gtConfig,
      compileTimeHash: options.compileTimeHash,
      configDir: options.configDir,
      logLevel: options.logLevel,
      onConfigResolved: (config) => {
        viteCommand = config.command;
      },
      onBuildEnd: options.onBuildEnd,
      getUnattributed: () => clientUnattributed,
    }),
  };
}
