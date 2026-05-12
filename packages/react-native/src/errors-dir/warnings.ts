import {
  createDiagnosticMessage,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import { PACKAGE_NAME } from './constants';

export const resolveLocalesFailedWarning = createDiagnosticMessage({
  source: PACKAGE_NAME,
  severity: 'Warning',
  whatHappened: 'Locales for the polyfill could not be resolved',
  fix: 'Provide locales directly, pass your GT Config to the plugin, or provide the path to your GT Config file',
  wayOut: `The library will fall back to ${libraryDefaultLocale}`,
});

export const couldNotLocateConfigWarning = (filePath: string) =>
  createDiagnosticMessage({
    source: PACKAGE_NAME,
    severity: 'Warning',
    whatHappened: `GT Config could not be found at ${filePath}`,
    fix: 'Check the path or pass locales directly to the plugin',
  });

export const invalidLocalesWarning = (invalidLocales: string[]) =>
  createDiagnosticMessage({
    source: PACKAGE_NAME,
    severity: 'Warning',
    whatHappened: 'GT Config contains invalid locales',
    fix: 'Use valid BCP 47 locale codes or add custom mappings',
    details: invalidLocales,
  });

export const ssrUnsupportedWarning = createDiagnosticMessage({
  source: PACKAGE_NAME,
  severity: 'Warning',
  whatHappened: 'Server-side environments are not explicitly supported',
  wayOut: 'Some features may not work as expected',
});
