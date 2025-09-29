// Core modules
import { StringCollector } from '../visitor/string-collector';
import { ImportTracker } from '../visitor/import-tracker';
import { PluginSettings } from '../config';
import { Logger } from '../logging';
/**
 * Plugin state for processing files
 * Matches the Rust TransformVisitor structure
 */
export interface TransformState {
  settings: PluginSettings;
  stringCollector: StringCollector;
  importTracker: ImportTracker;
  logger: Logger;
  statistics: {
    jsxElementCount: number;
    dynamicContentViolations: number;
  };
}
