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
  type ChunkImportMap,
} from './transform/chunk-translations/chunkImportMap';
import {
  CHUNK_TRANSLATIONS_SOURCE,
  UNSPLIT_LOADER_PLACEHOLDER,
  getChunkTranslations,
  getMinifyHashes,
  getChunkTranslationsNaming,
  getChunkTranslationsSplit,
  getRegionSplit,
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
  createConservativeSplitMessage,
  createMissingPreviousWarning,
  writeRegionTranslations,
} from './transform/chunk-translations/writeRegionTranslations';
import {
  initialisesModulesLazily,
  type RegionModuleInfo,
} from './transform/chunk-translations/createRegionGraph';
import {
  createRuntimeHashesWarning,
  minifyChunk,
} from './transform/chunk-translations/hashMinification';
import {
  createUnsplitTranslationsMessage,
  getUnsplitTranslations,
  replaceUnsplitLoader,
} from './transform/chunk-translations/unsplitTranslations';
import { getPageBase } from './transform/chunk-translations/startupScript';
import {
  generateReplacementsMap,
  moveChunkMap,
  trackReplacements,
  type BundledChunk,
} from './transform/chunk-translations/chunkSourceMap';
import { Logger } from './state/Logger';
import {
  getSourceMapRequest,
  type ViteSourceMapConfig,
} from './utils/sourceMapRequest';
import { jsxInsertionPass } from './passes/jsxInsertionPass';
import {
  createPrecomputedMessageSupport,
  createRuntimeNotFoundWarning,
  PRECOMPUTED_MESSAGES_UNSUPPORTED_WARNING,
} from './transform/injection/precomputedMessageSupport';
import { runtimeTranslatePass } from './passes/runtimeTranslatePass';
import {
  createUnreadJsxImportSourceWarning,
  findUnreadJsxImportSources,
} from './utils/constants/react/jsxImportSources';
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
    const splitTranslations = options.experimentalSplitTranslations;
    const resolveChunkTranslationsOptions = () => {
      const split = getChunkTranslationsSplit(splitTranslations?.by);
      return resolveChunkTranslations(loadedGTConfig, {
        framework: meta.framework,
        compileTimeHash: options.compileTimeHash !== false,
        naming: getChunkTranslationsNaming(splitTranslations?.naming, split),
        regions: getRegionSplit(split, {
          requestCost: splitTranslations?.requestCost,
          previous: splitTranslations?.previous,
        }),
        minifyHashes: getMinifyHashes(splitTranslations?.minifyHashes),
      });
    };
    const chunkTranslationsResolution = getChunkTranslations(splitTranslations)
      ? resolveChunkTranslationsOptions()
      : undefined;
    const chunkTranslations =
      chunkTranslationsResolution && !('error' in chunkTranslationsResolution)
        ? chunkTranslationsResolution
        : undefined;
    const resolvedOptions: GTUnpluginOptions = {
      ...options,
      ...(loadedGTConfig ? { gtConfig: loadedGTConfig } : {}),
    };
    const findPrecomputedMessageSupport = createPrecomputedMessageSupport();
    // Each said once per build
    const warnedOfRuntime = { older: false, missing: false };
    const warnedOfJsxImportSources = new Set<string>();
    /**
     * Whether a file's messages are precomputed when the option is left out:
     * only when the GT runtime the file resolves is known to read them.
     */
    const precomputesMessages = (id: string): boolean => {
      const directory = path.dirname(id);
      const support = findPrecomputedMessageSupport(directory);
      if (support === true) return true;
      const reason = support === false ? 'older' : 'missing';
      if (!warnedOfRuntime[reason]) {
        warnedOfRuntime[reason] = true;
        if (shouldWarn(options.logLevel)) {
          console.warn(
            support === false
              ? PRECOMPUTED_MESSAGES_UNSUPPORTED_WARNING
              : createRuntimeNotFoundWarning(directory)
          );
        }
      }
      return false;
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
    let viteConfig: ViteSourceMapConfig | undefined;
    const keepViteConfig = (config: ViteSourceMapConfig) => {
      viteConfig = config;
    };

    const plugin: UnpluginOptions = {
      name: '@generaltranslation/GT_PLUGIN',
      vite: { configResolved: keepViteConfig },
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

          if (shouldWarn(options.logLevel)) {
            for (const source of findUnreadJsxImportSources(
              ast.program,
              state.settings
            )) {
              if (warnedOfJsxImportSources.has(source)) continue;
              warnedOfJsxImportSources.add(source);
              console.warn(createUnreadJsxImportSourceWarning(source, id));
            }
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
            traverse(
              ast,
              taggedTemplateHashInjectionPass(
                state,
                resolvedOptions.precomputeMessages === undefined
                  ? () => precomputesMessages(id)
                  : undefined
              )
            );
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

          const sourceMap = getSourceMapRequest(
            meta.framework,
            this,
            viteConfig,
            code,
            id
          );
          const output = generate(
            ast,
            {
              retainLines: true,
              compact: false,
              ...(sourceMap && {
                sourceMaps: true,
                sourceFileName: id,
                inputSourceMap: sourceMap.inputSourceMap,
              }),
            },
            code
          );
          return { code: output.code, map: output.map };
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
    // The chunk import map the last build wrote its lists with, and the
    // names those lists hold the imported chunks under
    let importMap: ChunkImportMap | undefined;
    let importedNames: ChunkImportMap | undefined;
    // Where the build's files are served from and its assets go: Vite's `base` and `build.assetsDir`
    let base = '';
    let assetsDir = '';
    // What the bundler's `options` and `outputOptions` hooks received, which
    // say when a module runs; `generateBundle` gets options that do not
    let inputOptions: Parameters<typeof initialisesModulesLazily>[1] = {};
    let outputOptions: Parameters<typeof initialisesModulesLazily>[0] = {};
    const { regions } = chunkTranslations;
    const keepOptions = regions && {
      options(received: typeof inputOptions) {
        inputOptions = received ?? {};
        return null;
      },
      outputOptions(received: typeof outputOptions) {
        outputOptions = received ?? {};
        return null;
      },
    };
    function writeRegions(
      context: {
        emitFile: (file: never) => unknown;
        getModuleInfo: (id: string) => RegionModuleInfo | null;
      },
      bundle: Record<string, { type: string }>
    ) {
      const written = writeRegionTranslations(
        bundle,
        { ...chunkTranslations!, regions: regions! },
        {
          gtFiles: gtFiles!,
          base,
          assetsDir,
          emitFile: (file) => context.emitFile(file as never),
          getModuleInfo: (id) => context.getModuleInfo(id),
          isLazy: initialisesModulesLazily(outputOptions, inputOptions),
        }
      );
      if (shouldWarn(options.logLevel)) {
        if (written.missingPrevious) {
          console.warn(createMissingPreviousWarning(regions!.previous!));
        }
        if (
          written.stats.isConservative &&
          written.stats.conservativeMessages
        ) {
          console.warn(
            createConservativeSplitMessage(written.stats.conservativeMessages)
          );
        }
      }
      if (options.logLevel === 'debug') {
        const {
          loads,
          regions: count,
          files,
          comparisons,
          startupMessages,
          startupBytes,
          entryMessages,
          entryBytes,
        } = written.stats;
        new Logger(options.logLevel).logDebug(
          `Split the chunk translations by module: ${loads} entries and dynamic imports, ${count} groups of messages that the same ones need, ${files} files after ${comparisons} comparisons. The files every page requests as it starts hold ${startupMessages} messages (${startupBytes} B), of which the entries read ${entryMessages} (${entryBytes} B). Replayed every entry and import against those files: each holds every message it reads`
        );
      }
      return written;
    }
    function generateBundle(
      this: {
        emitFile: (file: never) => unknown;
        getModuleInfo: (id: string) => RegionModuleInfo | null;
      },
      _outputOptions: unknown,
      bundle: Record<string, { type: string }>
    ): void {
      if (!isProduction()) return;
      const written = regions
        ? writeRegions(this, bundle)
        : writeChunkTranslations(bundle, chunkTranslations!, {
            gtFiles: gtFiles!,
            base,
            assetsDir,
            emitFile: (file) => this.emitFile(file as never),
          });
      startupScripts = written.startupScripts;
      imported = written.imported;
      isLoadedWith = written.isLoadedWith;
      importMap = written.importMap;
      importedNames = written.importedNames;
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
      const unknownReaders = chunkTranslations!.runtimeReaders?.unknown;
      if (unknownReaders?.size) {
        console.warn(
          createRuntimeHashesWarning(
            [...unknownReaders]
              .map((file) => path.relative(process.cwd(), file))
              .sort()
          )
        );
      }
    }
    // Chunks are rendered once every module is compiled, so every call site is known
    function renderChunk(
      code: string,
      chunk?: { fileName: string },
      rendered?: { sourcemap?: boolean | string }
    ) {
      if (!isProduction()) return null;
      const tracked =
        chunk && rendered?.sourcemap ? trackReplacements(code) : undefined;
      const withMap = (rewritten: string) =>
        chunk && tracked?.replacements
          ? {
              code: rewritten,
              map: generateReplacementsMap(
                code,
                chunk.fileName,
                tracked.replacements
              ),
            }
          : rewritten;
      // Before the chunk is named, so its name follows from its ids
      const minified = chunkTranslations!.minifiedIds
        ? (minifyChunk(
            code,
            chunkTranslations!.minifiedIds,
            tracked?.replace
          ) ?? code)
        : code;
      const passed = passPreloads(minified, tracked?.replace);
      if (!passed.includes(UNSPLIT_LOADER_PLACEHOLDER)) {
        return passed === code ? null : withMap(passed);
      }
      const unsplit = getUnsplitTranslations(
        loadChunkTranslationsTable(gtFiles!, chunkTranslations!),
        chunkTranslations!
      );
      const started = replaceUnsplitLoader(
        passed,
        Object.keys(unsplit).length > 0,
        tracked?.replace
      );
      return started === undefined ? null : withMap(started);
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
            dynamicImports?: string[];
            source?: unknown;
          } & BundledChunk
        >
      ): void {
        if (!isProduction()) return;
        const needsFiles = (target: string) => imported.has(target);
        // The import map is not read from the bundle again: a plugin may
        // have rewritten it since the lists were written, and what is
        // written at an import must be a name the lists know its chunk by
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
          // The chunk is minified by now, so a replacement moves the rest of its line
          const tracked = chunk.map ? trackReplacements(chunk.code) : undefined;
          const replaced = replaceImportedChunks(
            source,
            needsFiles,
            importMap,
            importedNames,
            tracked?.replace
          );
          if (replaced.code !== chunk.code) {
            chunk.code = replaced.code;
            if (tracked?.replacements) {
              moveChunkMap(bundle, chunk, source.code, tracked.replacements);
            }
          }
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
          configResolved(
            config: ViteSourceMapConfig & {
              base: string;
              build: { assetsDir: string };
            }
          ) {
            keepViteConfig(config);
            base = config.base;
            assetsDir = config.build.assetsDir;
          },
          ...keepOptions,
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
          return (wrapDynamicImports(
            code,
            id,
            chunkTranslations.naming,
            regions !== undefined,
            chunkTranslations.minifiedIds !== undefined
          ) ?? null) as never;
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
