import { isValidLocale, isSupersetLocale } from '@generaltranslation/format';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { Settings } from '../types/index.js';
import { logErrorAndExit } from '../console/logging.js';
import fs from 'node:fs';
import path from 'node:path';

const invalidLocaleFix =
  'Use a valid BCP 47 locale code or add a custom mapping in gt.config.json';

export function validateSettings(settings: Settings): void {
  // Validate locales
  for (const locale of settings.locales) {
    if (!isValidLocale(locale, settings.customMapping)) {
      return logErrorAndExit(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Error',
          whatHappened: `Locale "${locale}" is not valid`,
          details: `locales: ${settings.locales.join(', ')}`,
          fix: invalidLocaleFix,
        })
      );
    }
  }
  if (
    settings.defaultLocale &&
    !isValidLocale(settings.defaultLocale, settings.customMapping)
  ) {
    return logErrorAndExit(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: `defaultLocale "${settings.defaultLocale}" is not valid`,
        fix: invalidLocaleFix,
      })
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
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: `defaultLocale "${settings.defaultLocale}" is broader than configured locale "${locale}"`,
        fix: 'Change defaultLocale to a more specific locale',
      })
    );
  }
}

export function validateConfigExists() {
  const configPath = 'gt.config.json';
  if (fs.existsSync(path.resolve(configPath))) return configPath;
  return logErrorAndExit(
    'No gt.config.json file was found. Run this command from your project root, pass --config, or run npx gt init to create one.'
  );
}
