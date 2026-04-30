import { createUnplugin } from 'unplugin';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';

// Core modules
import { PluginConfig, resolveEnableCrossFileResolution } from './config';

// Import passes
import { collectionPass } from './passes/collectionPass';
import { injectionPass } from './passes/injectionPass';
import { macroExpansionPass } from './passes/macroExpansionPass';
import { handleErrors, InvalidLibraryUsageError } from './passes/handleErrors';
import { initializeState } from './state/utils/initializeState';
import { jsxInsertionPass } from './passes/jsxInsertionPass';
import { runtimeTranslatePass } from './passes/runtimeTranslatePass';
import { createEsbuildResolver } from './utils/resolution/createEsbuildResolver';
import {
  clearResolutionCache,
  createResolutionCache,
  createResolver,
} from './utils/resolution/createResolver';
import { createViteResolver } from './utils/resolution/createViteResolver';
import { createWebpackResolver } from './utils/resolution/createWebpackResolver';
import type { NativeResolver } from './utils/resolution/types';

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
export interface GTUnpluginOptions extends PluginConfig {
  // Inherits from PluginConfig
}

/**
 * GT Universal Plugin - Main entry point
 *
 * Universal plugin for compile-time optimization of GT translation components
 * that works across webpack, Vite, Rollup, and other bundlers.
 */
const gtUnplugin = createUnplugin<GTUnpluginOptions | undefined>(
  (options = {}, meta) => {
    // Debug manifest: accumulates hash → jsxChildren across all files
    const debugManifest = options._debugHashManifest
      ? new Map<string, unknown>()
      : undefined;
    const enableCrossFileResolution = resolveEnableCrossFileResolution(options);
    const resolutionCache = createResolutionCache();
    let webpackResolver: NativeResolver | null = null;
    let esbuildResolver: NativeResolver | null = null;

    return {
      name: '@generaltranslation/GT_PLUGIN',
      ...(enableCrossFileResolution &&
        meta.framework === 'webpack' && {
          webpack(compiler) {
            compiler.hooks.afterResolvers.tap(
              '@generaltranslation/GT_PLUGIN',
              () => {
                webpackResolver = createWebpackResolver(compiler);
              }
            );
          },
        }),
      ...(enableCrossFileResolution &&
        meta.framework === 'esbuild' && {
          esbuild: {
            setup(build) {
              esbuildResolver = createEsbuildResolver(build);
            },
          },
        }),
      transformInclude(id: string) {
        // Only transform TSX and JSX files
        return (
          id.endsWith('.tsx') ||
          id.endsWith('.jsx') ||
          id.endsWith('.ts') ||
          id.endsWith('.js')
        );
      },
      async transform(code: string, id: string) {
        // Initialize processing state
        const state = initializeState(options, id);
        if (debugManifest) state.debugManifest = debugManifest;
        try {
          // Skip transformation if not needed
          if (
            state.settings.disableBuildChecks &&
            !state.settings.compileTimeHash
          ) {
            return null;
          }

          if (state.settings.enableCrossFileResolution) {
            let nativeResolver: NativeResolver | null = null;
            switch (meta.framework) {
              case 'webpack':
                nativeResolver = webpackResolver;
                break;
              case 'esbuild':
                nativeResolver = esbuildResolver;
                break;
              case 'rollup':
              case 'rolldown':
              case 'vite':
                nativeResolver = createViteResolver(this);
                break;
            }

            // The graph builder reads transitive modules directly from disk,
            // so register them with the bundler for watch-mode invalidation.
            if (nativeResolver) {
              const watchFile = this.addWatchFile.bind(this);
              state.resolveImport = await createResolver(
                id,
                nativeResolver,
                resolutionCache,
                watchFile
              );
            }
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

          // Pass 4: Injection
          const hasCollectionContent = state.stringCollector.hasContent();

          if (hasCollectionContent) {
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
            !hasCollectionContent &&
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
      watchChange() {
        clearResolutionCache(resolutionCache);
      },
      buildEnd() {
        clearResolutionCache(resolutionCache);
        if (debugManifest && debugManifest.size > 0) {
          const fs = require('fs');
          const path = require('path');
          const outPath = path.resolve(
            process.cwd(),
            '_gt_debug_hash_manifest.json'
          );
          const manifest = Object.fromEntries(debugManifest);
          fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
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
export const esbuild = gtUnplugin.esbuild;
