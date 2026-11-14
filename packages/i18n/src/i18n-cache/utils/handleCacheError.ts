import logger from '../../logs/logger';
import type { getRuntimeEnvironment } from '../../utils/getRuntimeEnvironment';

/**
 * Cache error policy shared by I18nCache and DictionaryManager: throw in
 * development, log with the owner's prefix in production.
 */
export function handleCacheError(
  prefix: string,
  error: unknown,
  environment: ReturnType<typeof getRuntimeEnvironment>
): void {
  switch (environment) {
    case 'development':
      throw error;
    case 'production':
    default:
      logger.error(`${prefix}: ${error}`);
      break;
  }
}

/**
 * Run a lookup, routing a thrown error or rejection through the owner's
 * handleError and returning the fallback once handled.
 */
export function guard<T>(
  handleError: (error: unknown) => void,
  fallback: T,
  fn: () => T
): T {
  try {
    return fn();
  } catch (error) {
    handleError(error);
    return fallback;
  }
}

export async function guardAsync<T>(
  handleError: (error: unknown) => void,
  fallback: T,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    handleError(error);
    return fallback;
  }
}
