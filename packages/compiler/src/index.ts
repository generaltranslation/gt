import { createUnplugin } from 'unplugin';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';

// Core modules
import { PluginConfig } from './config';

// Import transformation functions
import { processCallExpression as processCallExpressionFirstPass } from './processing/first-pass/processCallExpression';
import { processCallExpression as processCallExpressionSecondPass } from './processing/second-pass/processCallExpression';
import { basePass } from './passes/basePass';
import { handleErrors } from './passes/handleErrors';
import { processVariableDeclarator as processVariableDeclaratorFirstPass } from './processing/first-pass/processVariableDeclarator';
import { processVariableDeclarator as processVariableDeclaratorSecondPass } from './processing/second-pass/processVariableDeclarator';
import { InvalidLibraryUsageError } from './passes/handleErrors';
import { initializeState } from './state/utils/initializeState';

/**
 *
 * First Pass:
 * - Collect + calculate all data
 * - Check for violations
 * - "Register" - collect data to inject
 * - "Track" - track a function call/variable assignment
 *
 * Second Pass:
 * - Inject all data
 *
 * Architecture:
 *
 * Babel functions:
 * - 1-to-1 relationship with processing functions
 * - Handle (1) enter/exit scope (2) invoking processing function
 * - ex) JSXElement()
 *
 * Processing functions:
 * - Are dependent on the pass, so they have three categories: (1) first pass, (2) second pass, (3) shared/general
 * - Invoke transformation functions and utility functions
 * - ex) processJSXElement()
 * - Has the following file structure:
 * + processing
 * | sharedProcessingFunction.ts
 * | + first-pass
 * | | firstPassProcessingFunction.ts
 * | + second-pass
 * | | secondPassProcessingFunction.ts
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
 *
 * First pass: construct all information. no replacements, lest we lose our the monkey patching
 * Second pass: inject all information (hashes, messages, etc.)
 */
const gtUnplugin = createUnplugin<GTUnpluginOptions | undefined>(
  (options = {}) => {
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
        const state = initializeState(options, id);
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

          // PASS 1: Collection phase - collect translation data without transforming
          traverse(ast, {
            // Base configuration
            ...basePass(state),
            // const gt = useGT();
            CallExpression: processCallExpressionFirstPass(state),
            // let T = ...
            VariableDeclarator: processVariableDeclaratorFirstPass(state),
          });

          // Handle errors
          if (handleErrors(state)) {
            return null;
          }

          // PASS 2: Transformation phase - apply collected data to generate hashes and content arrays
          if (!state.stringCollector.hasContent()) {
            return null;
          }

          // Complete second-pass traversal matching Rust Fold trait
          traverse(ast, {
            ...basePass(state),
            // const gt = useGT();
            CallExpression: processCallExpressionSecondPass(state),
            // let T = ...
            VariableDeclarator: processVariableDeclaratorSecondPass(state),
          });

          // Generate code
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
    };
  }
);

// Export the unplugin with different bundler integrations
export default gtUnplugin;
export const webpack = gtUnplugin.webpack;
export const vite = gtUnplugin.vite;
export const rollup = gtUnplugin.rollup;
export const esbuild = gtUnplugin.esbuild;
