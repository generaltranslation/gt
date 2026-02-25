import { ParsingConfigOptions } from '../../../../types/parsing.js';
import { Updates } from '../../../../types/index.js';

/**
 * Immutable configuration options for string parsing.
 */
export type ParsingConfig = {
  parsingOptions: ParsingConfigOptions;
  file: string;
  ignoreAdditionalData: boolean;
  ignoreDynamicContent: boolean;
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
