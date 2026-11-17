import { isValidLocale } from '@generaltranslation/format';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import logger from '../logs/logger';
import type { I18nConfig, I18nConfigParams } from './I18nConfig';

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

// A config is initialized again on hot reload, with the same locales.
let warnedLocales: string | undefined;

/**
 * Warns, once, about the configured locales this runtime's `Intl` has no
 * number or date data for. `Intl` throws nothing for them: it formats them
 * in the host's locale, which a developer otherwise learns from a user.
 */
export function warnAboutLocalesWithoutIntlData(config: I18nConfig): void {
  const locales = new Set(
    [config.getDefaultLocale(), ...config.getLocales()].map((locale) =>
      config.resolveCanonicalLocale(locale)
    )
  );
  const missing = Array.from(locales).filter((locale) => !hasIntlData(locale));
  const key = missing.join();
  if (!missing.length || key === warnedLocales) return;
  warnedLocales = key;
  logger.warn(createLocalesWithoutIntlDataWarning(missing));
}

function hasIntlData(locale: string): boolean {
  try {
    return (
      Intl.NumberFormat.supportedLocalesOf(locale).length > 0 &&
      Intl.DateTimeFormat.supportedLocalesOf(locale).length > 0
    );
  } catch {
    // Not a language tag, which is not this warning's to report.
    return true;
  }
}

function createLocalesWithoutIntlDataWarning(locales: string[]): string {
  return createGtI18nDiagnostic({
    severity: 'Warning',
    whatHappened:
      "Numbers and dates in some configured locales are formatted in the browser's or the host's locale",
    why: "this runtime's Intl has no number or date data for them",
    fix: 'Load an Intl polyfill with their locale data, or pass `locales` to the formatter to choose a fallback',
    details: locales,
  });
}
