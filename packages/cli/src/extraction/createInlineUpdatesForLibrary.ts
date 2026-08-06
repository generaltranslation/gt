import type { ParsingConfigOptions, GTParsingFlags } from '../types/parsing.js';
import type { InlineLibrary } from '../types/libraries.js';
import { Libraries } from '../types/libraries.js';
import { createInlineUpdates } from '../react/parse/createInlineUpdates.js';
import { dedupeUpdates } from './postProcess.js';
import { readDefaultInlineSourcePatterns } from './inlineSourceScopes.js';

/**
 * Extracts one framework's inline translations with its package-specific
 * parser. The Vue adapter is loaded only for gt-vue so its compiler dependency
 * does not affect other CLI commands.
 */
export async function createInlineUpdatesForLibrary(
  pkg: InlineLibrary,
  validate: boolean,
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions
) {
  if (pkg === Libraries.GT_VUE) {
    // Loading the adapter only for Vue keeps the compiler and extractor graph
    // out of React-only CLI startup. The shared resolver supplies tsconfig and
    // package-export semantics without moving parsing back into the CLI.
    const { createVueInlineUpdates } =
      await import('../vue/parse/createVueInlineUpdates.js');
    return createVueInlineUpdates(filePatterns, parsingFlags, parsingOptions);
  }
  return createInlineUpdates(
    pkg,
    validate,
    filePatterns,
    parsingFlags,
    parsingOptions
  );
}

/**
 * Extracts inline translations for every framework present in a mixed project.
 *
 * Vue SFCs are excluded from the React parser because Babel cannot parse the
 * SFC wrapper. JavaScript and TypeScript files are intentionally visible to
 * both extractors so each can recognize imports from its own package.
 */
export async function createInlineUpdatesForLibraries(
  libraries: readonly InlineLibrary[],
  validate: boolean,
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions
) {
  const uniqueLibraries = [...new Set(libraries)];
  const includesVue = uniqueLibraries.includes(Libraries.GT_VUE);
  const results = await Promise.all(
    uniqueLibraries.map((library) => {
      let libraryFilePatterns = filePatterns;
      if (includesVue && library !== Libraries.GT_VUE) {
        libraryFilePatterns = [
          ...(filePatterns ??
            readDefaultInlineSourcePatterns(process.cwd(), library)),
          '!**/*.vue',
        ];
      }
      return createInlineUpdatesForLibrary(
        library,
        validate,
        libraryFilePatterns,
        parsingFlags,
        parsingOptions
      );
    })
  );

  const updates = results.flatMap((result) => result.updates);
  if (uniqueLibraries.length > 1) {
    dedupeUpdates(updates);
  }

  return {
    updates,
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings),
  };
}
