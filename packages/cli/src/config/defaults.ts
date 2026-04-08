import { BaseParsingFlags, GTParsingFlags } from '../types/parsing.js';

/**
 * Default parsing flags for GT files
 * @property {boolean} autoDerive - Whether to enable auto-derive for the t() function. (true -> 'AUTO', false -> 'DISABLED' {@link ParsingConfig['autoDeriveMethod']})
 * @property {boolean} includeSourceCodeContext - Include surrounding source code lines as context for translations.
 */
export const GT_PARSING_FLAGS_DEFAULT: GTParsingFlags = {
  autoDerive: false,
  includeSourceCodeContext: false,
  enableAutoJsxInjection: false,
};

/**
 * Default parsing flags for all files
 */
export const BASE_PARSING_FLAGS_DEFAULT: BaseParsingFlags = {};
