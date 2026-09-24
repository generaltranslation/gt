import {
  resolveCanonicalLocale,
  standardizeLocale,
} from '@generaltranslation/format';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  noDefaultLocaleError,
  noLocalesError,
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
 * Validate credentials. Authentication itself is not checked here: the API
 * client uses the API key when set and otherwise the signed-in user, which
 * reports `gt login` at the first request.
 * @param settings - The settings to validate
 * @returns True if a project ID is configured
 */
export function hasValidCredentials(
  settings: Settings
): settings is Settings & { projectId: string } {
  if (!settings.projectId) {
    logger.error(noProjectIdError);
    return false;
  }
  return true;
}
