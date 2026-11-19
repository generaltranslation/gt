import { createUnplugin, type UnpluginOptions } from 'unplugin';
import fs from 'node:fs';
import path from 'node:path';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import {
  describeConfigParseError,
  gtConfigFilePaths,
  validateGTConfig,
} from 'generaltranslation/config-schema';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

// Core modules
import { GTConfig, PluginConfig } from './config';

// Import passes
import { collectionPass } from './passes/collectionPass';
import { injectionPass } from './passes/injectionPass';
import { handleErrors, InvalidLibraryUsageError } from './passes/handleErrors';
import { initializeState } from './state/utils/initializeState';
import {
  describeChunks,
  getChunkImportMapOptions,
  readChunkImportMap,
} from './transform/chunk-translations/chunkImportMap';
import {
  CHUNK_TRANSLATIONS_SOURCE,
  UNSPLIT_LOADER_PLACEHOLDER,
  getChunkTranslations,
  getChunkTranslationsNaming,
  resolveChunkTranslations,
} from './transform/chunk-translations/resolveChunkTranslations';
import {
  canImportChunkTranslations,
  finishChunkTranslationsFile,
  wrapDynamicImports,
} from './transform/chunk-translations/chunkTranslationsModule';
import {
  UNSTARTED_APP_WARNING,
  createBundledCatalogsWarning,
  createMissingTranslationsWarning,
  createUngatedImportsWarning,
  createUnreadImportsError,
  loadChunkTranslationsTable,
  writeChunkTranslations,
} from './transform/chunk-translations/writeChunkTranslations';
import {
  findImportedChunks,
  findUngatedImports,
  passPreloads,
  replaceImportedChunks,
  type UngatedImports,
} from './transform/chunk-translations/assignTranslations';
import {
  createUnsplitTranslationsMessage,
  getUnsplitTranslations,
  replaceUnsplitLoader,
} from './transform/chunk-translations/unsplitTranslations';
import { getPageBase } from './transform/chunk-translations/startupScript';
import { jsxInsertionPass } from './passes/jsxInsertionPass';
import { runtimeTranslatePass } from './passes/runtimeTranslatePass';
import {
  importsMessageSource,
  taggedTemplateHashInjectionPass,
} from './passes/taggedTemplateHashInjectionPass';

/**
 * Architecture:
 *
 * Pass Pipeline:
 * - Pass 1: Collection — collect + calculate all data, check for violations, register + track
 * - Pass 2: Injection — inject the collected hashes
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

function isDependency(id: string): boolean {
  return /[\\/]node_modules[\\/]/.test(id);
}

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
      diagnostic: ReturnType<typeof describeConfigParseError>;
      status: 'invalid';
    };

function loadGTConfigFromCwd(): GTConfigLoadResult {
  // The compiler reads only the root config file.
  const configPath = path.join(process.cwd(), gtConfigFilePaths[0]);
  if (!fs.existsSync(configPath)) {
    return { status: 'missing' };
  }

  let config: unknown;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    return {
      diagnostic: describeConfigParseError(error, configPath),
      status: 'invalid',
    };
  }
  const result = validateGTConfig(config, configPath);
  if (result.success) return { gtConfig: result.output, status: 'loaded' };
  return { diagnostic: result.diagnostic, status: 'invalid' };
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
  (options = {}, meta) => {
    const gtConfigLoadResult = resolveGTConfig(options);
    const loadedGTConfig =
      gtConfigLoadResult.status === 'loaded'
        ? gtConfigLoadResult.gtConfig
        : undefined;
    const chunkTranslationsResolution = getChunkTranslations(
      options.experimentalChunkTranslations
    )
      ? resolveChunkTranslations(loadedGTConfig, {
          framework: meta.framework,
          compileTimeHash: options.compileTimeHash !== false,
          naming: getChunkTranslationsNaming(
            options.experimentalChunkTranslationsNaming
          ),
        })
      : undefined;
    const chunkTranslations =
      chunkTranslationsResolution && !('error' in chunkTranslationsResolution)
        ? chunkTranslationsResolution
        : undefined;
    const resolvedOptions: GTUnpluginOptions = {
      ...options,
      ...(loadedGTConfig ? { gtConfig: loadedGTConfig } : {}),
    };

    if (shouldWarn(options.logLevel)) {
      if (gtConfigLoadResult.status === 'missing') {
        console.warn(MISSING_GT_CONFIG_WARNING);
      } else if (gtConfigLoadResult.status === 'invalid') {
        console.warn(
          createDiagnosticMessage({
            source: '@generaltranslation/compiler',
            severity: 'Warning',
            reassurance:
              'The build continues without auto JSX injection and parsingFlags features',
            ...gtConfigLoadResult.diagnostic,
          })
        );
      }
    }

    // Debug manifest: accumulates hash → jsxChildren across all files
    const debugManifest = resolvedOptions._debugHashManifest
      ? new Map<string, unknown>()
      : undefined;

    const gtFiles = resolvedOptions.gtConfig?.files?.gt;
    // Vite's build() sets NODE_ENV after plugins are created, so read it when each hook runs, as transforms do
    const isProduction = () => process.env.NODE_ENV === 'production';

    const plugin: UnpluginOptions = {
      name: '@generaltranslation/GT_PLUGIN',
      buildStart() {
        if (
          isProduction() &&
          chunkTranslationsResolution &&
          'error' in chunkTranslationsResolution
        ) {
          throw new Error(chunkTranslationsResolution.error);
        }
      },
      transformInclude(id: string) {
        // Only transform TSX and JSX files
        return (
          id.endsWith('.tsx') ||
          id.endsWith('.jsx') ||
          id.endsWith('.ts') ||
          id.endsWith('.js')
        );
      },
      transform(code: string, id: string) {
        // Initialize processing state
        const state = initializeState(resolvedOptions, id, chunkTranslations);
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

          if (
            state.settings.chunkTranslations &&
            canImportChunkTranslations(ast.program, code)
          ) {
            state.chunkTranslations = { imports: new Set() };
          }

          // Pass 1: Jsx insertion
          if (state.settings.enableAutoJsxInjection) {
            traverse(ast, jsxInsertionPass(state));
          }

          // Pass 2: Collection
          traverse(ast, collectionPass(state));

          // Handle errors
          if (handleErrors(state)) {
            return null;
          }

          // Pass 3: Injection (<T> hashes), gated on the compileTimeHash setting
          const hasCollectionContent = state.stringCollector.hasContent();
          const injectionRan =
            hasCollectionContent && state.settings.compileTimeHash;

          if (injectionRan) {
            traverse(ast, injectionPass(state));
          }

          // Pass 3b: $_hash injection for tagged templates
          if (state.settings.compileTimeHash && importsMessageSource(ast)) {
            traverse(ast, taggedTemplateHashInjectionPass(state));
          }

          // Pass 4: Runtime translate (dev hot reload)
          if (state.settings.devHotReload.jsx && hasCollectionContent) {
            traverse(ast, runtimeTranslatePass(state));
          }

          const chunkTranslationsChanged = finishChunkTranslationsFile(
            ast,
            state
          );

          // Generate code if any pass modified the AST
          if (
            !chunkTranslationsChanged &&
            !injectionRan &&
            state.statistics.jsxInsertionsCount === 0 &&
            state.statistics.runtimeTranslateCount === 0 &&
            state.statistics.taggedTemplateHashInjectionsCount === 0
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
        if (debugManifest && debugManifest.size > 0) {
          const fs = require('fs');
          const path = require('path');
          const outPath = path.resolve(
            process.cwd(),
            '_gt_debug_hash_manifest.json'
          );
          const manifest = Object.fromEntries(debugManifest);
          fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
          // eslint-disable-next-line no-console
          console.log(
            `[gt-compiler] Debug hash manifest written to ${outPath} (${debugManifest.size} entries)`
          );
        }
      },
    };
    if (!chunkTranslations || !gtFiles) return plugin;

    // What writes the startup script of each entry chunk the last build wrote, by its file
    let startupScripts = new Map<string, (base: string) => string>();
    // The chunks whose dynamic import needs a translations file
    let imported = new Set<string>();
    // Whether loading the first chunk loads the second
    let isLoadedWith: (chunk: string, other: string) => boolean = () => false;
    // Where the build's files are served from and its assets go: Vite's `base` and `build.assetsDir`
    let base = '';
    let assetsDir = '';
    function generateBundle(
      this: { emitFile: (file: never) => unknown },
      _outputOptions: unknown,
      bundle: Record<string, { type: string }>
    ): void {
      if (!isProduction()) return;
      const written = writeChunkTranslations(bundle, chunkTranslations!, {
        gtFiles: gtFiles!,
        base,
        assetsDir,
        emitFile: (file) => this.emitFile(file as never),
      });
      startupScripts = written.startupScripts;
      imported = written.imported;
      isLoadedWith = written.isLoadedWith;
      if (!shouldWarn(options.logLevel)) return;
      if (written.missingLocales.length) {
        console.warn(createMissingTranslationsWarning(written.missingLocales));
      }
      if (!chunkTranslations!.starts) {
        console.warn(UNSTARTED_APP_WARNING);
      } else if (written.bundledCatalogs.length) {
        console.warn(createBundledCatalogsWarning(written.bundledCatalogs));
      }
      if (written.unsplit.length) {
        console.warn(createUnsplitTranslationsMessage(written.unsplit));
      }
    }
    // Chunks are rendered once every module is compiled, so every call site is known
    function renderChunk(code: string): string | null {
      if (!isProduction()) return null;
      const passed = passPreloads(code);
      if (!passed.includes(UNSPLIT_LOADER_PLACEHOLDER)) {
        return passed === code ? null : passed;
      }
      const unsplit = getUnsplitTranslations(
        loadChunkTranslationsTable(gtFiles!, chunkTranslations!),
        chunkTranslations!
      );
      return (
        replaceUnsplitLoader(passed, Object.keys(unsplit).length > 0) ?? null
      );
    }
    // The bundler's options say whether it writes a chunk import map
    const readBundlerOptions = (bundlerOptions: unknown): null => {
      chunkTranslations.importMap = getChunkImportMapOptions(bundlerOptions);
      return null;
    };
    // After Vite has listed the chunks each dynamic import preloads
    const nameImportedChunks = {
      order: 'post',
      handler(
        _outputOptions: unknown,
        bundle: Record<
          string,
          {
            type: string;
            fileName: string;
            code?: string;
            dynamicImports?: string[];
          }
        >
      ): void {
        if (!isProduction()) return;
        const needsFiles = (target: string) => imported.has(target);
        const importMap = readChunkImportMap(
          bundle,
          chunkTranslations.importMap
        );
        const describeChunk = describeChunks(importMap);
        // An import that loads translations and that nothing gates: one the
        // build could not read is its failure, one it never wrapped is not
        const unread: UngatedImports[] = [];
        const unwrapped: UngatedImports[] = [];
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk' || typeof chunk.code !== 'string')
            continue;
          const source = { fileName: chunk.fileName, code: chunk.code };
          const ungated = findUngatedImports(
            chunk,
            findImportedChunks(source, importMap),
            needsFiles,
            isLoadedWith
          );
          const replaced = replaceImportedChunks(source, needsFiles, importMap);
          if (replaced.code !== chunk.code) chunk.code = replaced.code;
          if (ungated) {
            (replaced.unread ? unread : unwrapped).push({
              ...ungated,
              targets: ungated.targets.map(describeChunk),
            });
          }
        }
        if (unread.length) throw new Error(createUnreadImportsError(unread));
        if (unwrapped.length && shouldWarn(options.logLevel)) {
          console.warn(createUngatedImportsWarning(unwrapped));
        }
      },
    };
    return [
      {
        ...plugin,
        vite: {
          ...plugin.vite,
          configResolved(config: {
            base: string;
            build: { assetsDir: string };
          }) {
            base = config.base;
            assetsDir = config.build.assetsDir;
          },
          renderChunk,
          generateBundle,
          transformIndexHtml: {
            order: 'post',
            handler(
              _html: string,
              context: { path: string; chunk?: { fileName: string } }
            ) {
              const renderScript =
                context.chunk && startupScripts.get(context.chunk.fileName);
              return renderScript
                ? [
                    {
                      tag: 'script',
                      children: renderScript(getPageBase(base, context.path)),
                      injectTo: 'head-prepend',
                    },
                  ]
                : undefined;
            },
          },
        },
      },
      {
        // After the plugins that write dynamic imports, such as Vite's glob imports
        name: '@generaltranslation/GT_PLUGIN:chunk-translations',
        enforce: 'post',
        vite: {
          options: readBundlerOptions,
          generateBundle: nameImportedChunks,
        },
        transformInclude(id: string) {
          return !isDependency(id);
        },
        async transform(code: string, id: string) {
          if (!isProduction() || !code.includes('import(')) return null;
          // A module that cannot reach gt-react keeps its imports as they are
          const { resolve } = this as unknown as {
            resolve?: (source: string, importer: string) => Promise<unknown>;
          };
          if (
            resolve &&
            !(await resolve.call(this, CHUNK_TRANSLATIONS_SOURCE, id))
          ) {
            return null;
          }
          return (wrapDynamicImports(code, id, chunkTranslations.naming) ??
            null) as never;
        },
      },
    ] as UnpluginOptions[];
  }
);

// Export the unplugin with different bundler integrations
export default gtUnplugin;
export const webpack = gtUnplugin.webpack;
export const vite = gtUnplugin.vite;
export const rollup = gtUnplugin.rollup;
export const rspack = gtUnplugin.rspack;
export const esbuild = gtUnplugin.esbuild;
