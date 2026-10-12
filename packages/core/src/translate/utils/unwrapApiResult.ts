import { ApiError } from '@generaltranslation/api';

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
    // TypeScript cannot narrow a generic T after excluding undefined; the
    // runtime guard above establishes the exact Exclude<T, undefined> result.
    return result.data as Exclude<T, undefined>;
  }
  if (result.response) {
    throw ApiError.fromResponse(result.error, result.response);
  }
  throw result.error;
}
