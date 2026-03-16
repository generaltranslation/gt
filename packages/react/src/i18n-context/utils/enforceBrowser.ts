import { GENERIC_BROWSER_ENVIRONMENT_ERROR } from '../../errors-dir/constants';

/**
 * @internal
 *
 * Throws an error when imported outside of a browser environment.
 */
export function enforceBrowser(
  errorMessage: string = GENERIC_BROWSER_ENVIRONMENT_ERROR
) {
  if (typeof window === 'undefined') {
    throw new Error(errorMessage);
  }
}
