import { isValidLocale, isSupersetLocale } from 'generaltranslation';
import { Settings } from '../types';

export function validateSettings(settings: Settings) {
  // Validate locales
  for (const locale of settings.locales) {
    if (!isValidLocale(locale)) {
      console.error(
        `Provided locales: "${settings?.locales?.join()}", ${locale} is not a valid locale!`
      );
      process.exit(1);
    }
  }
  if (settings.defaultLocale && !isValidLocale(settings.defaultLocale)) {
    console.error(
      `defaultLocale: ${settings.defaultLocale} is not a valid locale!`
    );
    process.exit(1);
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
    console.error(
      `defaultLocale: ${settings.defaultLocale} is a superset of another locale (${locale})! Please change the defaultLocale to a more specific locale.`
    );
    process.exit(1);
  }
}
