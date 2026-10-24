import { BaseParsingFlags, GTParsingFlags } from '../types/parsing.js';

/**
 * Default parsing flags for GT files
 * @property {boolean | { jsx?: boolean; strings?: boolean }} autoderive - Whether to enable autoderive. A plain boolean enables/disables both; an object enables selectively.
 * @property {boolean} includeSourceCodeContext - Include surrounding source code lines as context for translations.
 */
export const GT_PARSING_FLAGS_DEFAULT: GTParsingFlags = {
  autoderive: false,
  includeSourceCodeContext: false,
  enableAutoJsxInjection: false,
};

/**
 * Default parsing flags for all files
 */
export const BASE_PARSING_FLAGS_DEFAULT: BaseParsingFlags = {};
