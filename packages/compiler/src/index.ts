import { createUnplugin } from 'unplugin';
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';

// Core modules
import { StringCollector } from './state/StringCollector';
import { ImportTracker } from './state/ImportTracker';
import { PluginConfig, PluginSettings } from './state/config';
import { Logger } from './state/logging';

// Import transformation functions
import { performSecondPassTransformation } from './transform/transform';
import { processImportDeclaration } from './processing/first-pass/processImportDeclaration';
import { TransformState } from './state/types';
import { trackVariableAssignment } from './transform/variableTracking/trackVariableAssignment';
import { trackArrowParameterOverrides } from './transform/variableTracking/trackArrowParameterOverrides';
import { trackParameterOverrides } from './transform/variableTracking/trackParameterOverrides';
import { processCallExpression } from './processing/first-pass/processCallExpression';
import { processJSXElement } from './processing/first-pass/processJSXElement';

/**
 * Architecture:
 *
 * Babel functions:
 * - 1-to-1 relationship with processing functions
 * - Handle (1) enter/exit scope (2) invoking processing function
 *
 * ex) JSXElement()
 *
 * Processing functions:
 * - Are dependent on the pass, so they have three categories: (1) first pass, (2) second pass, (3) shared/general
 * - Invoke transformation functions and utility functions
 * - Has the following file structure:
 *
 * + processing
 * | sharedProcessingFunction.ts
 * | + first-pass
 * | | firstPassProcessingFunction.ts
 * | + second-pass
 * | | secondPassProcessingFunction.ts
 *
 * ex) processJSXElement()
 *
 *
 * Transformation functions:
 * - Are AGNOSTIC to pass number
 * - MUST be stateful in some way
 *
 * ex) trackImportDeclaration()
 *
 * Utility functions:
 * - Are AGNOSTIC to pass number
 * - Are stateless
 *
 * ex) extractIdentifiersFromLVal()
 *
 * State:
 * - Includes classes for tracking state
 *
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
            console.log('[gt-unplugin] ===============================');
            console.log('[gt-unplugin]         PASS 1');
            console.log('[gt-unplugin] ===============================');
          }

          // Parse the code into AST
          const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript', 'decorators-legacy'],
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true,
          });

          // Two-pass transformation system
          // PASS 1: Collection phase - collect translation data without transforming

          traverse(ast, {
            Program: {
              enter(path) {
                // Initialize trackers for this program
                state.importTracker = new ImportTracker();
                state.stringCollector = new StringCollector();
              },
            },

            // Collection phase visitors
            ImportDeclaration(path) {
              processImportDeclaration(path, state);
            },

            VariableDeclarator(path) {
              trackVariableAssignment(path, state);
            },

            CallExpression(path) {
              processCallExpression(path, state); // Collection only, returns boolean but we ignore it
            },

            // JSX processing - matches Rust VisitMut
            JSXElement(path) {
              processJSXElement(path, state); // Collection only, returns boolean but we ignore it
            },

            // Missing JSX visitors from Rust VisitMut
            JSXExpressionContainer(path) {
              // TODO: Implement jsx expression container validation
              // This should check for dynamic content violations in translation components
            },

            JSXAttribute(path) {
              // TODO: Implement jsx attribute context tracking
              // This should track in_jsx_attribute state to avoid false violations
            },

            // Scope management - must match second pass exactly
            BlockStatement: {
              enter(_path) {
                state.importTracker.enterScope();
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },

            Function: {
              enter(path) {
                state.importTracker.enterScope();
                trackParameterOverrides(path, state.importTracker.scopeTracker);
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },

            ArrowFunctionExpression: {
              enter(path) {
                state.importTracker.enterScope();
                trackArrowParameterOverrides(
                  path,
                  state.importTracker.scopeTracker
                );
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },

            // Missing from Rust VisitMut - function expressions
            FunctionExpression: {
              enter(_path) {
                state.importTracker.enterScope();
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },

            ClassDeclaration: {
              enter(_path) {
                state.importTracker.enterScope();
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },

            ForStatement: {
              enter(_path) {
                state.importTracker.enterScope();
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },

            ForInStatement: {
              enter(_path) {
                state.importTracker.enterScope();
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },

            ForOfStatement: {
              enter(_path) {
                state.importTracker.enterScope();
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },

            CatchClause: {
              enter(_path) {
                state.importTracker.enterScope();
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },

            WhileStatement: {
              enter(_path) {
                state.importTracker.enterScope();
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },

            SwitchStatement: {
              enter(_path) {
                state.importTracker.enterScope();
              },
              exit(_path) {
                state.importTracker.exitScope();
              },
            },
          });

          // PASS 2: Transformation phase - apply collected data to generate hashes and content arrays
          let hasTransformations = false;
          if (state.settings.compileTimeHash) {
            hasTransformations = performSecondPassTransformation(ast, state);
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
