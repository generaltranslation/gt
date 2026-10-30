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
  /** Entries of this module for the locale twins pass (call site markers) */
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
    /** 1 when the locale twins pass ran on the module (its GT import supports it) */
    localeTwinModulesCount: number;
    /** Locale twin placeholders inserted (client production builds) */
    localeTwinPlaceholdersCount: number;
    /** Source markers (`0`) inserted on unattributed entries */
    localeTwinSourceMarkersCount: number;
  };
  /** Debug: shared manifest map for hash → jsxChildren mapping (accumulated across files) */
  debugManifest?: Map<string, unknown>;
}
