/**
 * This file serves as an entrypoint for programmatically invoking CLI commands.
 * Import from 'gtx-cli/functions' to access these APIs.
 */

export { getValidateJson } from './translation/validate.js';
export type {
  ValidationResult,
  ValidationMessage,
  ValidationLevel,
} from './translation/validate.js';
export { getTranslateCheckJson } from './translation/translateCheck.js';
export type {
  TranslateCheckResult,
  SkippedFileInfo,
} from './translation/translateCheck.js';
export {
  Libraries,
  GTLibrary,
  InlineLibrary,
  ReactLibrary,
  GT_LIBRARIES,
  INLINE_LIBRARIES,
  REACT_LIBRARIES,
  GT_LIBRARIES_UPSTREAM,
} from './types/libraries.js';
