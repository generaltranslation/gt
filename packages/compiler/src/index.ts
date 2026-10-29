import { createUnplugin } from 'unplugin';
import fs from 'node:fs';
import path from 'node:path';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';

// Core modules
import {
  GTConfig,
  PluginConfig,
  ResolvedLocaleTwinsOptions,
  resolveLocaleTwinsSettings,
} from './config';

// Import passes
import { collectionPass } from './passes/collectionPass';
import { injectionPass } from './passes/injectionPass';
import { macroExpansionPass } from './passes/macroExpansionPass';
import { handleErrors, InvalidLibraryUsageError } from './passes/handleErrors';
import { initializeState } from './state/utils/initializeState';
import { jsxInsertionPass } from './passes/jsxInsertionPass';
import { runtimeTranslatePass } from './passes/runtimeTranslatePass';
import { localeTwinsPass } from './passes/localeTwinsPass';
import { shouldTransformModuleId } from './utils/moduleId';
import { createLocaleTwinsViteHooks } from './locale-twins/vite/localeTwinsViteHooks';
import {
  getBundlerEnvironment,
  isClientProductionBuild,
} from './utils/bundlerEnvironment';
import {
  createUnattributedEntriesWarning,
  formatUnattributedEntry,
} from './utils/locale-twins/unattributedEntries';

/**
 * Architecture:
 *
 * Pass Pipeline:
 * - Pass 0: Macro expansion — transforms t`...` tagged templates and t(`...`) template/concatenation args
 * - Pass 1: Collection — collect + calculate all data, check for violations, register + track
 * - Pass 2: Injection — inject all data (hashes, messages, etc.)
 *
 * Babel functions:
 * - 1-to-1 relationship with processing functions
 * - Handle (1) enter/exit scope (2) invoking processing function
 * - ex) JSXElement()
 *
 * Processing functions:
 * - Are dependent on the pass, so they have three categories: (1) collection, (2) injection, (3) shared/general
 * - Invoke transformation functions and utility functions
 * - ex) processJSXElement()
 * - Has the following file structure:
 * + processing
 * | sharedProcessingFunction.ts
 * | + collection
 * | | collectionProcessingFunction.ts
 * | + injection
 * | | injectionProcessingFunction.ts
 *
 * Transformation functions:
 * - Are AGNOSTIC to pass number
 * - MUST be stateful in some way
 * - ex) trackImportDeclaration()
 *
 * Utility functions:
 * - Are AGNOSTIC to pass number
 * - Are stateless
 * - ex) extractIdentifiersFromLVal()
 *
 * State:
 * - Includes classes for tracking state
 *
 * Currently no support for:
 * - namespaces and and modules
 */

/**
 * GT Universal Plugin Options
 */
export interface GTUnpluginOptions extends PluginConfig, GTConfig {}

export const MISSING_GT_CONFIG_WARNING =
  '[@generaltranslation/compiler] No gtConfig found. Auto JSX injection and parsingFlags features require a gt.config.json. See https://generaltranslation.com/en/docs/react/concepts/compiler.';

export const createInvalidGTConfigWarning = (
  configPath: string,
  error: unknown
) =>
  `[@generaltranslation/compiler] Failed to load gt.config.json at ${configPath}. ` +
  `Auto JSX injection and parsingFlags features require a valid gt.config.json. ` +
  `${error instanceof Error ? error.message : String(error)}`;

function shouldWarn(logLevel: PluginConfig['logLevel']): boolean {
  return logLevel !== 'silent' && logLevel !== 'error';
}

type GTConfigLoadResult =
  | {
      gtConfig: NonNullable<PluginConfig['gtConfig']>;
      status: 'loaded';
    }
  | {
      status: 'missing';
    }
  | {
      configPath: string;
      error: unknown;
      status: 'invalid';
    };

function loadGTConfigFromCwd(): GTConfigLoadResult {
  const configPath = path.join(process.cwd(), 'gt.config.json');
  if (!fs.existsSync(configPath)) {
    return { status: 'missing' };
  }

  try {
    return {
      gtConfig: JSON.parse(fs.readFileSync(configPath, 'utf-8')) as NonNullable<
        PluginConfig['gtConfig']
      >,
      status: 'loaded',
    };
  } catch (error) {
    return { configPath, error, status: 'invalid' };
  }
}

function hasInlineGTConfig(options: GTUnpluginOptions): boolean {
  return (
    options.defaultLocale !== undefined ||
    options.locales !== undefined ||
    options.projectId !== undefined ||
    options._versionId !== undefined ||
    options.files !== undefined
  );
}

function getInlineGTConfig(options: GTUnpluginOptions): GTConfig | undefined {
  if (!hasInlineGTConfig(options)) return undefined;

  return {
    ...(options.defaultLocale !== undefined
      ? { defaultLocale: options.defaultLocale }
      : {}),
    ...(options.locales !== undefined ? { locales: options.locales } : {}),
    ...(options.projectId !== undefined
      ? { projectId: options.projectId }
      : {}),
    ...(options._versionId !== undefined
      ? { _versionId: options._versionId }
      : {}),
    ...(options.files !== undefined ? { files: options.files } : {}),
  };
}

function mergeGTConfigs(base: GTConfig, override: GTConfig): GTConfig {
  const mergedConfig = { ...base, ...override };
  if (!base.files && !override.files) return mergedConfig;

  const files = { ...base.files, ...override.files };
  if (base.files?.gt || override.files?.gt) {
    const gt = { ...base.files?.gt, ...override.files?.gt };
    if (base.files?.gt?.parsingFlags || override.files?.gt?.parsingFlags) {
      gt.parsingFlags = {
        ...base.files?.gt?.parsingFlags,
        ...override.files?.gt?.parsingFlags,
      };
    }
    files.gt = gt;
  }

  return { ...mergedConfig, files };
}

function resolveGTConfig(options: GTUnpluginOptions): GTConfigLoadResult {
  if (options.gtConfig) {
    return { gtConfig: options.gtConfig, status: 'loaded' };
  }

  const inlineGTConfig = getInlineGTConfig(options);
  const diskGTConfig = loadGTConfigFromCwd();
  if (!inlineGTConfig) return diskGTConfig;

  return {
    gtConfig:
      diskGTConfig.status === 'loaded'
        ? mergeGTConfigs(diskGTConfig.gtConfig, inlineGTConfig)
        : inlineGTConfig,
    status: 'loaded',
  };
}

/**
 * GT Universal Plugin - Main entry point
 *
 * Universal plugin for compile-time optimization of GT translation components
 * that works across webpack, Vite, Rollup, and other bundlers.
 */
const gtUnplugin = createUnplugin<GTUnpluginOptions | undefined>(
  (options = {}) => {
    const gtConfigLoadResult = resolveGTConfig(options);
    const loadedGTConfig =
      gtConfigLoadResult.status === 'loaded'
        ? gtConfigLoadResult.gtConfig
        : undefined;
    const resolvedOptions: GTUnpluginOptions = {
      ...options,
      ...(loadedGTConfig ? { gtConfig: loadedGTConfig } : {}),
    };
    // Resolve once so an invalid strategy fails at plugin creation and
    // build hooks can read the resolved values from resolvedOptions
    Object.assign(resolvedOptions, resolveLocaleTwinsSettings(resolvedOptions));

    if (shouldWarn(options.logLevel)) {
      if (gtConfigLoadResult.status === 'missing') {
        console.warn(MISSING_GT_CONFIG_WARNING);
      } else if (gtConfigLoadResult.status === 'invalid') {
        console.warn(
          createInvalidGTConfigWarning(
            gtConfigLoadResult.configPath,
            gtConfigLoadResult.error
          )
        );
      }
    }

    // Debug manifest: accumulates hash → jsxChildren across all files
    const debugManifest = resolvedOptions._debugHashManifest
      ? new Map<string, unknown>()
      : undefined;
    const writeDebugManifest = (): void => {
      if (!debugManifest || debugManifest.size === 0) return;
      const outPath = path.resolve(
        process.cwd(),
        '_gt_debug_hash_manifest.json'
      );
      fs.writeFileSync(
        outPath,
        JSON.stringify(Object.fromEntries(debugManifest), null, 2)
      );
      // eslint-disable-next-line no-console
      console.log(
        `[gt-compiler] Debug hash manifest written to ${outPath} (${debugManifest.size} entries)`
      );
    };
    // gt.config.json and files.gt.output are relative to the working directory
    const configDir = process.cwd();

    // Vite command, for bundler contexts without per-environment info
    let viteCommand: string | undefined;

    // Locale twins: module id → entries that keep their source text in client
    // code (formatted), reported once per client build in buildEnd
    const unattributedByModule = new Map<string, string[]>();

    /** End of a build (any bundler; Vite calls it from its buildEnd override). */
    const finishBuild = (context: unknown): void => {
      // Locale twins: list entries that kept their source text in the
      // client build (the server environment never records any)
      if (
        unattributedByModule.size > 0 &&
        getBundlerEnvironment(context)?.config?.consumer !== 'server'
      ) {
        const details = [...unattributedByModule.values()].flat();
        unattributedByModule.clear();
        if (shouldWarn(options.logLevel)) {
          console.warn(createUnattributedEntriesWarning(details));
        }
      }
      writeDebugManifest();
    };

    return {
      name: '@generaltranslation/GT_PLUGIN',
      transformInclude(id: string) {
        return shouldTransformModuleId(id);
      },
      transform(
        code: string,
        id: string,
        transformOptions?: { ssr?: boolean }
      ) {
        // Locale twins: client production builds ship source text only in
        // the placeholder, so the attributed text is stripped from code
        const stripSourceText =
          resolvedOptions.splitting === 'locale-twins' &&
          isClientProductionBuild({
            environment: getBundlerEnvironment(this),
            ssr: transformOptions?.ssr,
            command: viteCommand,
          });

        if (stripSourceText) unattributedByModule.delete(id);

        // Initialize processing state
        const state = initializeState(resolvedOptions, id, { stripSourceText });
        if (debugManifest) state.debugManifest = debugManifest;
        try {
          // Skip transformation if not needed
          if (
            state.settings.disableBuildChecks &&
            !state.settings.compileTimeHash
          ) {
            return null;
          }

          // Parse the code into AST
          const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript', 'decorators-legacy'],
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
          });

          // Pass 1: Jsx insertion
          if (state.settings.enableAutoJsxInjection) {
            traverse(ast, jsxInsertionPass(state));
          }

          // Pass 2: Macro expansion
          if (state.settings.enableMacroTransform) {
            traverse(ast, macroExpansionPass(state));
          }

          // Pass 3: Collection
          traverse(ast, collectionPass(state));

          // Handle errors
          if (handleErrors(state)) {
            return null;
          }

          // Pass 4: Injection (hashes + useGT prefetch parameters), gated on
          // the compileTimeHash setting
          const hasCollectionContent = state.stringCollector.hasContent();
          const injectionRan =
            hasCollectionContent && state.settings.compileTimeHash;

          if (injectionRan) {
            traverse(ast, injectionPass(state));
          }

          // Pass 4b: Locale twins registration (placeholder + msg $_hash, and
          // client source stripping), gated on the 'locale-twins' splitting
          // strategy and compileTimeHash
          if (injectionRan && state.settings.splitting === 'locale-twins') {
            traverse(ast, localeTwinsPass(state));
            if (stripSourceText) {
              const unattributed = state.localeTwins.getUnattributed(
                state.statistics.localeTwinRegistrationsCount > 0
              );
              if (unattributed.length > 0) {
                unattributedByModule.set(
                  id,
                  unattributed.map((entry) =>
                    formatUnattributedEntry(id, entry)
                  )
                );
              }
            }
          }

          // Pass 5: Runtime translate (dev hot reload). Skipped when source
          // text was stripped: its calls would put the text back in the code
          const devHotReloadActive =
            state.settings.devHotReload.strings ||
            state.settings.devHotReload.jsx;
          const sourceTextStripped =
            state.settings.stripSourceText &&
            state.statistics.localeTwinRegistrationsCount > 0;
          if (
            devHotReloadActive &&
            hasCollectionContent &&
            !sourceTextStripped
          ) {
            traverse(ast, runtimeTranslatePass(state));
          }

          // Generate code if any pass modified the AST
          if (
            !injectionRan &&
            state.statistics.macroExpansionsCount === 0 &&
            state.statistics.jsxInsertionsCount === 0 &&
            state.statistics.runtimeTranslateCount === 0 &&
            state.statistics.localeTwinRegistrationsCount === 0
          ) {
            return null;
          }

          return generate(ast, {
            retainLines: true,
            compact: false,
          });
        } catch (error) {
          // If the error is an instance of InvalidLibraryUsageError, throw it
          if (error instanceof InvalidLibraryUsageError) {
            throw error;
          }

          // Otherwise, log the error
          state.logger.logError(`Error processing ${id}: ${error}`);
          return null;
        }
      },
      buildEnd() {
        finishBuild(this);
      },
      // Vite-only hooks for locale twins. unplugin merges this object into
      // the Vite plugin, so its buildEnd replaces the generic one above.
      vite: createLocaleTwinsViteHooks({
        splitting: resolvedOptions.splitting!,
        localeTwins: resolvedOptions.localeTwins as ResolvedLocaleTwinsOptions,
        gtConfig: resolvedOptions.gtConfig,
        compileTimeHash: resolvedOptions.compileTimeHash !== false,
        configDir,
        logLevel: options.logLevel,
        onConfigResolved: (config) => {
          viteCommand = config.command;
        },
        onBuildEnd: finishBuild,
      }),
    };
  }
);

// Export the unplugin with different bundler integrations
export default gtUnplugin;
export const webpack = gtUnplugin.webpack;
export const vite = gtUnplugin.vite;
export const rollup = gtUnplugin.rollup;
export const rspack = gtUnplugin.rspack;
export const esbuild = gtUnplugin.esbuild;
