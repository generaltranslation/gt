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
  /**
   * If true, will ignore registration of list content
   * eg msg(['hello', 'world', 'foo', 'bar']) will not be registered
   */
  ignoreInlineListContent: boolean;
  /**
   * If true, include surrounding source code lines as context for translations
   */
  includeSourceCodeContext?: boolean;
  /**
   * If true, ignore tagged template expressions (e.g., t`hello ${name}`)
   */
  ignoreTaggedTemplates: boolean;
  /**
   * If true, ignore global tagged template expressions (t`hello` without import)
   */
  ignoreGlobalTaggedTemplates: boolean;
  /**
   * Skip requirement for a derive() invocation to trigger derivation
   * - ENABLED: Always auto-derive
   * - DISABLED: Never auto-derive
   * - AUTO: Only auto-derive for the t() function
   */
  enableAutoDerive: 'ENABLED' | 'DISABLED' | 'AUTO';
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
