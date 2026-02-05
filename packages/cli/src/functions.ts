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
