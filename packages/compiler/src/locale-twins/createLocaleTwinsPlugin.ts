/**
 * The `'locale-twins'` translation splitting strategy's part of the compiler
 * plugin: which transforms run the locale twins pass, the unattributed-entry
 * warning and report list, and the Vite hooks. `src/index.ts` only calls it.
 *
 * - Locale twins need the Vite integration: other bundlers get one warning
 *   and no locale twins pass.
 * - The pass runs in production builds only, in every environment: client
 *   builds get a placeholder at every attributed call site, and every build
 *   marks the entries it cannot attribute, so SSR renders what the client
 *   renders.
 *   `vite dev` output is exactly what it is without locale twins.
 * - Client production builds also strip attributed source text.
 */
import type { File } from '@babel/types';
import traverse from '@babel/traverse';
import type { VitePlugin } from 'unplugin';
import { isLocaleTwinsSplitting } from 'generaltranslation/internal';
import type { TranslationSplittingStrategy } from 'generaltranslation/types';
import type { GTConfig, LogLevel, ResolvedLocaleTwinsOptions } from '../config';
import { localeTwinsPass } from '../passes/localeTwinsPass';
import type { TransformState } from '../state/types';
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
} from '../utils/locale-twins/unattributedEntries';
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

/** What the locale twins pass does for one module transform. */
export type LocaleTwinsTransform = {
  /** Run the pass (call site markers). */
  active: boolean;
  /** Remove attributed source text (client production builds). */
  stripSourceText: boolean;
};

export type LocaleTwinsPlugin = {
  /** Decides the pass for a transform; call before `initializeState`. */
  beginTransform(
    context: unknown,
    id: string,
    ssr?: boolean
  ): LocaleTwinsTransform;
  /** Runs the pass on a module whose hashes were injected. */
  runPass(state: TransformState, ast: File, id: string): void;
  /** End of a build (any bundler): the unattributed-entry warning. */
  buildEnd(context: unknown): void;
  /** Hooks for unplugin's `vite:` override. */
  vite: Partial<VitePlugin>;
};

export function createLocaleTwinsPlugin(
  options: LocaleTwinsPluginOptions
): LocaleTwinsPlugin {
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
      const active =
        enabled && !isDevServerTransform({ environment, command: viteCommand });
      const stripSourceText =
        active &&
        isClientProductionBuild({ environment, ssr, command: viteCommand });
      if (stripSourceText) unattributedByModule.delete(id);
      return { active, stripSourceText };
    },

    runPass(state, ast, id) {
      traverse(ast, localeTwinsPass(state));
      if (!state.settings.stripSourceText) return;
      const unattributed = state.localeTwins.getUnattributed(
        state.statistics.localeTwinModulesCount > 0
      );
      if (unattributed.length > 0) {
        unattributedByModule.set(
          id,
          unattributed.map((entry) => locateUnattributedEntry(id, entry))
        );
      }
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
