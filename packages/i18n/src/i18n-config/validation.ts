import { isValidLocale } from '@generaltranslation/format';
import {
  createDiagnosticMessage,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from 'generaltranslation/internal';
import logger from '../logs/logger';
import type { I18nConfigParams } from './I18nConfig';

export function validateI18nConfigParams(params: I18nConfigParams): void {
  if (!getGTServicesEnabled(params)) {
    return;
  }

  const invalidLocales = getInvalidLocales(params);

  invalidLocales.forEach((locale) => {
    logger.error(`I18nConfig: ${getInvalidLocaleMessage(locale)}`);
  });

  if (invalidLocales.length > 0) {
    throw new Error(
      createDiagnosticMessage({
        source: 'gt-i18n',
        severity: 'Error',
        whatHappened: 'Invalid I18nConfig locale configuration',
        details: invalidLocales.map((locale) => `Invalid locale: ${locale}`),
        fix: 'Use valid BCP 47 locale codes or add custom mappings.',
      })
    );
  }
}

function getGTServicesEnabled({
  projectId,
  devApiKey,
  apiKey,
  cacheUrl,
  runtimeUrl,
}: I18nConfigParams): boolean {
  return (
    ((cacheUrl === undefined || cacheUrl === defaultCacheUrl) && !!projectId) ||
    ((runtimeUrl === undefined || runtimeUrl === defaultRuntimeApiUrl) &&
      !!projectId &&
      !!(devApiKey || apiKey))
  );
}

function getInvalidLocales({
  defaultLocale,
  locales,
  customMapping,
}: I18nConfigParams): string[] {
  const localesToValidate = new Set([
    ...(defaultLocale ? [defaultLocale] : []),
    ...(locales || []),
  ]);

  return Array.from(localesToValidate).filter(
    (locale) => !isValidLocale(locale, customMapping)
  );
}

function getInvalidLocaleMessage(locale: string): string {
  return createDiagnosticMessage({
    whatHappened: `Locale "${locale}" is not valid`,
    fix: 'Use a valid BCP 47 locale code or add a custom mapping',
  });
}
