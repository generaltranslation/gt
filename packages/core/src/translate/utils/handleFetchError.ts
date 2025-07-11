import { fetchLogger } from '../../logging/logger';
import {
  translationRequestFailedError,
  translationTimeoutError,
} from '../../logging/errors';

export default function handleFetchError(
  error: unknown,
  timeout: number
): never {
  if (error instanceof Error && error.name === 'AbortError') {
    const errorMessage = translationTimeoutError(timeout);
    fetchLogger.error(errorMessage);
    throw new Error(errorMessage);
  }
  const errorMessage = translationRequestFailedError(
    error instanceof Error ? error.message : String(error)
  );
  fetchLogger.error(errorMessage);
  throw error;
}
