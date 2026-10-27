import { isValidLocale } from '@generaltranslation/format';
import { defaultLocaleMatcher } from '@generaltranslation/format/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import logger from '../logs/logger';
import type { I18nConfigParams } from './I18nConfig';

export function validateI18nConfigParams(
  params: I18nConfigParams,
  gtServicesEnabled: boolean
): void {
  validateLocaleMatcher(params);

  if (!gtServicesEnabled) {
    return;
  }

  const invalidLocales = getInvalidLocales(params);
  const invalidCustomMappingLocales = getInvalidCustomMappingLocales(params);
  const invalidLocaleConfig = [
    ...invalidLocales,
    ...invalidCustomMappingLocales,
  ];

  invalidLocaleConfig.forEach((locale) => {
    logger.error(`I18nConfig: ${getInvalidLocaleMessage(locale)}`);
  });

  if (invalidLocaleConfig.length > 0) {
    throw new Error(
      createDiagnosticMessage({
        source: 'gt-i18n',
        severity: 'Error',
        whatHappened: 'Invalid I18nConfig locale configuration',
        details: invalidLocaleConfig.map(
          (locale) => `Invalid locale: ${locale}`
        ),
        fix: 'Use valid BCP 47 locale codes or add custom mappings.',
      })
    );
  }
}

const localeMatchers: readonly unknown[] = ['lookup', defaultLocaleMatcher];

function validateLocaleMatcher({ localeMatcher }: I18nConfigParams): void {
  if (localeMatcher === undefined || localeMatchers.includes(localeMatcher)) {
    return;
  }
  throw new Error(
    createDiagnosticMessage({
      source: 'gt-i18n',
      severity: 'Error',
      whatHappened: 'Invalid I18nConfig localeMatcher',
      details: `localeMatcher: ${JSON.stringify(localeMatcher)}`,
      fix: `Set localeMatcher to "lookup" or "${defaultLocaleMatcher}" (the default)`,
    })
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

function getInvalidCustomMappingLocales({
  customMapping,
}: I18nConfigParams): string[] {
  return Object.values(customMapping || {}).flatMap((value) => {
    const locale = typeof value === 'string' ? value : value.code;
    return locale && !isValidLocale(locale) ? [locale] : [];
  });
}

function getInvalidLocaleMessage(locale: string): string {
  return createDiagnosticMessage({
    whatHappened: `Locale "${locale}" is not valid`,
    fix: 'Use a valid BCP 47 locale code or add a custom mapping',
  });
}
