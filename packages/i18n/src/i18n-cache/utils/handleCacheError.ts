import logger from '../../logs/logger';
import { getRuntimeEnvironment } from '../../utils/getRuntimeEnvironment';

/**
 * Cache error policy shared by I18nCache and DictionaryManager: throw in
 * development, log with the owner's prefix in production.
 */
export function handleCacheError(prefix: string, error: unknown): void {
  switch (getRuntimeEnvironment()) {
    case 'development':
      throw error;
    case 'production':
    default:
      logger.error(`${prefix}: ${error}`);
      break;
  }
}
