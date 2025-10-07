import { createUnplugin } from 'unplugin';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';

// Core modules
import { StringCollector } from './state/StringCollector';
import { ImportTracker } from './state/ImportTracker';
import { PluginConfig, PluginSettings } from './state/config';
import { Logger } from './state/Logger';

// Import transformation functions
import { performSecondPassTransformation } from './transform/transform';
import { TransformState } from './state/types';
import { processCallExpression } from './processing/first-pass/processCallExpression';
import { ErrorTracker } from './state/ErrorTracker';
import { basePass } from './passes/basePass';
import { checkForErrors } from './passes/checkForErrors';
import { processVariableDeclarator } from './processing/first-pass/processVariableDeclarator';

/**
 * TODO:
 * - Add tracking for special identifiers: undefined, Nan, etc.
 * - Add tracking for multiple namespaces (Required for handling React.Fragment)
 * - Whitespace handling
 * - For errors log the location of the error
 *
 * DONE:
 * - Add override tracking for classes
 * - Add tracking for Fragment component
 * - Add override tracking for assignment expressions let t = useGT(); t = undefined;
 * - Add override tracking for forLoop declaration (specifically: let gt of items; let gt in obj)
 * - Add override tracking for catch clause declaration
 * - Add override tracking for method declarations
 * - Add override tracking for parameter declarations
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
 *
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
        try {
          // Initialize processing state
          const state = initializeState(options, id);

          // Skip transformation if not needed
          if (
            state.settings.disableBuildChecks &&
            !state.settings.compileTimeHash
          ) {
            return null;
          }

          if (id.endsWith('page.tsx')) {
            console.log('[GT_PLUGIN] ===============================');
            console.log('[GT_PLUGIN]         PASS 1');
            console.log('[GT_PLUGIN] ===============================');
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
            CallExpression: processCallExpression(state),
            // let T = ...
            VariableDeclarator: processVariableDeclarator(state),
          });

          // Check for errors
          checkForErrors(state);

          // PASS 2: Transformation phase - apply collected data to generate hashes and content arrays
          const hasTransformations = true; // TODO: calculate this
          if (state.settings.compileTimeHash) {
            performSecondPassTransformation(ast, state);
          }

          // Generate code if transformations were made
          if (hasTransformations) {
            // Validate AST before generation
            try {
              const result = generate(ast, {
                retainLines: true,
                compact: false,
              });
              return {
                code: result.code,
                map: result.map,
              };
            } catch (generateError) {
              if (id.endsWith('page.tsx')) {
                console.error(
                  '[GT Unplugin] Code generation error:',
                  generateError
                );
              }
              // Return original code on generation error
              return null;
            }
          }

          // No transformations needed
          return null;
        } catch (error) {
          if (id.endsWith('page.tsx')) {
            console.error(`[GT Unplugin] Error processing ${id}:`, error);
          }
          // Return original code on error
          return null;
        }
      },
    };
  }
);

/**
 * Initialize processing state for a file
 */
function initializeState(
  options: GTUnpluginOptions,
  filename: string
): TransformState {
  const settings: PluginSettings = {
    logLevel: options.logLevel || 'warn',
    compileTimeHash: options.compileTimeHash || false,
    disableBuildChecks: options.disableBuildChecks || false,
    filename: filename,
  };

  return {
    settings,
    stringCollector: new StringCollector(),
    importTracker: new ImportTracker(),
    logger: new Logger(settings.logLevel),
    errorTracker: new ErrorTracker(),
    statistics: {
      jsxElementCount: 0,
      dynamicContentViolations: 0,
    },
  };
}

// Export the unplugin with different bundler integrations
export default gtUnplugin;
export const webpack = gtUnplugin.webpack;
export const vite = gtUnplugin.vite;
export const rollup = gtUnplugin.rollup;
export const esbuild = gtUnplugin.esbuild;
