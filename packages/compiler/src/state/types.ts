// Core modules
import { StringCollector } from './StringCollector';
import { ImportTracker } from './ImportTracker';
import { PluginSettings } from './config';
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
