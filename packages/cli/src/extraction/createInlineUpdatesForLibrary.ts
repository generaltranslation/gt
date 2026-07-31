import type { ParsingConfigOptions, GTParsingFlags } from '../types/parsing.js';
import type { InlineLibrary } from '../types/libraries.js';
import { Libraries } from '../types/libraries.js';
import { createInlineUpdates } from '../react/parse/createInlineUpdates.js';
import { createVueInlineUpdates } from '../vue/parse/createVueInlineUpdates.js';

export function createInlineUpdatesForLibrary(
  pkg: InlineLibrary,
  validate: boolean,
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions
) {
  if (pkg === Libraries.GT_VUE) {
    // Vue extraction is source-local and does not use the React package
    // resolver's conditionNames from parsingOptions.
    return createVueInlineUpdates(filePatterns, parsingFlags);
  }
  return createInlineUpdates(
    pkg,
    validate,
    filePatterns,
    parsingFlags,
    parsingOptions
  );
}
