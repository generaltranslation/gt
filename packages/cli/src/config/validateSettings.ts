import { isValidLocale, isSupersetLocale } from 'generaltranslation';
import { Settings } from '../types/index.js';
import { logErrorAndExit } from '../console/logging.js';
import fs from 'node:fs';
import path from 'node:path';

export function validateSettings(settings: Settings) {
  // Validate locales
  for (const locale of settings.locales) {
    if (!isValidLocale(locale, settings.customMapping)) {
      logErrorAndExit(
        `Provided locales: "${settings?.locales?.join()}", ${locale} is not a valid locale!`
      );
    }
  }
  if (
    settings.defaultLocale &&
    !isValidLocale(settings.defaultLocale, settings.customMapping)
  ) {
    logErrorAndExit(
      `defaultLocale: ${settings.defaultLocale} is not a valid locale!`
    );
  }

  // defaultLocale cannot be a superset of any other locale
  if (
    settings.defaultLocale &&
    settings.locales.some(
      (locale) =>
        isSupersetLocale(settings.defaultLocale, locale) &&
        !isSupersetLocale(locale, settings.defaultLocale)
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

export function validateConfigExists() {
  const possibleConfigPaths = ['gt.config.json', 'src/gt.config.json'];
  for (const possibleConfigPath of possibleConfigPaths) {
    if (
      fs.existsSync(
        path.resolve(path.relative(process.cwd(), possibleConfigPath))
      )
    ) {
      return possibleConfigPath;
    }
  }
  logErrorAndExit(
    'No gt.config.json file found. Are you in the correct directory?'
  );
}
