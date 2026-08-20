import { libraryDefaultLocale } from 'generaltranslation/internal';
import {
  logErrorAndExit,
  promptLocale,
  promptLocaleList,
} from '../console/logging.js';

export async function getDesiredLocales(
  existingConfig?: {
    defaultLocale?: unknown;
    locales?: unknown;
  },
  nonInteractive: boolean = false
): Promise<{
  defaultLocale: string;
  locales: string[];
}> {
  const configuredDefaultLocale =
    typeof existingConfig?.defaultLocale === 'string' &&
    existingConfig.defaultLocale
      ? existingConfig.defaultLocale
      : undefined;
  const configuredLocales =
    Array.isArray(existingConfig?.locales) &&
    existingConfig.locales.every((locale) => typeof locale === 'string')
      ? (existingConfig.locales as string[])
      : undefined;

  // Ask for the default locale
  const defaultLocale =
    configuredDefaultLocale ??
    (nonInteractive
      ? libraryDefaultLocale
      : await promptLocale({
          message: 'What is the default locale for your project?',
          defaultValue: libraryDefaultLocale,
        }));

  if (
    nonInteractive &&
    (!configuredLocales || configuredLocales.length === 0)
  ) {
    logErrorAndExit(
      'No locales are configured. Add defaultLocale and locales to gt.config.json, or rerun without --yes to be prompted.'
    );
  }

  // Ask for the locales
  const locales =
    configuredLocales ??
    (await promptLocaleList({
      message: 'Which languages would you like to translate your project into?',
    }));
  return { defaultLocale, locales };
}
