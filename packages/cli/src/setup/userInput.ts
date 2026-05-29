import { libraryDefaultLocale } from 'generaltranslation/internal';
import { promptLocale, promptLocaleList } from '../console/logging.js';

export async function getDesiredLocales(): Promise<{
  defaultLocale: string;
  locales: string[];
}> {
  // Ask for the default locale
  const defaultLocale = await promptLocale({
    message: 'What is the default locale for your project?',
    defaultValue: libraryDefaultLocale,
  });

  // Ask for the locales
  const locales = await promptLocaleList({
    message: 'Which languages would you like to translate your project into?',
  });
  return { defaultLocale, locales };
}
