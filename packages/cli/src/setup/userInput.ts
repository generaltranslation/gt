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
    message: `Which languages would you like to translate your project into? Enter your response as a list of BCP-47 locale tags. ${chalk.dim('(space-separated list)')}`,
    defaultValue: 'es fr de ja zh',
    validate: (input) => {
      const localeList = input.split(' ');
      if (localeList.length === 0) {
        return 'Please enter at least one locale';
      }
      if (localeList.some((locale) => !locale.trim())) {
        return 'Please enter a valid locale (e.g., es fr de)';
      }
      for (const locale of localeList) {
        if (!gt.isValidLocale(locale)) {
          return 'Please enter a valid locale (e.g., es fr de)';
        }
      }
      return true;
    },
  });
  return { defaultLocale, locales: locales.split(' ') };
}
