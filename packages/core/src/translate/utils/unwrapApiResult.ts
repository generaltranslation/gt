import { ApiError } from '../../errors/ApiError';

export function isErrorResult(error: unknown): error is { error: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof error.error === 'string'
  );
}

/**
 * Unwraps a `@generaltranslation/api` SDK result, returning its data or
 * throwing an `ApiError` built from the failed response.
 */
export function unwrapApiResult<T>(result: {
  data: T | undefined;
  error: unknown;
  response?: Response;
}): Exclude<T, undefined> {
  if (result.data !== undefined) {
    return result.data as Exclude<T, undefined>;
  }
  if (result.response) {
    const message = isErrorResult(result.error)
      ? result.error.error
      : typeof result.error === 'string'
        ? result.error
        : result.response.statusText;
    throw new ApiError(message, result.response.status, message);
  }
  throw result.error;
}
