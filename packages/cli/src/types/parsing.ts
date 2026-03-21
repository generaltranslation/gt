// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import { ParsingConfig } from '../react/jsx/utils/stringParsing/types.js';
import { SupportedFileExtension } from './index.js';

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
 * Flags for parsing content. Not to be confused with ParsingConfig which helps us enable/disable
 * parsing features depending on the function being parsed. Parsing flags is for users to override
 * some of these defaults or enable/disable other features.
 *
 * @property {boolean} autoDerive - Whether to enable auto-derive for the t() function. (true -> 'AUTO', false -> 'DISABLED' {@link ParsingConfig['autoDeriveMethod']})
 * @property {boolean} includeSourceCodeContext - Include surrounding source code lines as context for translations.
 */
export type GTParsingFlags = BaseParsingFlags & {
  autoDerive: boolean;
  includeSourceCodeContext: boolean;
};

/**
 * Flags for parsing content with each filetype having its own flags
 * This is really a helper type that helps us map across filetypes
 */
export type ParseFlagsByFileType = {
  [K in SupportedFileExtension]?: BaseParsingFlags;
};
