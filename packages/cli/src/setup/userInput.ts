import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { CustomMapping } from 'generaltranslation/types';
import { promptLocale, promptLocaleList } from '../console/logging.js';
import { validateLocale } from '../console/promptParsing.js';
import type { OnboardingSession } from './onboarding.js';

/**
 * Resolves the default and target locales: explicit flags replace the
 * configured values, which are kept otherwise. Only the default locale has a
 * recommended value.
 */
export async function getDesiredLocales(
  session: OnboardingSession,
  existingConfig: {
    defaultLocale?: unknown;
    locales?: unknown;
    customMapping?: unknown;
  },
  explicit: { defaultLocale?: string; locales?: string[] } = {}
): Promise<{
  defaultLocale?: string;
  locales?: string[];
}> {
  const configuredDefaultLocale =
    typeof existingConfig.defaultLocale === 'string' &&
    existingConfig.defaultLocale
      ? existingConfig.defaultLocale
      : undefined;
  const configuredLocales =
    Array.isArray(existingConfig.locales) &&
    existingConfig.locales.every((locale) => typeof locale === 'string')
      ? (existingConfig.locales as string[])
      : undefined;
  // Accept configured aliases (e.g. `french: { code: 'fr' }`).
  const customMapping =
    existingConfig.customMapping &&
    typeof existingConfig.customMapping === 'object'
      ? (existingConfig.customMapping as CustomMapping)
      : undefined;

  for (const locale of [
    ...(explicit.defaultLocale ? [explicit.defaultLocale] : []),
    ...(explicit.locales ?? []),
  ]) {
    if (validateLocale(locale, customMapping) !== true) {
      session.reject(`"${locale}" is not a valid locale`);
    }
  }

  const defaultLocale = await session.answer('--default-locale', {
    explicit: explicit.defaultLocale,
    configured: configuredDefaultLocale,
    recommended: libraryDefaultLocale,
    ask: () =>
      promptLocale({
        message: 'What is the default locale for your project?',
        defaultValue: libraryDefaultLocale,
        customMapping,
      }),
  });

  const locales = await session.answer('--locales', {
    explicit: explicit.locales,
    configured: configuredLocales,
    ask: () =>
      promptLocaleList({
        message:
          'Which languages would you like to translate your project into?',
        customMapping,
      }),
  });
  return { defaultLocale, locales };
}
