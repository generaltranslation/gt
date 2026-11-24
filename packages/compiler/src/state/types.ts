// Core modules
import { StringCollector } from './StringCollector';
import { PluginSettings } from '../config/pluginConfig';
import { Logger } from './Logger';
import { ErrorTracker } from './ErrorTracker';
import { ScopeTracker } from './ScopeTracker';
import type { ChunkTranslationsFile } from '../transform/chunk-translations/chunkTranslationsModule';
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
    jsxInsertionsCount: number;
    runtimeTranslateCount: number;
    taggedTemplateHashInjectionsCount: number;
  };
  /** What this file imports to read chunk translations; set when it can import it. */
  chunkTranslations?: ChunkTranslationsFile;
  /** Debug: shared manifest map for hash → jsxChildren mapping (accumulated across files) */
  debugManifest?: Map<string, unknown>;
}
