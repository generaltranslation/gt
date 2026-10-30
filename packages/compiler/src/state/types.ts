// Core modules
import { StringCollector } from './StringCollector';
import { PluginSettings } from '../config';
import { Logger } from './Logger';
import { ErrorTracker } from './ErrorTracker';
import { ScopeTracker } from './ScopeTracker';
import type { EntryObserver } from './EntryObserver';
/**
 * Plugin state for processing files
 * Matches the Rust TransformVisitor structure
 */
export interface TransformState {
  settings: PluginSettings;
  stringCollector: StringCollector;
  /** Observes the module's entries for a build extension, if any */
  entryObserver?: EntryObserver;
  scopeTracker: ScopeTracker;
  logger: Logger;
  errorTracker: ErrorTracker;
  statistics: {
    jsxElementCount: number;
    dynamicContentViolations: number;
    macroExpansionsCount: number;
    jsxInsertionsCount: number;
    runtimeTranslateCount: number;
  };
  /** Debug: shared manifest map for hash → jsxChildren mapping (accumulated across files) */
  debugManifest?: Map<string, unknown>;
}
