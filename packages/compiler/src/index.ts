import { createUnplugin } from 'unplugin';
import fs from 'node:fs';
import path from 'node:path';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';

// Core modules
import { GTConfig, PluginConfig } from './config';

// Import passes
import { collectionPass } from './passes/collectionPass';
import { injectionPass } from './passes/injectionPass';
import { macroExpansionPass } from './passes/macroExpansionPass';
import { handleErrors, InvalidLibraryUsageError } from './passes/handleErrors';
import { initializeState } from './state/utils/initializeState';
import { jsxInsertionPass } from './passes/jsxInsertionPass';
import { runtimeTranslatePass } from './passes/runtimeTranslatePass';

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

    return {
      name: '@generaltranslation/GT_PLUGIN',
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
        const state = initializeState(resolvedOptions, id);
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
            state.statistics.runtimeTranslateCount === 0
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
  }
);

// Export the unplugin with different bundler integrations
export default gtUnplugin;
export const webpack = gtUnplugin.webpack;
export const vite = gtUnplugin.vite;
export const rollup = gtUnplugin.rollup;
export const rspack = gtUnplugin.rspack;
export const esbuild = gtUnplugin.esbuild;
