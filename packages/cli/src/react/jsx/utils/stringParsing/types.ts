import { Updates } from 'generaltranslation';

/**
 * Immutable configuration options for string parsing.
 */
export type ParsingConfig = {
  file: string;
  /**
   * If true, include surrounding source code lines as context for translations
   */
  includeSourceCodeContext?: boolean;
  /**
   * If true, a tagged-template message that cannot be extracted is an error
   * instead of a warning, as in `gt validate`
   */
  skippedMessagesAreErrors?: boolean;
};

/**
 * Collectors for updates, errors, and warnings.
 */
export type ParsingOutput = {
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
};
