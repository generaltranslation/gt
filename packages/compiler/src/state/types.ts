// Core modules
import type * as t from '@babel/types';
import { StringCollector } from './StringCollector';
import { PluginSettings } from '../config';
import { Logger } from './Logger';
import { ErrorTracker } from './ErrorTracker';
import { ScopeTracker } from './ScopeTracker';
import type { StaticRuntimeFile } from '../transform/static-runtime/staticRuntimeModule';
/**
 * Plugin state for processing files
 * Matches the Rust TransformVisitor structure
 */
export interface TransformState {
  settings: PluginSettings;
  stringCollector: StringCollector;
  scopeTracker: ScopeTracker;
  logger: Logger;
  errorTracker: ErrorTracker;
  statistics: {
    jsxElementCount: number;
    dynamicContentViolations: number;
    macroExpansionsCount: number;
    jsxInsertionsCount: number;
    runtimeTranslateCount: number;
    unstableHashInjectionsCount: number;
    /** Call sites whose source content was replaced with a translation */
    sourceReplacementsCount: number;
    /** Call sites with a translation that kept their source content */
    sourceReplacementFallbacksCount: number;
  };
  /** Translation component calls the injection pass is inside of */
  openTranslationCalls?: Set<t.CallExpression>;
  /** <T> calls to replace with their translations once their children are injected */
  sourceReplacementsOnExit?: Map<t.CallExpression, () => void>;
  /** <T> calls to precompute once their children are injected */
  precomputedJsxOnExit?: Map<t.CallExpression, () => void>;
  /** Source and name of a precomputed component, as JSON, to its local name */
  precomputedJsxImports?: Map<string, string>;
  /** Module-scope declarations of the source children of precomputed <T> calls */
  precomputedJsxSources?: t.VariableDeclaration[];
  /** JSX runtime source to the local name source replacement imports its Fragment as */
  sourceReplacementImports?: Map<string, string>;
  /** What this file needs from the static runtime; set in static-runtime builds. */
  staticRuntime?: StaticRuntimeFile;
  /** Hash to local import name; set only when this file imports message modules. */
  inlineTranslationsImports?: Map<string, string>;
  /** Debug: shared manifest map for hash → jsxChildren mapping (accumulated across files) */
  debugManifest?: Map<string, unknown>;
}
