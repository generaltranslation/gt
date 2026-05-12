/**
 * This file serves as an entrypoint for programmatically invoking CLI commands.
 * Import from 'gt/functions' to access these APIs.
 */

export { getValidateJson } from './translation/validate.js';
export type {
  ValidationResult,
  ValidationMessage,
  ValidationLevel,
} from './translation/validate.js';
export {
  Libraries,
  GT_LIBRARIES,
  INLINE_LIBRARIES,
  REACT_LIBRARIES,
  GT_LIBRARIES_UPSTREAM,
} from './types/libraries.js';
export type {
  GTLibrary,
  InlineLibrary,
  ReactLibrary,
} from './types/libraries.js';
