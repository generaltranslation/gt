import { isValidLocale } from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import logger from '../logs/logger';
import type { I18nConfigParams } from './I18nConfig';

export function validateI18nConfigParams({
  defaultLocale,
  locales,
  customMapping,
}: I18nConfigParams): void {
  const invalidLocales = getInvalidLocales({
    defaultLocale,
    locales,
    customMapping,
  });

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
