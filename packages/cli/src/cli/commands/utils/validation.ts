import {
  noDefaultLocaleError,
  noLocalesError,
  noApiKeyError,
  devApiKeyError,
  noProjectIdError,
} from '../../../console/index.js';
import { logger } from '../../../console/logger.js';
import { Settings } from '../../../types/index.js';

/**
 * Validate locales
 * @param settings - The settings to validate
 * @returns True if has locales and default locale
 */
export function hasValidLocales(settings: Settings): boolean {
  if (!settings.locales) {
    logger.error(noLocalesError);
    return false;
  }
  if (!settings.defaultLocale) {
    logger.error(noDefaultLocaleError);
    return false;
  }
  return true;
}

/**
 * Validate credentials
 * @param settings - The settings to validate
 * @returns True if has API key, project ID, and does not have a development API key
 */
export function hasValidCredentials(settings: Settings): boolean {
  if (!settings.apiKey) {
    logger.error(noApiKeyError);
    return false;
  }
  if (settings.apiKey.startsWith('gtx-dev-')) {
    logger.error(devApiKeyError);
    return false;
  }
  if (!settings.projectId) {
    logger.error(noProjectIdError);
    return false;
  }
  return true;
}
