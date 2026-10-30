import type {
  BaseParsingFlags,
  ResolvedGTParsingFlags,
} from '../types/parsing.js';

/** Default parsing flags for GT files */
export const GT_PARSING_FLAGS_DEFAULT: ResolvedGTParsingFlags = {
  autoderive: false,
  includeSourceCodeContext: false,
  enableAutoJsxInjection: false,
};

/**
 * Default parsing flags for all files
 */
export const BASE_PARSING_FLAGS_DEFAULT: BaseParsingFlags = {};
