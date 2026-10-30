// Core modules
import { StringCollector } from './StringCollector';
import { PluginSettings } from '../config';
import { Logger } from './Logger';
import { ErrorTracker } from './ErrorTracker';
import { ScopeTracker } from './ScopeTracker';
import { LocaleTwinCollector } from './LocaleTwinCollector';
/**
 * Plugin state for processing files
 * Matches the Rust TransformVisitor structure
 */
export interface TransformState {
  settings: PluginSettings;
  stringCollector: StringCollector;
  /** Entries attributed to this module for the locale twins registration call */
  localeTwins: LocaleTwinCollector;
  scopeTracker: ScopeTracker;
  logger: Logger;
  errorTracker: ErrorTracker;
  statistics: {
    jsxElementCount: number;
    dynamicContentViolations: number;
    macroExpansionsCount: number;
    jsxInsertionsCount: number;
    runtimeTranslateCount: number;
    /** Locale twins registration calls inserted (0 or 1 per module) */
    localeTwinRegistrationsCount: number;
    /** Locale twins registrations without a placeholder (0 or 1 per module) */
    localeTwinRuntimeRegistrationsCount: number;
  };
  /** Debug: shared manifest map for hash → jsxChildren mapping (accumulated across files) */
  debugManifest?: Map<string, unknown>;
}
