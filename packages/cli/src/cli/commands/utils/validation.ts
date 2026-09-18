import {
  resolveCanonicalLocale,
  standardizeLocale,
} from '@generaltranslation/format';
import { createDiagnosticMessage } from 'generaltranslation/internal';
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
export function hasValidLocales(
  settings: Settings,
  { forApi = false }: { forApi?: boolean } = {}
): boolean {
  if (!settings.locales) {
    logger.error(noLocalesError);
    return false;
  }
  if (!settings.defaultLocale) {
    logger.error(noDefaultLocaleError);
    return false;
  }
  return !forApi || hasValidServiceLocales(settings);
}

/** API-backed commands require canonical codes or explicit aliases to them. */
export function hasValidServiceLocales(settings: Settings): boolean {
  for (const locale of [settings.defaultLocale, ...(settings.locales ?? [])]) {
    if (!locale) continue;
    const code = resolveCanonicalLocale(locale, settings.customMapping);
    const canonicalCode = standardizeLocale(code);
    if (code !== canonicalCode) {
      logger.error(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Error',
          whatHappened: `Locale "${locale}" is not configured for GT API use`,
          why: 'GT API commands require canonical locale codes or an explicit mapping to one',
          fix: `Use "${canonicalCode}" or set customMapping[${JSON.stringify(locale)}].code to "${canonicalCode}" in gt.config.json`,
        })
      );
      return false;
    }
  }
  return true;
}

/**
 * Validate an API key or a signed-in user token without requiring an existing project.
 */
export function hasValidApiKey(settings: Settings): boolean {
  if (!settings.apiKey && !settings.userTokenProvider) {
    logger.error(noApiKeyError);
    return false;
  }
  if (settings.apiKey?.startsWith('gtx-dev-')) {
    logger.error(devApiKeyError);
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
  if (!hasValidApiKey(settings)) return false;
  if (!settings.projectId) {
    logger.error(noProjectIdError);
    return false;
  }
  return true;
}
