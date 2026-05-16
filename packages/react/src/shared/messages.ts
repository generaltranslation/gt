import { createDiagnosticMessage } from 'generaltranslation/internal';

export const PACKAGE_NAME = 'gt-react';

export const createInvalidLocaleWarning = (locale: string) =>
  createDiagnosticMessage({
    source: PACKAGE_NAME,
    severity: 'Warning',
    whatHappened: `Locale "${locale}" is not valid`,
    fix: 'Use a valid BCP 47 locale code or add a custom mapping',
  });
