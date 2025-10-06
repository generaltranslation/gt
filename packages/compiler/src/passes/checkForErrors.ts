import { TransformState } from '../state/types';

/**
 * Given state check for errors
 */
export function checkForErrors(state: TransformState): void {
  if (state.errorTracker.getErrors().length > 0) {
    for (const error of state.errorTracker.getErrors()) {
      state.logger.logError(error);
    }

    throw new Error(
      `[GT Unplugin] Encountered ${state.errorTracker.getErrors().length} errors while processing ${state.settings.filename}.`
    );
  }
}
