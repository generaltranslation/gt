/**
 * The experimental GT compiler plugin factory: a copy of the regular plugin
 * in `../index.ts` (keep the two in sync) with the locale twins build
 * extension. The regular plugin has no locale twin code.
 */
import {
  type UnpluginContextMeta,
  type UnpluginFactory,
  type VitePlugin,
} from 'unplugin';
import fs from 'node:fs';
import path from 'node:path';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import type { File } from '@babel/types';
import type { GTConfig, PluginConfig } from '../config';
import {
  createInvalidGTConfigWarning,
  MISSING_GT_CONFIG_WARNING,
  type GTUnpluginOptions,
} from '../index';
import { injectionPass as regularInjectionPass } from '../passes/injectionPass';
import { macroExpansionPass } from '../passes/macroExpansionPass';
import { handleErrors, InvalidLibraryUsageError } from '../passes/handleErrors';
import { initializeState } from '../state/utils/initializeState';
import { jsxInsertionPass } from '../passes/jsxInsertionPass';
import { runtimeTranslatePass } from '../passes/runtimeTranslatePass';
import type { TransformState } from '../state/types';
import { collectionPass } from './passes/collectionPass';
import { injectionPass } from './passes/injectionPass';
import type { LocaleTwinCollector } from './state/LocaleTwinCollector';
import { ImportSourceAliases } from './utils/importSourceAliases';
import { shouldTransformModuleId } from './utils/moduleId';

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
 * What a build extension does for one module transform.
 */
export type TransformExtension = {
  /** Collects the module's entries during the collection and injection passes. */
  collector?: LocaleTwinCollector;
  /**
   * Runs after the injection pass (only with compile-time hashes, also on
   * modules without entries). Returns whether it changed the AST, and
   * whether the dev hot reload pass must be skipped.
   */
  afterInjection?(
    state: TransformState,
    ast: File
  ): { modified: boolean; skipRuntimeTranslate: boolean };
};

/**
 * A build extension of the GT compiler plugin: the locale twins plugin
 * (`locale-twins/createLocaleTwinsPlugin.ts`).
 */
export type PluginExtension = {
  /** Decides what the extension does for a module transform. */
  beginTransform(
    context: unknown,
    id: string,
    ssr: boolean | undefined
  ): TransformExtension | undefined;
  /** End of a build (any bundler). */
  buildEnd?(context: unknown): void;
  /**
   * Hooks for unplugin's `vite:` override. A `buildEnd` here replaces the
   * generic one, so it must call `finishBuild`.
   */
  vite?: Partial<VitePlugin>;
};

/** What a build extension is created with. */
export type PluginExtensionContext<Options extends GTUnpluginOptions> = {
  /** The options with the gt.config.json the plugin loaded. */
  options: Options;
  meta: UnpluginContextMeta;
  /** The plugin's end-of-build work, extension included. */
  finishBuild(context: unknown): void;
};

/**
 * The experimental GT plugin's unplugin factory: the regular plugin of
 * `../index.ts` (keep in sync) with a build extension. Its transforms
 * present `/experimental` GT imports to the regular passes as regular ones
 * ({@link ImportSourceAliases}), let the extension collect the module's
 * entries during the collection and injection passes, and run the
 * extension's pass after injection.
 */
export function createGTUnpluginFactory<
  Options extends GTUnpluginOptions = GTUnpluginOptions,
>(
  createExtension?: (
    context: PluginExtensionContext<Options>
  ) => PluginExtension
): UnpluginFactory<Options | undefined> {
  return (options = {} as Options, meta) => {
    const gtConfigLoadResult = resolveGTConfig(options);
    const loadedGTConfig =
      gtConfigLoadResult.status === 'loaded'
        ? gtConfigLoadResult.gtConfig
        : undefined;
    const resolvedOptions: Options = {
      ...options,
      ...(loadedGTConfig ? { gtConfig: loadedGTConfig } : {}),
    };

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
    /** End of a build (any bundler). */
    const finishBuild = (context: unknown): void => {
      extension?.buildEnd?.(context);
      writeDebugManifest();
    };

    const extension = createExtension?.({
      options: resolvedOptions,
      meta,
      finishBuild,
    });

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
        const transformExtension = extension?.beginTransform(
          this,
          id,
          transformOptions?.ssr
        );

        // Initialize processing state
        const state = initializeState(resolvedOptions, id);
        const collector = transformExtension?.collector;
        const importSources = new ImportSourceAliases();
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

          importSources.alias(ast.program);

          // Pass 1: Jsx insertion
          if (state.settings.enableAutoJsxInjection) {
            traverse(ast, jsxInsertionPass(state));
            // Also alias the GtInternalTranslateJsx import it inserted
            importSources.alias(ast.program);
          }

          // Pass 2: Macro expansion
          if (state.settings.enableMacroTransform) {
            traverse(ast, macroExpansionPass(state));
            // Its injected t() import must be the locale twin version
            importSources.aliasMacroImport(
              ast.program,
              state.settings.autoJsxImportSource
            );
          }

          // Pass 3: Collection
          traverse(ast, collectionPass(state, collector));

          // Handle errors
          if (handleErrors(state)) {
            importSources.restore();
            return null;
          }

          // Pass 4: Injection (hashes + useGT prefetch parameters), gated on
          // the compileTimeHash setting
          const hasCollectionContent = state.stringCollector.hasContent();
          const injectionRan =
            hasCollectionContent && state.settings.compileTimeHash;

          if (injectionRan) {
            traverse(
              ast,
              collector
                ? injectionPass(state, collector)
                : regularInjectionPass(state)
            );
          }

          // Pass 4b: Build extension, gated on compileTimeHash. It reads the
          // module's own import sources.
          importSources.restore();
          const extensionResult =
            state.settings.compileTimeHash && transformExtension?.afterInjection
              ? transformExtension.afterInjection(state, ast)
              : undefined;
          importSources.alias(ast.program);

          // Pass 5: Runtime translate (dev hot reload)
          const devHotReloadActive =
            state.settings.devHotReload.strings ||
            state.settings.devHotReload.jsx;
          if (
            devHotReloadActive &&
            hasCollectionContent &&
            !extensionResult?.skipRuntimeTranslate
          ) {
            traverse(ast, runtimeTranslatePass(state));
          }
          importSources.restore();

          // Generate code if any pass modified the AST
          if (
            !injectionRan &&
            state.statistics.macroExpansionsCount === 0 &&
            state.statistics.jsxInsertionsCount === 0 &&
            state.statistics.runtimeTranslateCount === 0 &&
            !extensionResult?.modified
          ) {
            return null;
          }

          return generate(ast, {
            retainLines: true,
            compact: false,
          });
        } catch (error) {
          importSources.restore();
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
      // unplugin merges this object into the Vite plugin, so a buildEnd here
      // replaces the generic one above.
      ...(extension?.vite ? { vite: extension.vite } : {}),
    };
  };
}
