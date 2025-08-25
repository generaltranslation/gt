import { createUnplugin } from 'unplugin';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { hashSource } from 'generaltranslation/id';

// Core modules
import { StringCollector } from './visitor/string-collector';
import { ImportTracker } from './visitor/import-tracker';
import { JsxTraversal } from './ast/traversal';
import { PluginConfig, PluginSettings } from './config';
import { Logger } from './logging';

// Analysis and utilities
import {
  isTranslationComponent,
  isVariableComponent,
  isBranchComponent,
} from './visitor/analysis';
import { createDynamicContentWarning } from './visitor/errors';

/**
 * GT Universal Plugin Options
 */
export interface GTUnpluginOptions extends PluginConfig {
  // Inherits from PluginConfig
}

/**
 * Plugin state for processing files
 */
interface ProcessingState {
  settings: PluginSettings;
  stringCollector: StringCollector;
  importTracker: ImportTracker;
  logger: Logger;
  statistics: {
    jsxElementCount: number;
    dynamicContentViolations: number;
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
    return {
      name: '@generaltranslation/gt-unplugin',
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
          console.log(`[GT Unplugin] Processing: ${id}`);

          // Initialize processing state
          const state = initializeState(options, id);

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

          // Track if any transformations were made
          let hasTransformations = false;

          // Perform AST traversal and transformation
          traverse(ast, {
            Program: {
              enter(path) {
                // Initialize trackers for this program
                state.importTracker = new ImportTracker();
                state.stringCollector = new StringCollector();
              },
              exit(path) {
                // Perform second pass transformation if enabled
                if (state.settings.compileTimeHash) {
                  hasTransformations =
                    performSecondPassTransformation(path, state) ||
                    hasTransformations;
                }
              },
            },

            // Pass 1: Collection phase
            ImportDeclaration(path) {
              processImportDeclaration(path, state);
            },

            VariableDeclarator(path) {
              trackVariableAssignment(path, state);
            },

            CallExpression(path) {
              const result = processCallExpression(path, state);
              hasTransformations = hasTransformations || result;
            },

            JSXElement(path) {
              const result = processJSXElement(path, state);
              hasTransformations = hasTransformations || result;
            },

            // Scope management
            BlockStatement: {
              enter(path) {
                state.importTracker.enterScope();
              },
              exit(path) {
                state.importTracker.exitScope();
              },
            },

            Function: {
              enter(path) {
                state.importTracker.enterScope();
                trackParameterOverrides(path, state);
              },
              exit(path) {
                state.importTracker.exitScope();
              },
            },

            ArrowFunctionExpression: {
              enter(path) {
                state.importTracker.enterScope();
                trackArrowParameterOverrides(path, state);
              },
              exit(path) {
                state.importTracker.exitScope();
              },
            },
          });

          // Generate code if transformations were made
          if (hasTransformations) {
            const result = generate(ast, {
              retainLines: true,
              compact: false,
            });

            console.log(`[GT Unplugin] Transformed: ${id}`);
            return {
              code: result.code,
              map: result.map,
            };
          }

          // No transformations needed
          return null;
        } catch (error) {
          console.error(`[GT Unplugin] Error processing ${id}:`, error);
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
): ProcessingState {
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
    statistics: {
      jsxElementCount: 0,
      dynamicContentViolations: 0,
    },
  };
}

/**
 * Process import declarations to track GT imports
 */
function processImportDeclaration(
  path: any, // Using any for now since babel traverse types are complex
  state: ProcessingState
): void {
  state.importTracker.processGTImportDeclaration(path);
}

/**
 * Track variable assignments like: const t = useGT()
 */
function trackVariableAssignment(path: any, state: ProcessingState): void {
  // PLACEHOLDER - implement based on existing visitor logic
  console.log('trackVariableAssignment called but unimplemented');
}

/**
 * Process call expressions to detect t() calls and useGT/getGT assignments
 */
function processCallExpression(path: any, state: ProcessingState): boolean {
  // PLACEHOLDER - implement based on existing visitor logic
  console.log('processCallExpression called but unimplemented');
  return false;
}

/**
 * Process JSX elements to detect GT components and collect content
 */
function processJSXElement(path: any, state: ProcessingState): boolean {
  // PLACEHOLDER - implement based on existing visitor logic
  console.log('processJSXElement called but unimplemented');
  return false;
}

/**
 * Track function parameter overrides that could shadow variables
 */
function trackParameterOverrides(path: any, state: ProcessingState): void {
  // PLACEHOLDER - implement based on existing visitor logic
  console.log('trackParameterOverrides called but unimplemented');
}

/**
 * Track arrow function parameter overrides
 */
function trackArrowParameterOverrides(path: any, state: ProcessingState): void {
  // PLACEHOLDER - implement based on existing visitor logic
  console.log('trackArrowParameterOverrides called but unimplemented');
}

/**
 * Perform the second pass transformation using collected data
 */
function performSecondPassTransformation(
  path: any,
  state: ProcessingState
): boolean {
  // PLACEHOLDER - implement based on existing visitor logic
  console.log('performSecondPassTransformation called but unimplemented');
  return false;
}

// Export the unplugin with different bundler integrations
export default gtUnplugin;
export const webpack = gtUnplugin.webpack;
export const vite = gtUnplugin.vite;
export const rollup = gtUnplugin.rollup;
export const esbuild = gtUnplugin.esbuild;
