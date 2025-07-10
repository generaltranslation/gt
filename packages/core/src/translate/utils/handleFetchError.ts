import { translationLogger } from 'src/logging/logger';
import {
  translationRequestFailedError,
  translationTimeoutError,
} from 'src/logging/errors';

export default function handleFetchError(
  error: unknown,
  timeout: number
): never {
  if (error instanceof Error && error.name === 'AbortError') {
    const errorMessage = translationTimeoutError(timeout);
    translationLogger.error(errorMessage);
    throw new Error(errorMessage);
  }
  const errorMessage = translationRequestFailedError(
    error instanceof Error ? error.message : String(error)
  );
  translationLogger.error(errorMessage);
  throw error;
}
