import { isValidLocale, isSupersetLocale } from '@generaltranslation/format';
import { Settings } from '../types/index.js';
import { logErrorAndExit } from '../console/logging.js';
import fs from 'node:fs';
import path from 'node:path';

export function validateSettings(settings: Settings) {
  // Validate locales
  for (const locale of settings.locales) {
    if (!isValidLocale(locale, settings.customMapping)) {
      return logErrorAndExit(
        `Locale "${locale}" is not valid in the provided locales: "${settings?.locales?.join()}". Use a valid BCP 47 locale code or add a custom mapping in gt.config.json.`
      );
    }
  }
  if (
    settings.defaultLocale &&
    !isValidLocale(settings.defaultLocale, settings.customMapping)
  ) {
    return logErrorAndExit(
      `defaultLocale "${settings.defaultLocale}" is not valid. Use a valid BCP 47 locale code or add a custom mapping in gt.config.json.`
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
    return logErrorAndExit(
      `defaultLocale "${settings.defaultLocale}" is broader than configured locale "${locale}". Change defaultLocale to a more specific locale.`
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
  return logErrorAndExit(
    'No gt.config.json file was found. Run this command from your project root, pass --config, or run npx gt init to create one.'
  );
}
