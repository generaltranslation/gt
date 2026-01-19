import { libraryDefaultLocale } from 'generaltranslation/internal';
import { PACKAGE_NAME } from './constants';

export const resolveLocalesFailedWarning = `${PACKAGE_NAME}: Failed to resolve locales for polyfill. Falling back to ${libraryDefaultLocale}.
Specify a list of locales for the gt-react-native babel plugin by:
(1) Providing a list of locales
(2) Providing your GT Config to the plugin
(3) Providing the path to your GT Config file.`;

export const couldNotLocateConfigWarning = (filePath: string) =>
  `${PACKAGE_NAME}: Could not locate GT Config at ${filePath}.`;

export const invalidLocalesWarning = (invalidLocales: string[]) =>
  `${PACKAGE_NAME}: Invalid locales found in GT Config: ${invalidLocales.join(', ')}.`;
