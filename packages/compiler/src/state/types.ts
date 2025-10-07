// Core modules
import { StringCollector } from './StringCollector';
import { PluginSettings } from './config';
import { Logger } from './Logger';
import { ErrorTracker } from './ErrorTracker';
import { ScopeTracker } from './ScopeTracker';
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
  };
}
