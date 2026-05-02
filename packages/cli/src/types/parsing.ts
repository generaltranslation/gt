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
 * Flags for parsing content. Not to be confused with ParsingConfig which helps us enable/disable
 * parsing features depending on the function being parsed. Parsing flags is for users to override
 * some of these defaults or enable/disable other features.
 *
 * @property {boolean | { jsx?: boolean; strings?: boolean }} autoderive - Whether to enable autoderive. A plain boolean enables/disables both JSX and strings. An object enables selectively.
 * @property {boolean} includeSourceCodeContext - Include surrounding source code lines as context for translations.
 * @property {boolean} enableAutoJsxInjection - Whether to enable auto-jsx injection for the internal <_T> and <_Var> components.
 */
export type GTParsingFlags = BaseParsingFlags & {
  autoderive: boolean | { jsx?: boolean; strings?: boolean };
  includeSourceCodeContext: boolean;
  enableAutoJsxInjection: boolean;
};

/**
 * Resolves the autoderive config value into separate jsx and strings flags.
 * - `true` enables both (backward compatible)
 * - `false` disables both (backward compatible)
 * - `{ jsx?: boolean; strings?: boolean }` enables selectively (missing keys default to false)
 */
export function resolveAutoderive(
  value: boolean | { jsx?: boolean; strings?: boolean } | undefined
): { jsx: boolean; strings: boolean } {
  if (value === undefined || typeof value === 'boolean') {
    return { jsx: !!value, strings: !!value };
  }
  return { jsx: value.jsx ?? false, strings: value.strings ?? false };
}

/**
 * Flags for parsing content with each filetype having its own flags
 * This is really a helper type that helps us map across filetypes
 */
export type ParseFlagsByFileType = {
  [K in SupportedFileExtension]?: BaseParsingFlags;
};
