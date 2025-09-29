import { libraryDefaultLocale } from 'generaltranslation/internal';
import { promptText } from '../console/logging.js';
import chalk from 'chalk';
import { gt } from '../utils/gt.js';

export async function getDesiredLocales(): Promise<{
  defaultLocale: string;
  locales: string[];
}> {
  // Ask for the default locale
  const defaultLocale = await promptText({
    message: 'What is the default locale for your project?',
    defaultValue: libraryDefaultLocale,
  });

  // Ask for the locales
  const locales = await promptText({
    message: `What locales would you like to translate your project into? ${chalk.dim('(space-separated list)')}`,
    defaultValue: 'es zh fr de ja',
    validate: (input) => {
      const localeList = input.split(' ');
      if (localeList.length === 0) {
        return 'Please enter at least one locale';
      }
      for (const locale of localeList) {
        if (!gt.isValidLocale(locale)) {
          return 'Please enter a valid locale (e.g., en, fr, es)';
        }
      }
      return true;
    },
  });
  return { defaultLocale, locales: locales.split(' ') };
}
