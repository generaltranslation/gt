import { isValidLocale, isSupersetLocale } from 'generaltranslation';
import { Settings } from '../types';
import { logErrorAndExit } from '../console';

export function validateSettings(settings: Settings) {
  // Validate locales
  for (const locale of settings.locales) {
    if (!isValidLocale(locale)) {
      logErrorAndExit(
        `Provided locales: "${settings?.locales?.join()}", ${locale} is not a valid locale!`
      );
    }
  }
  if (settings.defaultLocale && !isValidLocale(settings.defaultLocale)) {
    logErrorAndExit(
      `defaultLocale: ${settings.defaultLocale} is not a valid locale!`
    );
  }

  // defaultLocale cannot be a superset of any other locale
  if (
    settings.defaultLocale &&
    settings.locales.some((locale) =>
      isSupersetLocale(settings.defaultLocale, locale)
    )
  ) {
    const locale = settings.locales.find((locale) =>
      isSupersetLocale(settings.defaultLocale, locale)
    );
    logErrorAndExit(
      `defaultLocale: ${settings.defaultLocale} is a superset of another locale (${locale})! Please change the defaultLocale to a more specific locale.`
    );
  }
}
