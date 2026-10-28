import type { GTParsingFlags } from 'generaltranslation/types';
import type { SupportedFileExtension } from './index.js';

/**
 * For monorepo projects, checking for extra exports fields in resolved internal packages.
 * For instance, an exported path may be labeled as 'browser' or 'module' or 'default'.
 * These can resolve to different files in the compiled package. This helps us know
 * which files to check when we do resolution.
 *
 * @property conditionNames - The condition names to check for in the resolved package.
 *
 * @example
 * {
 *   conditionNames: ['development', 'browser', 'module', 'import', 'require', 'default']
 * }
 */
export type ParsingConfigOptions = {
  conditionNames: string[];
};

/**
 * Base parsing flags for all files.
 * Currently no supported properties
 *
 * Future ideas for flags:
 * - flag for extraction of file name
 * - flag for extraction of last modified timestamp
 * - flag for extraction of git history
 */
export type BaseParsingFlags = Record<string, unknown>;

/**
 * `files.gt.parsingFlags` with the CLI defaults applied. Not to be confused with
 * ParsingConfigOptions, which enables parsing features per parsed function.
 */
export type ResolvedGTParsingFlags = GTParsingFlags &
  Required<
    Pick<
      GTParsingFlags,
      'autoderive' | 'includeSourceCodeContext' | 'enableAutoJsxInjection'
    >
  >;

/**
 * Flags for parsing content with each filetype having its own flags
 * This is really a helper type that helps us map across filetypes
 */
export type ParseFlagsByFileType = {
  [K in SupportedFileExtension]?: BaseParsingFlags;
};
