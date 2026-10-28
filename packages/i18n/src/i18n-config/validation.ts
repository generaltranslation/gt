import { isValidLocale } from '@generaltranslation/format';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { I18nConfigParams } from './I18nConfig';

export function validateI18nConfigParams(
  params: I18nConfigParams,
  gtServicesEnabled: boolean
): void {
  if (!gtServicesEnabled) {
    return;
  }

  const invalidLocaleConfig = [
    ...getInvalidLocales(params),
    ...getInvalidCustomMappingLocales(params),
  ];

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
    // Configs passed without load-time validation can hold null entries.
    const locale = typeof value === 'string' ? value : value?.code;
    return locale && !isValidLocale(locale) ? [locale] : [];
  });
}
