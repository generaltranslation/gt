import { createUnplugin } from 'unplugin';
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
import { macroExpansionPass } from './passes/macroExpansionPass';
import { handleErrors, InvalidLibraryUsageError } from './passes/handleErrors';
import { initializeState } from './state/utils/initializeState';
import {
  getInlineTranslationsFiles,
  loadInlineTranslations,
} from './transform/injection/inline-translations/loadInlineTranslations';
import {
  INLINE_TRANSLATIONS_MODULE_IMPORT_PREFIX,
  INLINE_TRANSLATIONS_VIRTUAL_MODULE_PREFIX,
  getInlineTranslationsModuleFile,
  parseInlineTranslationsVirtualModuleId,
  renderInlineTranslationsModule,
  renderInlineTranslationsModules,
  writeInlineTranslationsModules,
} from './transform/injection/inline-translations/inlineTranslationsModules';
import {
  createInlineTranslationsModulesWriteError,
  resolveInlineTranslationsModules,
} from './transform/injection/inline-translations/resolveInlineTranslationsModules';
import {
  addInlineTranslationsImports,
  isEsModule,
} from './transform/injection/inline-translations/addInlineTranslationsImports';
import { addInlineTranslationsCacheVersion } from './transform/injection/inline-translations/inlineTranslationsCacheVersion';
import {
  applyStaticLocale,
  getStaticLocale,
  getStaticLocaleWarning,
  resolveStaticLocale,
} from './transform/injection/inline-translations/resolveStaticLocale';
import {
  getReplaceSource,
  REPLACE_SOURCE_WITHOUT_STATIC_LOCALE_ERROR,
  resolveSourceReplacement,
} from './transform/injection/inline-translations/resolveSourceReplacement';
import { addFragmentImports } from './transform/injection/inline-translations/replaceJsxSource';
import { Logger } from './state/Logger';
import { jsxInsertionPass } from './passes/jsxInsertionPass';
import { runtimeTranslatePass } from './passes/runtimeTranslatePass';
import {
  importsUnstableSource,
  unstableHashInjectionPass,
} from './passes/unstableHashInjectionPass';

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

const INLINE_TRANSLATIONS_WITHOUT_COMPILE_TIME_HASH_ERROR =
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened:
      'files.gt.inlineTranslations is set, but compileTimeHash is false',
    why: 'translations are only embedded where hashes are computed at build time, and msgOutput files leave out the translations that would be embedded',
    fix: 'Remove compileTimeHash: false, or remove files.gt.inlineTranslations from gt.config.json',
  });

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
    options.files !== undefined ||
    options.customMapping !== undefined ||
    options.localeMatcher !== undefined
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
    ...(options.customMapping !== undefined
      ? { customMapping: options.customMapping }
      : {}),
    ...(options.localeMatcher !== undefined
      ? { localeMatcher: options.localeMatcher }
      : {}),
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
    const staticLocale = getStaticLocale(options.experimentalStaticLocale);
    const staticLocaleResolution = staticLocale
      ? resolveStaticLocale(staticLocale, loadedGTConfig)
      : undefined;
    const gtConfig = staticLocaleResolution
      ? applyStaticLocale(loadedGTConfig, staticLocaleResolution)
      : loadedGTConfig;
    const replaceSource = getReplaceSource(options.experimentalReplaceSource);
    const sourceReplacement = resolveSourceReplacement(
      replaceSource,
      staticLocaleResolution,
      loadedGTConfig
    );
    const sourceReplacementTotals = { replaced: 0, kept: 0 };
    const resolvedOptions: GTUnpluginOptions = {
      ...options,
      ...(gtConfig ? { gtConfig } : {}),
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
      const staticLocaleWarning =
        staticLocale && staticLocaleResolution
          ? getStaticLocaleWarning(
              staticLocale,
              staticLocaleResolution,
              loadedGTConfig
            )
          : undefined;
      if (staticLocaleWarning) console.warn(staticLocaleWarning);
    }

    // Debug manifest: accumulates hash → jsxChildren across all files
    const debugManifest = resolvedOptions._debugHashManifest
      ? new Map<string, unknown>()
      : undefined;

    const gtFiles = resolvedOptions.gtConfig?.files?.gt;
    // Vite's build() sets NODE_ENV after plugins are created, so read it when each hook runs, as transforms do
    const isProduction = () => process.env.NODE_ENV === 'production';
    const inlineTranslationsModules = resolveInlineTranslationsModules(
      gtFiles,
      {
        framework: meta.framework,
        warn: isProduction() && shouldWarn(options.logLevel),
        staticLocale:
          staticLocaleResolution?.kind === 'embedded'
            ? staticLocaleResolution.locale
            : undefined,
      }
    );
    // Only the modules buildStart wrote, so source files inside modulesDir are still transformed
    let messageModuleFiles = new Set<string>();
    const loadModulesTable = () =>
      isProduction() ? loadInlineTranslations(gtFiles) : undefined;

    const keyCacheOnInlineTranslations = (options: {
      cache?: unknown;
      experiments?: { cache?: unknown };
    }) => {
      if (isProduction() && loadedGTConfig?.files?.gt?.inlineTranslations) {
        addInlineTranslationsCacheVersion(
          options,
          gtFiles,
          inlineTranslationsModules,
          sourceReplacement
        );
      }
    };

    return {
      name: '@generaltranslation/GT_PLUGIN',
      webpack(compiler) {
        keyCacheOnInlineTranslations(compiler.options);
      },
      rspack(compiler) {
        keyCacheOnInlineTranslations(compiler.options);
      },
      buildStart() {
        if (
          isProduction() &&
          resolvedOptions.compileTimeHash === false &&
          gtFiles?.inlineTranslations?.locales.length
        ) {
          throw new Error(INLINE_TRANSLATIONS_WITHOUT_COMPILE_TIME_HASH_ERROR);
        }
        if (isProduction() && replaceSource && !staticLocale) {
          throw new Error(REPLACE_SOURCE_WITHOUT_STATIC_LOCALE_ERROR);
        }
        if (
          inlineTranslationsModules?.mode !== 'physical' ||
          !isProduction() ||
          // Embeds nothing, and must not delete the modules other builds share
          (staticLocaleResolution && staticLocaleResolution.kind !== 'embedded')
        ) {
          return;
        }
        const modules = renderInlineTranslationsModules(loadModulesTable());
        try {
          writeInlineTranslationsModules(
            inlineTranslationsModules.dir,
            modules
          );
        } catch (error) {
          throw new Error(
            createInlineTranslationsModulesWriteError(
              inlineTranslationsModules.dir,
              error
            )
          );
        }
        messageModuleFiles = new Set(
          Array.from(modules.keys(), (hash) =>
            getInlineTranslationsModuleFile(inlineTranslationsModules.dir, hash)
          )
        );
      },
      resolveId(id: string) {
        if (
          inlineTranslationsModules?.mode !== 'virtual' ||
          id.startsWith('\0') ||
          parseInlineTranslationsVirtualModuleId(id) === undefined
        ) {
          return null;
        }
        return `\0${id}`;
      },
      loadInclude(id: string) {
        return (
          inlineTranslationsModules?.mode === 'virtual' &&
          parseInlineTranslationsVirtualModuleId(id) !== undefined
        );
      },
      load(id: string) {
        if (inlineTranslationsModules?.mode !== 'virtual') return null;
        const hash = parseInlineTranslationsVirtualModuleId(id);
        if (hash === undefined) return null;
        for (const file of getInlineTranslationsFiles(gtFiles)) {
          this.addWatchFile(file);
        }
        const table = loadModulesTable();
        return {
          code:
            (table && renderInlineTranslationsModule(table, hash)) ??
            'export default () => undefined;\n',
          moduleSideEffects: false,
        };
      },
      transformInclude(id: string) {
        if (
          id.includes(INLINE_TRANSLATIONS_VIRTUAL_MODULE_PREFIX) ||
          messageModuleFiles.has(id.split('?')[0])
        ) {
          return false;
        }
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
        const state = initializeState(resolvedOptions, id, sourceReplacement);
        if (debugManifest) state.debugManifest = debugManifest;
        // webpack does not track files read outside the loader
        if (isProduction()) {
          for (const file of getInlineTranslationsFiles(
            resolvedOptions.gtConfig?.files?.gt
          )) {
            this.addWatchFile(file);
          }
        }
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

          if (
            inlineTranslationsModules &&
            state.settings.inlineTranslationsTable &&
            isEsModule(ast.program) &&
            // Generated import names could clash with the file's own bindings
            !code.includes(INLINE_TRANSLATIONS_MODULE_IMPORT_PREFIX)
          ) {
            state.inlineTranslationsImports = new Map();
          }

          if (injectionRan) {
            traverse(ast, injectionPass(state));
          }

          // Pass 4b: $_hash injection for unstable tagged templates
          if (state.settings.compileTimeHash && importsUnstableSource(ast)) {
            traverse(ast, unstableHashInjectionPass(state));
          }

          if (state.sourceReplacementImports?.size) {
            addFragmentImports(ast.program, state.sourceReplacementImports);
          }
          sourceReplacementTotals.replaced +=
            state.statistics.sourceReplacementsCount;
          sourceReplacementTotals.kept +=
            state.statistics.sourceReplacementFallbacksCount;

          if (
            inlineTranslationsModules &&
            state.inlineTranslationsImports?.size
          ) {
            addInlineTranslationsImports(
              ast.program,
              state.inlineTranslationsImports,
              inlineTranslationsModules,
              id
            );
          }

          // Pass 5: Runtime translate (dev hot reload)
          const devHotReloadActive =
            state.settings.devHotReload.strings ||
            state.settings.devHotReload.jsx;
          if (devHotReloadActive && hasCollectionContent) {
            traverse(ast, runtimeTranslatePass(state));
          }

          // Generate code if any pass modified the AST
          if (
            !injectionRan &&
            state.statistics.macroExpansionsCount === 0 &&
            state.statistics.jsxInsertionsCount === 0 &&
            state.statistics.runtimeTranslateCount === 0 &&
            state.statistics.unstableHashInjectionsCount === 0
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
        if (sourceReplacement && options.logLevel === 'debug') {
          new Logger(options.logLevel).logDebug(
            `Replaced the source content of ${sourceReplacementTotals.replaced} call sites with their "${sourceReplacement.locale}" translations; ${sourceReplacementTotals.kept} call sites kept their source and embedded translation`
          );
        }
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
  }
);

// Export the unplugin with different bundler integrations
export default gtUnplugin;
export const webpack = gtUnplugin.webpack;
export const vite = gtUnplugin.vite;
export const rollup = gtUnplugin.rollup;
export const rspack = gtUnplugin.rspack;
export const esbuild = gtUnplugin.esbuild;
export {
  loadInlineTranslations,
  readTranslationsFile,
  resolveInlineTranslationsFiles,
} from './transform/injection/inline-translations/loadInlineTranslations';
export {
  renderInlineTranslationsModules,
  resolveInlineTranslationsModulesDir,
  writeInlineTranslationsModules,
} from './transform/injection/inline-translations/inlineTranslationsModules';
