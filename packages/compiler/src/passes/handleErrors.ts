import { TransformState } from '../state/types';

/**
 * Error for invalid library usage
 */
export class InvalidLibraryUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLibraryUsageError';
  }
}

/**
 * Given state check for errors
 * Returns true when errors are present
 */
export function handleErrors(state: TransformState): boolean {
  if (state.errorTracker.getErrors().length === 0) return false;

  // Log errors
  for (const error of state.errorTracker.getErrors()) {
    state.logger.logError(
      state.settings.filename
        ? error.replace('{filename}', state.settings.filename)
        : error
    );
  }

  // Throw error if enabled
  if (!state.settings.disableBuildChecks) {
    throw new InvalidLibraryUsageError(
      `[gt-compiler] Encountered invalid library usage.`
    );
  }

  // Return original code
  return true;
}
