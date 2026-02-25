import { ParsingConfigOptions } from '../../../../types/parsing.js';
import { Updates } from '../../../../types/index.js';

/**
 * Immutable configuration options for string parsing.
 */
export type ParsingConfig = {
  parsingOptions: ParsingConfigOptions;
  file: string;
  /**
   * If true, ignores fields like $context, $id, etc. when extracting metadata from a string entry
   */
  ignoreInlineMetadata: boolean;
  /**
   * If true, dynamic content will not be treated as errors
   */
  ignoreDynamicContent: boolean;
  /**
   * If true, invalid ICU strings will not be treated as errors
   */
  ignoreInvalidIcu: boolean;
};

/**
 * Mutable state for tracking parsing progress.
 */
export type ParsingState = {
  visited: Set<string>;
  importMap: Map<string, string>;
};

/**
 * Collectors for updates, errors, and warnings.
 */
export type ParsingOutput = {
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
};
