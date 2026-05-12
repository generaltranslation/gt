import { createDiagnosticMessage } from 'generaltranslation/internal';

export const PACKAGE_NAME = 'gt-react';

// ---- Errors ---- //

export const BROWSER_ENVIRONMENT_ERROR = createDiagnosticMessage({
  source: `${PACKAGE_NAME}/browser`,
  severity: 'Error',
  whatHappened: 'This module requires a browser environment',
  fix: 'Import it only from client-side code',
});
export const GENERIC_BROWSER_ENVIRONMENT_ERROR = createDiagnosticMessage({
  source: PACKAGE_NAME,
  severity: 'Error',
  whatHappened: 'A browser-only module was imported outside the browser',
  fix: 'Move this import to client-side code',
});
export const BROWSER_I18N_MANAGER_NOT_INITIALIZED_ERROR =
  createDiagnosticMessage({
    source: PACKAGE_NAME,
    severity: 'Error',
    whatHappened: 'BrowserI18nManager is not initialized',
    fix: 'Call initializeGT() before using browser translation APIs',
  });

// ---- Warnings ---- //
export const createTranslationFailedDueToBrowserEnvironmentWarning = (
  message: string | TemplateStringsArray | undefined
) =>
  createDiagnosticMessage({
    source: PACKAGE_NAME,
    severity: 'Warning',
    whatHappened: `t("${typeof message === 'string' ? message : '`' + message?.join('${}') + '`'}") could not be translated because it ran outside the browser`,
    wayOut: 'The original message will render as a fallback',
  });

export const createNoLocaleCouldBeDeterminedFromCustomGetLocaleWarning = ({
  customLocale,
  defaultLocale,
}: {
  customLocale: string;
  defaultLocale: string;
}) =>
  createDiagnosticMessage({
    source: PACKAGE_NAME,
    severity: 'Warning',
    whatHappened: `Custom getLocale() returned unsupported locale "${customLocale}"`,
    wayOut: `Falling back to default locale "${defaultLocale}"`,
    fix: 'Add the locale to your config if you want to support it',
  });

export const createInvalidLocaleWarning = (locale: string) =>
  createDiagnosticMessage({
    source: PACKAGE_NAME,
    severity: 'Warning',
    whatHappened: `Locale "${locale}" is not valid`,
    fix: 'Use a valid BCP 47 locale code or add a custom mapping',
  });
