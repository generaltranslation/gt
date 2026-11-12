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
